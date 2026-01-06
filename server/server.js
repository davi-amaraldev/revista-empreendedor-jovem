import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { pool } from "./db.js";
import dotenv from "dotenv";
import session from "express-session";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();

/**
 * IMPORTANTE:
 * - Se você usa Cloudflare Tunnel / Proxy reverso, o Express precisa confiar no proxy
 *   para o cookie secure/sameSite funcionar direito.
 */
app.set("trust proxy", 1);

// ===== Body =====
app.use(express.json());

// ===== CORS =====
// Se front e back estão no mesmo domínio, você pode manter simples.
// Se for usar Tunnel (domínio diferente), configure ALLOWED_ORIGIN no .env
// e habilite credentials.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
if (ALLOWED_ORIGIN) {
  app.use(
    cors({
      origin: ALLOWED_ORIGIN,
      credentials: true,
    })
  );
} else {
  app.use(cors());
}

// ===== Sessions =====
const IS_PROD = process.env.NODE_ENV === "production";
app.use(
  session({
    name: "revista.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD, // em prod HTTPS true (tunnel/proxy geralmente é HTTPS)
    },
  })
);

// ===== Paths (ESM) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

// garante pastas
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// serve site estático
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

// ===== Multer (upload de imagem) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9._-]/g, "");
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const upload = multer({ storage });

// ===== Helpers =====
const CATEGORIAS_VALIDAS = new Set([
  "geral",
  "tecnologia",
  "politica",
  "economia",
  "empreendedorismo",
  "bolsas",
  "cursos",
  "carreira",
]);

function requireAdmin(req, res, next) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: "Login necessário." });
  }
  next();
}

// ===== Boot: garantir admin do .env no banco =====
async function ensureEnvAdmin() {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  if (!user || !pass) {
    console.log("[admin] ADMIN_USER/ADMIN_PASS não definidos no .env. Pulando criação.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const existing = await pool.query("SELECT id FROM admins WHERE username = $1", [user]);
  if (existing.rowCount > 0) {
    console.log(`[admin] Usuário '${user}' já existe (id=${existing.rows[0].id}).`);
    return;
  }

  const hash = await bcrypt.hash(pass, 10);
  await pool.query("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", [
    user,
    hash,
  ]);

  console.log(`[admin] Criado admin inicial '${user}' a partir do .env.`);
}

// ===== API Routes =====

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ===== ADS (público) =====
// Corrigido: só filtra por categoria se categoria veio na query
app.get("/api/ads", async (req, res) => {
  try {
    const { slot, categoria } = req.query;
    if (!slot) return res.status(400).json({ error: "slot é obrigatório." });

    let sql = `
      SELECT *
      FROM ads
      WHERE ativo = true
        AND slot = $1
    `;
    const params = [slot];

    // se categoria foi enviada, preferimos categoria igual, mas aceitamos global (NULL)
    if (categoria) {
      sql += ` AND (categoria IS NULL OR categoria = $2)`;
      params.push(categoria);
      sql += `
        ORDER BY
          CASE WHEN categoria = $2 THEN 0 ELSE 1 END,
          peso DESC,
          created_at DESC
        LIMIT 1
      `;
    } else {
      // sem categoria: pega o melhor anúncio global/qualquer
      sql += `
        ORDER BY
          peso DESC,
          created_at DESC
        LIMIT 1
      `;
    }

    const result = await pool.query(sql, params);

    if (result.rowCount === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar anúncio." });
  }
});

// ===== ADS ADMIN (protegido) =====
app.post("/api/admin/ads", requireAdmin, upload.single("imagem"), async (req, res) => {
  try {
    const { slot, titulo, texto, href, categoria, tipo, peso, adsense_slot } = req.body;

    if (!slot) return res.status(400).json({ error: "slot é obrigatório." });

    if (categoria && !CATEGORIAS_VALIDAS.has(categoria)) {
      return res.status(400).json({ error: "Categoria inválida." });
    }

    const imagem = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO ads (slot, titulo, texto, href, imagem, categoria, tipo, peso, adsense_slot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        slot,
        titulo || null,
        texto || null,
        href || null,
        imagem,
        categoria || null,
        tipo || "patrocinador",
        Number.isFinite(Number(peso)) ? Number(peso) : 100,
        adsense_slot || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar anúncio." });
  }
});

app.get("/api/admin/ads", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ads ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar anúncios." });
  }
});

app.delete("/api/admin/ads/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });

    const result = await pool.query("DELETE FROM ads WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Anúncio não encontrado." });

    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar anúncio." });
  }
});

// ===== AUTH ADMIN =====
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Campos obrigatórios." });
    }

    const result = await pool.query("SELECT * FROM admins WHERE username = $1", [username]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    const admin = result.rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    req.session.adminId = admin.id;
    req.session.username = admin.username;

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login." });
  }
});

app.get("/api/admin/me", (req, res) => {
  if (!req.session?.adminId) return res.status(401).json({ error: "Não autenticado." });
  res.json({ ok: true, adminId: req.session.adminId, username: req.session.username });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===== NOTÍCIAS (público) =====
app.get("/api/noticias", async (req, res) => {
  try {
    const { categoria } = req.query;

    if (categoria && !CATEGORIAS_VALIDAS.has(categoria)) {
      return res.status(400).json({ error: "Categoria inválida." });
    }

    const result = categoria
      ? await pool.query("SELECT * FROM noticias WHERE categoria = $1 ORDER BY created_at DESC", [
          categoria,
        ])
      : await pool.query("SELECT * FROM noticias ORDER BY created_at DESC");

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar notícias." });
  }
});

app.get("/api/noticias/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });

    const result = await pool.query("SELECT * FROM noticias WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Notícia não encontrada." });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar notícia." });
  }
});

// criar (PROTEGIDO)
app.post("/api/noticias", requireAdmin, upload.single("imagem"), async (req, res) => {
  try {
    const { titulo, resumo, conteudo, categoria } = req.body;

    if (!titulo || !resumo || !conteudo || !categoria) {
      return res.status(400).json({ error: "Campos obrigatórios faltando." });
    }
    if (!CATEGORIAS_VALIDAS.has(categoria)) {
      return res.status(400).json({ error: "Categoria inválida." });
    }

    const imagem = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO noticias (titulo, resumo, conteudo, categoria, imagem)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [titulo, resumo, conteudo, categoria, imagem]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar notícia." });
  }
});

// apagar (PROTEGIDO)
app.delete("/api/noticias/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });

    const result = await pool.query("DELETE FROM noticias WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Notícia não encontrada." });

    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar notícia." });
  }
});

// ===== Start =====
const PORT = Number(process.env.PORT) || 3001;

ensureEnvAdmin()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Login:  http://localhost:${PORT}/admin/login.html`);
      console.log(`Dash:   http://localhost:${PORT}/admin/dashboard.html`);
    });
  })
  .catch((err) => {
    console.error("[boot] Falha ao iniciar:", err);
    process.exit(1);
  });

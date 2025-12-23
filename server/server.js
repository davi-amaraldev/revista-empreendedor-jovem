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

// ===== CORS (se frontend e backend estão no mesmo host/porta, isso já basta) =====
app.use(cors());
app.use(express.json());

// ===== Sessions =====
app.use(
  session({
    name: "revista.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: true, // só liga quando estiver em HTTPS
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

  // garante tabela (caso não exista)
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
  await pool.query(
    "INSERT INTO admins (username, password_hash) VALUES ($1, $2)",
    [user, hash]
  );

  console.log(`[admin] Criado admin inicial '${user}' a partir do .env.`);
}

// ===== API Routes =====

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ===== AUTH ADMIN =====

// login
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

// me
app.get("/api/admin/me", (req, res) => {
  if (!req.session?.adminId) return res.status(401).json({ error: "Não autenticado." });
  res.json({ ok: true, adminId: req.session.adminId, username: req.session.username });
});

// logout
app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===== NOTÍCIAS =====

// listar (público)
app.get("/api/noticias", async (req, res) => {
  try {
    const { categoria } = req.query;

    if (categoria && !CATEGORIAS_VALIDAS.has(categoria)) {
      return res.status(400).json({ error: "Categoria inválida." });
    }

    const result = categoria
      ? await pool.query(
          "SELECT * FROM noticias WHERE categoria = $1 ORDER BY created_at DESC",
          [categoria]
        )
      : await pool.query("SELECT * FROM noticias ORDER BY created_at DESC");

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar notícias." });
  }
});

// buscar 1 (público)
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
const PORT = 3001;

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

# 📰 Revista do Empreendedor Jovem

Plataforma digital de notícias focada em **empreendedorismo jovem**, **tecnologia**, **economia**, **política**, **bolsas de estudo** e **cursos**, com painel administrativo, API própria e banco de dados PostgreSQL.

Projeto desenvolvido com foco em **performance**, **SEO**, **organização de código** e **preparação para produção**.

---

## 🚀 Stack Tecnológica

### Front-end
- HTML5
- CSS3 (layout responsivo)
- JavaScript Vanilla
- SEO on-page dinâmico
- Estrutura preparada para anúncios (Google AdSense)

### Back-end
- Node.js
- Express
- API REST
- Autenticação de administrador
- Upload de imagens

### Banco de Dados
- PostgreSQL 16
- Persistência via Docker Volume

### Infraestrutura
- Docker
- Docker Compose
- Cloudflare Tunnel (ambiente temporário)
- Preparado para VPS Linux (Ubuntu)

---

## 📁 Estrutura do Projeto

```bash
.
├── public/              # Front-end (site público)
│   ├── pages/           # Páginas HTML
│   ├── css/             # Estilos
│   ├── js/              # Scripts
│   ├── favicon/         # Favicons
│   └── uploads/         # Imagens das matérias
│
├── server/              # Back-end (API)
│   ├── server.js        # Servidor Express
│   ├── db.js            # Conexão PostgreSQL
│   └── package.json
│
├── docker-compose.yml   # Banco PostgreSQL
├── .env.example         # Variáveis de ambiente (modelo)
├── .editorconfig        # Padronização de código
├── .gitignore
└── README.md

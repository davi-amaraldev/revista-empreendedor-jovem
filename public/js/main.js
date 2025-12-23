// ===== Config =====
const categoria = document.body.dataset.categoria || "";
const API_BASE = window.API_BASE || "";
const API_URL = categoria
  ? `${API_BASE}/api/noticias?categoria=${encodeURIComponent(categoria)}`
  : `${API_BASE}/api/noticias`;

const elDestaques = document.getElementById("destaques");
const elMain = document.getElementById("mainArticle");
const elSecondary = document.getElementById("secondary");
const elUltimas = document.getElementById("ultimas");
const dateEl = document.querySelector(".date");

// ===== Utils =====
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderLink(n) {
  const href = `/pages/materia.html?id=${encodeURIComponent(n.id)}`;
  const titulo = escapeHtml(n.titulo);
  return `<a href="${href}" class="news-mini-link">${titulo}</a>`;
}

// ===== Renderers =====
function renderMain(n) {
  const href = `/pages/materia.html?id=${encodeURIComponent(n.id)}`;
  const titulo = escapeHtml(n.titulo);
  const resumo = escapeHtml(n.resumo);
  const cat = escapeHtml(n.categoria);
  const dt = escapeHtml(formatDate(n.created_at));

  elMain.innerHTML = `
    ${
      n.imagem
        ? `<img class="hero-img" src="${n.imagem}" alt="">`
        : ``
    }
    <h2><a class="main-link" href="${href}">${titulo}</a></h2>
    <p class="lead">${resumo}</p>
    <p class="muted">${cat} • ${dt}</p>
  `;
}

function renderSecondary(list) {
  elSecondary.innerHTML = list
    .map((n) => {
      const href = `/pages/materia.html?id=${encodeURIComponent(n.id)}`;
      const titulo = escapeHtml(n.titulo);
      const resumo = escapeHtml(n.resumo);

      return `
        <article class="secondary-item">
          <h3><a href="${href}">${titulo}</a></h3>
          <p>${resumo}</p>
        </article>
      `;
    })
    .join("");
}

function renderDestaques(list) {
  elDestaques.innerHTML = list
    .map((n) => `<p style="margin:0 0 10px">${renderLink(n)}</p>`)
    .join("");
}

function renderUltimas(list) {
  elUltimas.innerHTML = list
    .map((n) => `<p style="margin:0 0 10px">${renderLink(n)}</p>`)
    .join("");
}

// ===== Main =====
async function init() {
  // data no topo (bonito e útil)
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  // se a página não tem os containers (ex: admin), não faz nada
  if (!elMain || !elSecondary || !elDestaques || !elUltimas) return;

  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    if (!res.ok) {
      elMain.innerHTML = `<p>Erro: ${escapeHtml(data?.error || "Falha ao carregar.")}</p>`;
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      elMain.innerHTML = `<p>Sem notícias por enquanto.</p>`;
      elSecondary.innerHTML = "";
      elDestaques.innerHTML = "";
      elUltimas.innerHTML = "";
      return;
    }

    // 1 main + 2 secondary
    const main = data[0];
    const secondary = data.slice(1, 3);

    // destaques SEM repetir main/secondary
    const destaques = data.slice(3, 6);

    // últimas (mais itens)
    const ultimas = data.slice(0, 8);

    renderMain(main);
    renderSecondary(secondary);
    renderDestaques(destaques);
    renderUltimas(ultimas);
  } catch (err) {
    elMain.innerHTML = `<p>Falha de rede ao carregar notícias.</p>`;
  }
}

init();

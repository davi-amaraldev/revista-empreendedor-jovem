const API_BASE = ""; // deixe vazio se frontend e backend estão no mesmo host/porta

const form = document.getElementById("formNoticia");
const statusForm = document.getElementById("statusForm");
const statusLista = document.getElementById("statusLista");
const listaEl = document.getElementById("lista");

const btnRecarregar = document.getElementById("btnRecarregar");
const btnLimpar = document.getElementById("btnLimpar");
const btnLogout = document.getElementById("btnLogout");

const inputImagem = document.getElementById("imagem");
const previewBox = document.getElementById("preview");
const previewImg = document.getElementById("previewImg");
const previewName = document.getElementById("previewName");

const filtroCategoria = document.getElementById("filtroCategoria");

function setStatus(el, msg, type = "") {
  el.className = "status" + (type ? ` ${type}` : "");
  el.textContent = msg || "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function handle401(res) {
  if (res.status === 401) {
    // sessão expirada / não logado
    window.location.href = "/admin/login.html";
    return true;
  }
  return false;
}

async function checarSessao() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/me`);
    if (handle401(res)) return false;
    return res.ok;
  } catch {
    // se cair aqui, pelo menos mostra algo
    setStatus(statusLista, "Falha de rede ao verificar sessão.", "err");
    return false;
  }
}

async function carregarNoticias() {
  setStatus(statusLista, "Carregando...", "");
  listaEl.innerHTML = "";

  const cat = filtroCategoria.value;
  const url = cat
    ? `${API_BASE}/api/noticias?categoria=${encodeURIComponent(cat)}`
    : `${API_BASE}/api/noticias`;

  try {
    const res = await fetch(url);
    if (handle401(res)) return;

    const data = await res.json();

    if (!res.ok) {
      setStatus(statusLista, data?.error || "Erro ao carregar.", "err");
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      setStatus(statusLista, "Nenhuma notícia encontrada.", "");
      return;
    }

    setStatus(statusLista, "", "");

    for (const n of data) {
      const item = document.createElement("div");
      item.className = "item";

      const titulo = escapeHtml(n.titulo ?? "");
      const resumo = escapeHtml(n.resumo ?? "");
      const categoria = escapeHtml(n.categoria ?? "");
      const createdAt = escapeHtml(formatDate(n.created_at));
      const id = n.id;

      item.innerHTML = `
        <div class="item-top">
          <div>
            <h3>${titulo}</h3>
            <div class="meta">
              <strong>#${id}</strong> • ${categoria} • ${createdAt}
            </div>
            <p style="margin:10px 0 0">${resumo}</p>
          </div>

          <div class="actions">
            <button class="danger" data-del="${id}">Apagar</button>
          </div>
        </div>
        ${
          n.imagem
            ? `<img src="${n.imagem}" alt="Imagem da notícia">`
            : `<div class="muted" style="margin-top:10px">Sem imagem</div>`
        }
      `;

      listaEl.appendChild(item);
    }

    // binds apagar
    listaEl.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        const ok = confirm(`Apagar a notícia #${id}?`);
        if (!ok) return;
        await apagarNoticia(id);
      });
    });
  } catch (err) {
    setStatus(statusLista, "Falha de rede ao carregar.", "err");
  }
}

async function apagarNoticia(id) {
  setStatus(statusLista, `Apagando #${id}...`, "");

  try {
    const res = await fetch(`${API_BASE}/api/noticias/${id}`, {
      method: "DELETE",
    });

    if (handle401(res)) return;

    if (res.status === 204) {
      setStatus(statusLista, `Notícia #${id} apagada.`, "ok");
      await carregarNoticias();
      return;
    }

    let data = {};
    try {
      data = await res.json();
    } catch {}

    setStatus(statusLista, data?.error || "Erro ao apagar.", "err");
  } catch {
    setStatus(statusLista, "Falha de rede ao apagar.", "err");
  }
}

function limparForm() {
  form.reset();
  previewBox.style.display = "none";
  previewImg.src = "";
  previewName.textContent = "";
  setStatus(statusForm, "", "");
}

inputImagem.addEventListener("change", () => {
  const f = inputImagem.files?.[0];
  if (!f) {
    previewBox.style.display = "none";
    return;
  }
  previewBox.style.display = "flex";
  previewName.textContent = f.name;

  const url = URL.createObjectURL(f);
  previewImg.src = url;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(statusForm, "Publicando...", "");

  const fd = new FormData(form);

  try {
    const res = await fetch(`${API_BASE}/api/noticias`, {
      method: "POST",
      body: fd,
    });

    if (handle401(res)) return;

    const data = await res.json();

    if (!res.ok) {
      setStatus(statusForm, data?.error || "Erro ao publicar.", "err");
      return;
    }

    setStatus(statusForm, `Publicado! (#${data.id})`, "ok");
    limparForm();
    await carregarNoticias();
  } catch (err) {
    setStatus(statusForm, "Falha de rede ao publicar.", "err");
  }
});

btnRecarregar.addEventListener("click", carregarNoticias);
btnLimpar.addEventListener("click", limparForm);
filtroCategoria.addEventListener("change", carregarNoticias);

btnLogout?.addEventListener("click", async () => {
  try {
    await fetch(`${API_BASE}/api/admin/logout`, { method: "POST" });
  } finally {
    window.location.href = "/admin/login.html";
  }
});

// init
(async () => {
  const ok = await checarSessao();
  if (!ok) return;
  await carregarNoticias();
})();

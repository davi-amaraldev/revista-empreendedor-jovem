// public/js/ads.js
window.loadAd = async function loadAd(targetId, { slot, categoria } = {}) {
  const el = document.getElementById(targetId);
  if (!el) return;

  try {
    const url = new URL("/api/ads", window.location.origin);
    url.searchParams.set("slot", slot);
    if (categoria) url.searchParams.set("categoria", categoria);

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const ad = await res.json();

    if (!res.ok) throw new Error(ad?.error || "Erro ao buscar anúncio");

    if (!ad) {
      el.innerHTML = ""; // sem anúncio
      return;
    }

    // render simples (você estiliza depois)
    const href = ad.href || "#";
    const titulo = ad.titulo || "Publicidade";
    const texto = ad.texto || "";
    const img = ad.imagem ? `<img src="${ad.imagem}" alt="${titulo}" style="max-width:100%;height:auto;">` : "";

    el.innerHTML = `
      <aside class="ad-slot">
        <div class="ad-label">Publicidade</div>
        <a class="ad-box" href="${href}" target="_blank" rel="noopener">
          ${img || `<div class="ad-title">${titulo}</div><div class="ad-text">${texto}</div>`}
        </a>
      </aside>
    `;
  } catch (e) {
    // não quebra a matéria se anúncio falhar
    el.innerHTML = "";
    console.warn("[ads] falhou:", e);
  }
};

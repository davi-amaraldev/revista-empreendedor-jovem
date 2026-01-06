// public/js/ads.js
(function () {
  async function loadAd(targetId, opts = {}) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const slot = opts.slot;
    const categoria = opts.categoria || "";

    if (!slot) {
      el.innerHTML = "";
      return;
    }

    // wrapper padrão
    const wrap = document.createElement("aside");
    wrap.className = "ad-slot";
    wrap.innerHTML = `<div class="ad-label">Publicidade</div>`;
    el.innerHTML = "";
    el.appendChild(wrap);

    try {
      const url = new URL("/api/ads", window.location.origin);
      url.searchParams.set("slot", slot);
      if (categoria) url.searchParams.set("categoria", categoria);

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      const ad = await res.json().catch(() => null);

      // se não tem anúncio, mostra fallback simples
      if (!res.ok || !ad) {
        wrap.innerHTML += `
          <a class="ad-box" href="https://wa.me/5581994602686?text=Quero%20exibir%20minha%20marca%20no%20website."
             target="_blank" rel="noopener">
            <div class="ad-title">Anuncie aqui</div>
            <div class="ad-text">Sua marca pode aparecer neste espaço</div>
          </a>
        `;
        return;
      }

      // render do anúncio
      const href = ad.href || "#";
      const titulo = ad.titulo || "Patrocinador";
      const texto = ad.texto || "";
      const img = ad.imagem || "";

      // se tiver imagem, usa imagem; senão, usa card de texto
      if (img) {
        wrap.innerHTML += `
          <a class="ad-box" href="${href}" target="_blank" rel="noopener">
            <img src="${img}" alt="${titulo}">
          </a>
          ${texto ? `<div class="ad-text" style="margin-top:8px">${texto}</div>` : ""}
        `;
      } else {
        wrap.innerHTML += `
          <a class="ad-box" href="${href}" target="_blank" rel="noopener">
            <div class="ad-title">${titulo}</div>
            ${texto ? `<div class="ad-text">${texto}</div>` : ""}
          </a>
        `;
      }
    } catch (e) {
      // fallback em erro de rede
      wrap.innerHTML += `
        <a class="ad-box" href="https://wa.me/5581994602686?text=Quero%20exibir%20minha%20marca%20no%20website."
           target="_blank" rel="noopener">
          <div class="ad-title">Anuncie aqui</div>
          <div class="ad-text">Sua marca pode aparecer neste espaço</div>
        </a>
      `;
    }
  }

  // expõe global
  window.loadAd = loadAd;
})();

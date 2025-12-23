const API_BASE = ""; // deixa vazio se backend e site estão no mesmo host/porta

const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");
const ok = document.getElementById("ok");

function setMsg(text) {
  msg.textContent = text || "";
  ok.textContent = "";
}

function setOk(text) {
  ok.textContent = text || "";
  msg.textContent = "";
}

async function checkAlreadyLogged() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/me`);
    if (res.ok) {
      // já logado → vai pro dashboard direto
      window.location.href = "/admin/dashboard.html";
    }
  } catch {
    // ignora
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const username = form.username.value.trim();
  const password = form.password.value;

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(data?.error || "Falha no login.");
      return;
    }

    setOk("Login ok! Indo pro painel...");
    window.location.href = "/admin/dashboard.html";
  } catch {
    setMsg("Falha de rede.");
  }
});

// init
checkAlreadyLogged();

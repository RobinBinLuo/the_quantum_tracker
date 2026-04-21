const AUTH_STORAGE_KEY = "quantum-frontier-preview-authenticated";
const ACCESS_USERNAME = "quantum";
const ACCESS_PASSWORD = "quantum2026";

const root = document.documentElement;
const params = new URLSearchParams(window.location.search);

if (params.get("logout") === "1") {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

const isAuthenticated = sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";

root.classList.add(isAuthenticated ? "auth-ready" : "auth-locked");

function unlockSite() {
  sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
  root.classList.remove("auth-locked");
  root.classList.add("auth-ready");
  document.querySelector(".auth-gate")?.remove();
}

function mountAuthGate() {
  if (!root.classList.contains("auth-locked")) return;

  const gate = document.createElement("section");
  gate.className = "auth-gate";
  gate.setAttribute("aria-label", "Private preview login");
  gate.innerHTML = `
    <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <p class="eyebrow">Private Preview</p>
      <h1 id="auth-title">量子研究网站预览</h1>
      <p class="auth-copy">
        请输入访问账号和密码。这个门禁适合朋友或同事预览使用，不用于保护敏感数据。
      </p>
      <form class="auth-form">
        <label>
          <span>账号</span>
          <input name="username" type="text" autocomplete="username" required />
        </label>
        <label>
          <span>密码</span>
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <p class="auth-error" hidden>账号或密码不正确，请再试一次。</p>
        <button type="submit">进入网站</button>
      </form>
      <p class="auth-hint">请向站点维护者获取访问口令。若忘记口令，可在 auth.js 中重新设置。</p>
    </div>
  `;

  document.body.appendChild(gate);

  const form = gate.querySelector(".auth-form");
  const error = gate.querySelector(".auth-error");
  const usernameInput = gate.querySelector('input[name="username"]');

  usernameInput?.focus();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");

    if (username === ACCESS_USERNAME && password === ACCESS_PASSWORD) {
      unlockSite();
      return;
    }

    if (error) error.hidden = false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAuthGate);
} else {
  mountAuthGate();
}

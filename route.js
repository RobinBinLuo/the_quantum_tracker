import {
  detailMetric,
  escapeHtml,
  fetchPayload,
  getLanguage,
  getParam,
  getRouteBySlug,
  localized,
  mountLanguageSwitcher,
  renderCompanyCard,
} from "./shared.js";

const titleEl = document.querySelector("title");
const shellEl = document.querySelector("#route-shell");

init();

async function init() {
  mountLanguageSwitcher();
  const payload = await fetchPayload();
  const routeSlug = getParam("id") ?? payload.routes[0]?.slug;
  const route = getRouteBySlug(payload, routeSlug);
  const isEn = getLanguage() === "en";

  if (!route) {
    shellEl.innerHTML = renderNotFound(isEn ? "Route not found" : "未找到对应路线");
    return;
  }

  const routeLabel = localized(route, "label");
  const routeSummary = localized(route, "summary");
  const routeAdvantages = localized(route, "advantages") ?? route.advantages;
  const routeDrawbacks = localized(route, "drawbacks") ?? route.drawbacks;
  const routeTags = localized(route, "tags") ?? route.tags;
  const routeMaturity = localized(route, "maturity") ?? route.maturity;
  const routeBestFor = localized(route, "bestFor") ?? route.bestFor;
  const routeMainChallenge = localized(route, "mainChallenge") ?? route.mainChallenge;

  titleEl.textContent = `${routeLabel} | Quantum Frontier Atlas`;
  document.documentElement.lang = isEn ? "en" : "zh-CN";
  shellEl.innerHTML = `
    <section class="panel page-hero">
      <div class="breadcrumb"><a href="./index.html">${isEn ? "Home" : "首页"}</a><span>/</span><strong>${escapeHtml(routeLabel)}</strong></div>
      <div class="page-hero-head">
        <div>
          <p class="eyebrow">Technology Route</p>
          <h1>${escapeHtml(routeLabel)}</h1>
          <p class="hero-text">${escapeHtml(routeSummary)}</p>
        </div>
        <div class="hero-side">
          <div class="hero-chip">
            <span>${isEn ? "Representative Companies" : "代表公司"}</span>
            <strong>${route.companyCount} ${isEn ? "companies" : "家"}</strong>
          </div>
          <div class="hero-chip">
            <span>${isEn ? "Keywords" : "关键词"}</span>
            <strong>${escapeHtml(routeTags.join(" / "))}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="route-metrics">
      <article class="route-metric-chip">${detailMetric(isEn ? "Company Count" : "代表公司数", route.companyCount)}</article>
      <article class="route-metric-chip">${detailMetric(isEn ? "Maturity" : "成熟度", routeMaturity)}</article>
      <article class="route-metric-chip">${detailMetric(isEn ? "Typical Use Cases" : "典型场景", routeBestFor)}</article>
      <article class="route-metric-chip">${detailMetric(isEn ? "Main Challenge" : "主要挑战", routeMainChallenge)}</article>
    </section>

    <section class="panel route-detail-layout">
      <div class="route-columns">
        <article class="mini-panel">
          <p class="eyebrow">Advantages</p>
          <h3>${isEn ? "Advantages" : "路线优点"}</h3>
          <ul class="bullet-list">
            ${routeAdvantages.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
        <article class="mini-panel">
          <p class="eyebrow">Trade-offs</p>
          <h3>${isEn ? "Trade-offs" : "路线难点"}</h3>
          <ul class="bullet-list">
            ${routeDrawbacks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>
    </section>

    <section class="panel companies-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Companies</p>
          <h2>${isEn ? `${escapeHtml(routeLabel)} Companies` : `${escapeHtml(routeLabel)} 相关公司`}</h2>
        </div>
        <p class="section-note">${isEn ? "Click any company card to open its dedicated research page." : "点击任一公司卡片进入独立公司介绍页。"}</p>
      </div>
      <div class="company-grid">${route.companies.map((company) => renderCompanyCard(company)).join("")}</div>
    </section>
  `;
}

function renderNotFound(message) {
  const isEn = getLanguage() === "en";
  return `
    <section class="panel page-hero">
      <div class="detail-placeholder">
        <p class="eyebrow">Not Found</p>
        <h3>${escapeHtml(message)}</h3>
        <p><a href="./index.html">${isEn ? "Back to Home" : "返回首页"}</a></p>
      </div>
    </section>
  `;
}

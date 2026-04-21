import {
  escapeHtml,
  fetchNewsPayload,
  fetchPayload,
  getLanguage,
  localized,
  mountLanguageSwitcher,
  renderNewsCards,
  renderNewsError,
  renderNewsLoading,
  renderCompanyCard,
} from "./shared.js";

const state = {
  payload: null,
  filteredCompanies: [],
};

const routeGridEl = document.querySelector("#route-grid");
const companyGridEl = document.querySelector("#company-grid");
const searchInputEl = document.querySelector("#search-input");
const globalNewsGridEl = document.querySelector("#global-news-grid");

init();

async function init() {
  mountLanguageSwitcher();
  const payload = await fetchPayload();
  state.payload = payload;
  state.filteredCompanies = payload.companies;

  renderStaticCopy();
  renderRouteGrid(payload.routes);
  renderCompanyGrid();
  renderGlobalNews();
  bindEvents();
}

function renderStaticCopy() {
  const isEn = getLanguage() === "en";
  document.documentElement.lang = isEn ? "en" : "zh-CN";
  document.title = isEn ? "The Quantum Frontier Tracker" : "量子计算动态追踪";
  const metaDescription = document.querySelector("meta[name='description']");
  if (metaDescription) {
    metaDescription.content = isEn
      ? "The Quantum Frontier Tracker maps U.S.-listed quantum companies, technology routes, market context and recent news in a structured public research website."
      : "The Quantum Frontier Tracker 聚焦美股量子公司与关键技术路线，用结构化方式展示量子计算产业的公司格局、技术分化与研究判断。";
  }

  document.querySelector("[data-i18n='hero-title']").textContent = isEn
    ? "Quantum Computing Frontier Tracker"
    : "量子计算动态追踪";
  document.querySelector("[data-i18n='hero-text']").textContent = isEn
    ? "A public research website for U.S.-listed quantum companies. It organizes the industry by technology route, then connects each route to company-level research pages covering business progress, financial context, live prices and recent news."
    : "这是一个围绕美股量子公司建立的研究型网站，重点追踪不同技术路线的竞争格局、商业化进展与代表性公司。网站按照硬件路线来组织内容，让访问者可以从超导、离子阱、中性原子、光子与量子安全等方向切入，再延伸到每家公司的独立研究页面。";
  document.querySelector("[data-i18n='site-position-label']").textContent = isEn ? "Site Focus" : "网站定位";
  document.querySelector("[data-i18n='site-position-value']").textContent = isEn
    ? "Public quantum-industry research index"
    : "面向公开阅读的量子产业研究索引";
  document.querySelector("[data-i18n='reading-label']").textContent = isEn ? "Reading Path" : "阅读方式";
  document.querySelector("[data-i18n='reading-value']").textContent = isEn
    ? "Start with routes, then open companies"
    : "先看路线，再进入公司";
  document.querySelector("[data-i18n='news-title']").textContent = isEn ? "Latest Quantum Industry News" : "量子行业最新新闻";
  document.querySelector("[data-i18n='news-note']").textContent = isEn
    ? "A curated feed of recent quantum-computing, quantum-technology and company-related news to complement the route and company pages."
    : "自动汇总近期与量子计算、量子技术和重点公司相关的新闻，用来补充路线页与公司页的研究视角。";
  document.querySelector("[data-i18n='routes-title']").textContent = isEn ? "Browse Companies by Technology Route" : "按技术路线浏览公司";
  document.querySelector("[data-i18n='routes-note']").textContent = isEn
    ? "Open any route card to review its trade-offs and related companies."
    : "点击任一路线卡片即可进入对应的路线页，查看该路线的优缺点和相关公司。";
  document.querySelector("[data-i18n='coverage-title']").textContent = isEn ? "Company Index" : "公司索引";
  document.querySelector("[data-i18n='search-label']").textContent = isEn ? "Search companies" : "搜索公司";
  searchInputEl.placeholder = isEn ? "e.g. IonQ, IBM, Quantinuum" : "例如 IonQ、IBM、Quantinuum";
}

function bindEvents() {
  searchInputEl.addEventListener("input", (event) => {
    const keyword = event.target.value.trim().toLowerCase();
    state.filteredCompanies = state.payload.companies.filter((company) => {
      return [
        company.name,
        localized(company, "industry"),
        localized(company, "summary"),
        localized(company.route, "label"),
        localized(company.route, "shortLabel"),
        localized(company.route, "tags")?.join(" "),
        company.sections?.notes,
        company.sections?.business_analysis,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });

    renderCompanyGrid();
  });
}

function renderRouteGrid(routes) {
  routeGridEl.innerHTML = routes
    .map(
      (route) => {
        const label = localized(route, "label");
        const summary = localized(route, "summary");
        return `
        <article class="route-card link-card">
          <a class="card-link-overlay" href="./route.html?id=${encodeURIComponent(route.slug)}" aria-label="${escapeHtml(
            label
          )}"></a>
          <div class="route-top">
            <div>
              <p class="eyebrow">Route</p>
              <h3>${escapeHtml(label)}</h3>
            </div>
            <span class="tag">${route.companyCount} ${getLanguage() === "en" ? "companies" : "家"}</span>
          </div>
          <p class="route-summary">${escapeHtml(summary)}</p>
        </article>
      `;
      }
    )
    .join("");
}

async function renderGlobalNews() {
  globalNewsGridEl.innerHTML = renderNewsLoading(
    getLanguage() === "en" ? "Loading The Quantum Insider news..." : "正在加载 The Quantum Insider 最新新闻..."
  );

  try {
    const newsPayload = await fetchNewsPayload();
    const articles = newsPayload.latest ?? [];
    globalNewsGridEl.innerHTML = renderNewsCards(
      articles,
      getLanguage() === "en" ? "No related news found yet." : "暂时没有检索到相关新闻。"
    );
  } catch (error) {
    globalNewsGridEl.innerHTML = renderNewsError(
      getLanguage() === "en" ? "Latest news is temporarily unavailable. Please refresh later." : "最新新闻暂时无法加载，请稍后刷新页面。"
    );
  }
}

function renderCompanyGrid() {
  if (!state.filteredCompanies.length) {
    companyGridEl.innerHTML = `<article class="company-card"><p>${escapeHtml(
      getLanguage() === "en" ? "No matching companies found." : "没有找到匹配的公司。"
    )}</p></article>`;
    return;
  }

  companyGridEl.innerHTML = state.filteredCompanies.map((company) => renderCompanyCard(company)).join("");
}

import {
  escapeHtml,
  fetchNewsPayload,
  fetchPayload,
  fetchCompanyDetail,
  getCompanyById,
  getLanguage,
  getParam,
  localized,
  localizedFundamental,
  localizedReport,
  mountLanguageSwitcher,
  mountTradingViewWidget,
  renderNewsCards,
  renderSingleNewsCard,
  renderDetailBlocks,
  renderNewsError,
  renderNewsLoading,
  renderMarkdown,
} from "./shared.js";

const titleEl = document.querySelector("title");
const shellEl = document.querySelector("#company-shell");
let currentCompanyNews = [];

init();

async function init() {
  mountLanguageSwitcher();
  const payload = await fetchPayload();
  const companyId = getParam("id") ?? payload.companies[0]?.id;
  const companyIndex = getCompanyById(payload, companyId);
  const isEn = getLanguage() === "en";

  if (!companyIndex) {
    shellEl.innerHTML = renderNotFound(isEn ? "Company not found" : "未找到对应公司");
    return;
  }

  const company = await fetchCompanyDetail(companyIndex);
  const routeLabel = localized(company.route, "label");
  const routeSummary = localized(company.route, "summary");
  const latestReport = company.earningsReports?.[company.earningsReports.length - 1];
  const latestReportLabel = latestReport ? localizedReport(latestReport, "label") : company.latestQuarterLabel;

  titleEl.textContent = `${company.name} | Quantum Frontier Atlas`;
  document.documentElement.lang = isEn ? "en" : "zh-CN";
  shellEl.innerHTML = `
    <section class="panel page-hero">
      <div class="breadcrumb"><a href="./index.html">${isEn ? "Home" : "首页"}</a><span>/</span><a href="./route.html?id=${encodeURIComponent(
        company.route.slug
      )}">${escapeHtml(routeLabel)}</a><span>/</span><strong>${escapeHtml(company.name)}</strong></div>
      <div class="page-hero-head">
        <div>
          <p class="eyebrow">Company Research</p>
          <h1>${escapeHtml(company.name)}</h1>
          <p class="hero-text">${escapeHtml(buildCompanyIntro(company))}</p>
        </div>
        <div class="hero-side">
          <div class="hero-chip">
            <span>${isEn ? "Primary Route" : "主要路线"}</span>
            <strong><a href="./route.html?id=${encodeURIComponent(company.route.slug)}">${escapeHtml(
              routeLabel
            )}</a></strong>
          </div>
          <div class="hero-chip">
            <span>${isEn ? "Latest Quarter" : "最新季度"}</span>
            <strong>${escapeHtml(latestReportLabel ?? (isEn ? "Not disclosed" : "未披露"))}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="live-grid">
      <article class="panel live-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Live Price</p>
            <h2>${isEn ? "Live Stock Price" : "实时股价"}</h2>
          </div>
          <p class="section-note">${escapeHtml(company.ticker ?? (isEn ? "Ticker not configured" : "当前未配置股票代码"))}</p>
        </div>
        <div id="price-widget" class="price-widget-shell">
          <div class="news-card news-empty"><p>${isEn ? "Loading price widget..." : "正在加载股价模块..."}</p></div>
        </div>
        ${
          company.ticker
            ? `<a class="widget-link" href="https://www.tradingview.com/symbols/${encodeURIComponent(
                company.ticker.replace(":", "-")
              )}/" target="_blank" rel="noreferrer">${isEn ? "If the embedded chart does not load, open it on TradingView" : "如果嵌入行情没有显示，可在 TradingView 查看"}</a>`
            : ""
        }
      </article>

      <article class="panel live-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Latest Company News</p>
            <h2>${isEn ? "Latest Company News" : "公司最近新闻"}</h2>
          </div>
        </div>
        <div id="company-news-grid" class="news-grid compact-news">
          ${renderNewsLoading(isEn ? "Loading company news..." : "正在获取公司相关新闻...")}
        </div>
        <button id="toggle-company-news" class="button ghost full-width company-news-toggle" type="button" hidden>
          ${isEn ? "View More News" : "查看更多新闻"}
        </button>
        <div id="company-news-more" class="news-grid more-news-grid" hidden></div>
      </article>
    </section>

    <section class="panel detail-layout">
      <div class="detail-main">
        <section class="detail-block detail-block-first">
          <h2>${isEn ? "Fundamental Analysis" : "基本面分析"}</h2>
        </section>
        ${renderDetailBlocks(company)}
        ${renderEarningsReports(company, isEn)}
      </div>
      <aside class="detail-side">
        <div class="detail-sticky">
          <div class="mini-panel financial-side-panel">
            <p class="eyebrow">Financial Metrics</p>
            <h3>${isEn ? "Financial & Valuation Snapshot" : "财务与估值指标"}</h3>
            <div class="financial-grid financial-grid-side">
              ${renderFinancialMetrics(company, isEn)}
            </div>
          </div>
          <div class="mini-panel">
            <p class="eyebrow">Route Note</p>
            <h3>${escapeHtml(routeLabel)}</h3>
            <p class="metric-sub">${escapeHtml(routeSummary)}</p>
            <a class="button ghost full-width" href="./route.html?id=${encodeURIComponent(company.route.slug)}">${isEn ? "Open Route Page" : "查看路线全页"}</a>
          </div>
        </div>
      </aside>
    </section>
  `;

  setupEarningsSelector(company);
  setupLiveModules(company);
}

function buildCompanyIntro(company) {
  const source = String(localized(company, "summary") || localizedFundamental(company, "business") || "").trim();
  if (!source) {
    return getLanguage() === "en"
      ? "The company continues to invest in quantum hardware, software or platform capabilities, with more detailed analysis below."
      : "该公司在量子方向上持续推进硬件、软件或平台布局，并围绕商业化落地与关键技术里程碑进行长期投入。更详细的基本面分析可在下方模块查看。";
  }

  const normalized = source
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/目前主要业务[:：]?/g, "")
    .trim();

  const sentences = normalized
    .split(/(?<=[。！？.!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.length > 10)
    .slice(0, 3);

  const intro = sentences.join("");
  return intro || normalized.slice(0, 180);
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

function renderFinancialMetrics(company, isEn) {
  const metrics = company.financialMetrics ?? [];
  if (!metrics.length) {
    return `<article class="financial-card"><span>${isEn ? "No data" : "暂无数据"}</span><strong>${isEn ? "Not disclosed" : "未披露"}</strong></article>`;
  }

  return metrics
    .map((metric) => {
      const label = isEn ? metric.i18n?.en?.label ?? metric.label : metric.label;
      const value = isEn ? metric.i18n?.en?.value ?? metric.value : metric.value;
      const source = metric.source ? `<small>${escapeHtml(metric.source)}</small>` : "";
      return `
        <article class="financial-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          ${source}
        </article>
      `;
    })
    .join("");
}

function renderEarningsReports(company, isEn) {
  const reports = company.earningsReports ?? [];
  if (!reports.length) {
    return "";
  }

  const latestReport = reports[reports.length - 1];
  return `
    <section class="detail-block earnings-block">
      <div class="earnings-head">
        <div>
          <p class="eyebrow">Earnings Notes</p>
          <h3>${isEn ? "Quarterly / Annual Reports" : "季度 / 年度财报总结"}</h3>
        </div>
        <label class="earnings-select">
          <span>${isEn ? "Select report" : "选择财报"}</span>
          <select id="earnings-report-select">
            ${reports
              .map(
                (report) =>
                  `<option value="${escapeHtml(report.key)}" ${report.key === latestReport.key ? "selected" : ""}>${escapeHtml(localizedReport(report, "label"))}</option>`
              )
              .join("")}
          </select>
        </label>
      </div>
      <div id="earnings-report-content" class="markdown-body">
        ${renderMarkdown(localizedReport(latestReport, "content"))}
      </div>
    </section>
  `;
}

function setupEarningsSelector(company) {
  const selectEl = document.querySelector("#earnings-report-select");
  const contentEl = document.querySelector("#earnings-report-content");
  if (!selectEl || !contentEl) {
    return;
  }

  selectEl.addEventListener("change", () => {
    const report = (company.earningsReports ?? []).find((item) => item.key === selectEl.value);
    contentEl.innerHTML = renderMarkdown(localizedReport(report, "content"));
  });
}

async function setupLiveModules(company) {
  const priceWidgetEl = document.querySelector("#price-widget");
  const companyNewsGridEl = document.querySelector("#company-news-grid");
  const companyNewsMoreEl = document.querySelector("#company-news-more");
  const toggleCompanyNewsEl = document.querySelector("#toggle-company-news");
  const isEn = getLanguage() === "en";

  if (company.ticker) {
    mountTradingViewWidget(priceWidgetEl, company.ticker);
  } else {
    priceWidgetEl.innerHTML = renderNewsError(isEn ? "No ticker has been configured for this company." : "当前未配置该公司的股票代码。");
  }

  try {
    const newsPayload = await fetchNewsPayload();
    const articles = newsPayload.companies?.[company.id] ?? [];
    currentCompanyNews = articles;
    companyNewsGridEl.innerHTML = renderSingleNewsCard(articles[0]);

    if (articles.length > 1) {
      toggleCompanyNewsEl.hidden = false;
      toggleCompanyNewsEl.addEventListener("click", () => {
        const expanded = toggleCompanyNewsEl.getAttribute("data-expanded") === "true";
        if (expanded) {
          companyNewsMoreEl.hidden = true;
          companyNewsMoreEl.innerHTML = "";
          toggleCompanyNewsEl.textContent = isEn ? "View More News" : "查看更多新闻";
          toggleCompanyNewsEl.setAttribute("data-expanded", "false");
          return;
        }

        companyNewsMoreEl.hidden = false;
        companyNewsMoreEl.innerHTML = renderNewsCards(currentCompanyNews.slice(1), isEn ? "No more news." : "暂无更多新闻。");
        toggleCompanyNewsEl.textContent = isEn ? "Collapse News" : "收起更多新闻";
        toggleCompanyNewsEl.setAttribute("data-expanded", "true");
      });
    }
  } catch (error) {
    companyNewsGridEl.innerHTML = renderNewsError(isEn ? "Company news is temporarily unavailable. Please refresh later." : "公司新闻暂时无法加载，请稍后刷新页面。");
  }
}

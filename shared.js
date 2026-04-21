export const DATA_PATH = "./data/companies.json";
export const NEWS_PATH = "./data/news.json";
const DATA_VERSION = "20260421-7";
const LANGUAGE_KEY = "quantum-frontier-language";

const UI_TEXT = {
  zh: {
    undisclosed: "未披露",
    quantum: "量子公司",
    enterCompany: "进入公司页",
    noSummary: "暂无摘要",
    noNews: "暂无新闻。",
    noRecentCompanyNews: "最近暂未检索到相关新闻。",
    loadingNews: "正在加载最新新闻...",
    newsError: "新闻暂时无法加载。",
    tradingViewCaption: "行情组件来自 TradingView",
    languageLabel: "语言",
    chinese: "中文",
    english: "English",
  },
  en: {
    undisclosed: "Not disclosed",
    quantum: "Quantum company",
    enterCompany: "Open company page",
    noSummary: "No summary available",
    noNews: "No news found.",
    noRecentCompanyNews: "No recent company news found.",
    loadingNews: "Loading latest news...",
    newsError: "News is temporarily unavailable.",
    tradingViewCaption: "Market widget by TradingView",
    languageLabel: "Language",
    chinese: "中文",
    english: "English",
  },
};

function versionedPath(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${DATA_VERSION}`;
}

export function getLanguage() {
  return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
}

export function setLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, language === "en" ? "en" : "zh");
}

export function t(key) {
  return UI_TEXT[getLanguage()]?.[key] ?? UI_TEXT.zh[key] ?? key;
}

export function localized(entity, key) {
  const language = getLanguage();
  if (language === "en") {
    return entity?.i18n?.en?.[key] ?? entity?.[key];
  }
  return entity?.[key];
}

export function localizedFundamental(company, key) {
  const language = getLanguage();
  if (language === "en") {
    return company?.fundamentalAnalysisI18n?.en?.[key] ?? company?.fundamentalAnalysis?.[key];
  }
  return company?.fundamentalAnalysis?.[key];
}

export function localizedArticleTitle(article) {
  const language = getLanguage();
  return language === "zh" ? article?.titleZh ?? article?.title : article?.titleEn ?? article?.title;
}

export function localizedReport(report, key) {
  const language = getLanguage();
  if (language === "en") {
    return report?.i18n?.en?.[key] ?? report?.[key];
  }
  return report?.[key];
}

export function mountLanguageSwitcher() {
  if (document.querySelector(".language-switcher")) {
    return;
  }

  const current = getLanguage();
  const switcher = document.createElement("div");
  switcher.className = "language-switcher";
  switcher.setAttribute("aria-label", t("languageLabel"));
  switcher.innerHTML = `
    <button type="button" data-lang="zh" class="${current === "zh" ? "active" : ""}">${t("chinese")}</button>
    <button type="button" data-lang="en" class="${current === "en" ? "active" : ""}">${t("english")}</button>
  `;
  switcher.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-lang]");
    if (!button) return;
    const nextLanguage = button.dataset.lang;
    if (nextLanguage === getLanguage()) return;
    setLanguage(nextLanguage);
    window.location.reload();
  });
  document.body.append(switcher);
}

export async function fetchPayload() {
  const response = await fetch(versionedPath(DATA_PATH), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load data: ${response.status}`);
  }
  return response.json();
}

export async function fetchNewsPayload() {
  const response = await fetch(versionedPath(NEWS_PATH), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load news: ${response.status}`);
  }
  return response.json();
}

export async function fetchCompanyDetail(companyIndex) {
  if (!companyIndex?.file) {
    throw new Error("Company detail file is missing.");
  }

  const response = await fetch(versionedPath(companyIndex.file), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load company detail: ${response.status}`);
  }
  return response.json();
}

export function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function getCompanyById(payload, companyId) {
  return payload.companies.find((company) => company.id === companyId) ?? null;
}

export function getRouteBySlug(payload, routeSlug) {
  return payload.routes.find((route) => route.slug === routeSlug) ?? null;
}

export function safeText(value) {
  return value === null || value === undefined || value === "" ? t("undisclosed") : String(value);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function truncate(text, length) {
  if (!text) return text;
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

export function formatNumber(value) {
  return new Intl.NumberFormat(getLanguage() === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function shortenLink(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.slice(0, 64);
  } catch {
    return url;
  }
}

export function detailMetric(label, value) {
  return `
    <div class="detail-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(safeText(value))}</strong>
    </div>
  `;
}

export function renderMarkdown(content) {
  if (!content) return "";

  const lines = String(content).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = null;

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const inline = (text) => escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 2, 4);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inline(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^(?:\d+[.)]|（?\d+(?:\.\d+)?）)\s*(.+)$/);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return html.join("");
}

export function renderCompanyCard(company) {
  const route = company.route ?? {};
  const routeShortLabel = localized(route, "shortLabel") ?? localized(route, "label") ?? localized(company, "industry") ?? "Quantum";
  const routeLabel = localized(route, "label") ?? t("quantum");
  const summary = localized(company, "summary");
  return `
    <article class="company-card link-card">
      <a class="card-link-overlay" href="./company.html?id=${encodeURIComponent(company.id)}" aria-label="${escapeHtml(
        company.name
      )}"></a>
      <div class="company-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(routeShortLabel)}</p>
          <h3>${escapeHtml(company.name)}</h3>
        </div>
        ${
          company.latestQuarterLabel
            ? `<span class="tag">${escapeHtml(company.latestQuarterLabel)}</span>`
            : ""
        }
      </div>
      <p>${escapeHtml(truncate(summary, getLanguage() === "en" ? 150 : 110) ?? t("noSummary"))}</p>
      <div class="company-card-footer">
        <span class="company-route-label">${escapeHtml(routeLabel)}</span>
        <span class="company-enter">${escapeHtml(t("enterCompany"))}</span>
      </div>
    </article>
  `;
}

export function renderDetailBlocks(company) {
  const labels = getLanguage() === "en"
    ? {
        business: "Business",
        ceoMedia: "Official / CEO Updates",
        notes: "Notes",
      }
    : {
        business: "业务情况",
        ceoMedia: "官媒 / CEO 信息",
        notes: "评价与备注",
      };
  return [
    [labels.business, localizedFundamental(company, "business") ?? stripSummaryPrefix(company.sections?.business_analysis, company.summary)],
    [labels.ceoMedia, localizedFundamental(company, "ceoMedia") ?? company.sections?.ceo_media_updates],
    [labels.notes, localizedFundamental(company, "notes") ?? company.sections?.notes],
  ]
    .filter(([, content]) => content)
    .map(
      ([title, content]) => `
        <section class="detail-block">
          <h3>${escapeHtml(title)}</h3>
          <div class="markdown-body">${renderMarkdown(content)}</div>
        </section>
      `
    )
    .join("");
}

function stripSummaryPrefix(content, summary) {
  if (!content || !summary) {
    return content;
  }

  const normalizedContent = String(content).trim();
  const normalizedSummary = String(summary).trim();
  if (!normalizedContent.startsWith(normalizedSummary)) {
    return content;
  }

  const remainder = normalizedContent.slice(normalizedSummary.length).trim();
  return remainder || content;
}

export function renderNewsCards(articles, emptyMessage = t("noNews")) {
  if (!articles.length) {
    return `<article class="news-card news-empty"><p>${escapeHtml(emptyMessage || t("noNews"))}</p></article>`;
  }

  return articles
    .map(
      (article) => `
        <article class="news-card">
          ${article.image ? `<img class="news-image" src="${article.image}" alt="${escapeHtml(localizedArticleTitle(article))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : ""}
          <div class="news-body">
            <p class="eyebrow">News</p>
            <h3><a href="${article.url}" target="_blank" rel="noreferrer">${escapeHtml(localizedArticleTitle(article))}</a></h3>
            <div class="news-meta">
              <span>${escapeHtml(article.source ?? article.domain ?? "News")}</span>
              ${article.date ? `<span>${escapeHtml(article.date)}</span>` : ""}
              ${article.seenDate ? `<span>${escapeHtml(formatSeenDate(article.seenDate))}</span>` : ""}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

export function renderSingleNewsCard(article) {
  if (!article) {
    return `<article class="news-card news-empty"><p>${escapeHtml(t("noRecentCompanyNews"))}</p></article>`;
  }

  return `
    <article class="news-card">
      ${article.image ? `<img class="news-image" src="${article.image}" alt="${escapeHtml(localizedArticleTitle(article))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'" />` : ""}
      <div class="news-body">
        <p class="eyebrow">News</p>
        <h3><a href="${article.url}" target="_blank" rel="noreferrer">${escapeHtml(localizedArticleTitle(article))}</a></h3>
        <div class="news-meta">
          <span>${escapeHtml(article.source ?? "News")}</span>
          ${article.date ? `<span>${escapeHtml(article.date)}</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

export function renderNewsLoading(message = t("loadingNews")) {
  return `<article class="news-card news-empty"><p>${escapeHtml(message)}</p></article>`;
}

export function renderNewsError(message = t("newsError")) {
  return `<article class="news-card news-empty"><p>${escapeHtml(message)}</p></article>`;
}

export function mountTradingViewWidget(container, symbol) {
  if (!container || !symbol) {
    return;
  }

  const iframeUrl = new URL("https://s.tradingview.com/widgetembed/");
  iframeUrl.searchParams.set("frameElementId", `tradingview_${symbol.replace(/[^a-z0-9]/gi, "_")}`);
  iframeUrl.searchParams.set("symbol", symbol);
  iframeUrl.searchParams.set("interval", "D");
  iframeUrl.searchParams.set("hidesidetoolbar", "0");
  iframeUrl.searchParams.set("symboledit", "0");
  iframeUrl.searchParams.set("saveimage", "0");
  iframeUrl.searchParams.set("toolbarbg", "0b1626");
  iframeUrl.searchParams.set("theme", "dark");
  iframeUrl.searchParams.set("style", "1");
  iframeUrl.searchParams.set("timezone", "Etc/UTC");
  iframeUrl.searchParams.set("withdateranges", "1");
  iframeUrl.searchParams.set("studies", "[]");
  iframeUrl.searchParams.set("hideideas", "1");
  iframeUrl.searchParams.set("enable_publishing", "0");
  iframeUrl.searchParams.set("allow_symbol_change", "0");
  iframeUrl.searchParams.set("locale", getLanguage() === "en" ? "en" : "zh_CN");

  container.innerHTML = `
    <iframe
      class="price-iframe"
      title="${escapeHtml(symbol)} chart"
      src="${iframeUrl.toString()}"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowtransparency="true"
      frameborder="0">
    </iframe>
    <div class="widget-caption">${escapeHtml(t("tradingViewCaption"))}</div>
  `;
}

function formatSeenDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return value;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

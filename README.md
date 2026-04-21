# The Quantum Frontier Tracker

基于 `量子公司调研 （美股）-20260309.xlsx` 生成的静态研究网站，用来展示美股量子公司、技术路线、公司基本面、实时股价、最新新闻与季度财报摘要。当前版本适合直接部署到 GitHub Pages。

## 功能

- 中英文双语：右上角可切换中文 / English；公司名称始终保持英文。
- 技术路线页：按超导、离子阱、中性原子、光子、量子退火、拓扑、量子网络与安全、基础设施等路线组织公司。
- 公司详情页：包含简要介绍、基本面分析、财务与估值指标、季度 / 年度财报摘要、实时股价和公司相关新闻。
- 新闻模块：首页显示量子行业新闻，公司页显示对应公司新闻。
- 财务指标：可从 StockAnalysis 抓取当前市值、EV、P/S、EV/Sales、P/E、P/B、现金、债务等公开指标。
- 低安全预览门禁：前端账号密码浮层，适合朋友 / 同事临时查看。
- 静态部署：纯 HTML / CSS / JS，无需前端构建工具。

## 目录结构

- `index.html`：首页入口。
- `company.html`：公司详情页入口。
- `route.html`：技术路线页入口。
- `styles.css`：整体科技感视觉样式。
- `auth.js`：前端简单账号密码门禁。
- `home.js` / `company.js` / `route.js`：页面逻辑。
- `shared.js`：共享数据读取、语言切换、新闻卡片、Markdown 渲染等工具。
- `data/companies.json`：公司索引和路线索引。
- `data/companies/*.json`：每家公司一个独立 JSON，方便单独检查和维护。
- `data/news.json`：本地新闻数据。
- `data/news-images/`：新闻图片缓存。
- `data/market_metrics.json`：公开市场财务指标缓存。
- `scripts/extract_excel.py`：从 Excel 生成公司索引、路线数据和单公司 JSON。
- `scripts/fetch_quantum_news.py`：抓取 The Quantum Insider 新闻，并可自动翻译新标题。
- `scripts/fetch_stock_metrics.py`：抓取 StockAnalysis 财务与估值指标。
- `.nojekyll`：让 GitHub Pages 按普通静态文件发布。

## 本地预览

在 `website_development` 目录执行：

```bash
/opt/anaconda3/bin/python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

如果页面没有更新，建议浏览器强制刷新，避免旧的 JS / JSON 缓存。

## 前端简单密码页

当前网站已经接入一个低安全需求的前端门禁。默认账号和密码写在 `auth.js`：

```js
const ACCESS_USERNAME = "quantum";
const ACCESS_PASSWORD = "quantum2026";
```

如果要修改访问口令，直接改这两个值即可。登录状态保存在浏览器当前标签页的 `sessionStorage` 中；如果想退出，可以在网址后面加：

```text
?logout=1
```

重要提醒：这只是前端遮罩，不是真正的权限系统。部署到 GitHub Pages 后，懂技术的人仍然可以在浏览器开发者工具里看到 `auth.js`、JSON 数据和页面源码。因此它适合“只给朋友 / 同事看、低安全需求”的场景，不适合放敏感信息。如果以后要真正限制访问，需要改用带服务端认证的平台，例如 Cloudflare Access、Vercel Password Protection、Netlify Identity，或自己搭一个后端登录系统。

## 更新公司数据

当 Excel 内容更新后，运行：

```bash
cd /Users/luobin/Documents/量子公司分析/website_development
/opt/anaconda3/bin/python3 scripts/extract_excel.py
```

这会重新生成：

- `data/companies.json`
- `data/companies/*.json`

注意：单公司 JSON 是由脚本生成的。如果直接手改 `data/companies/*.json`，下次运行 `extract_excel.py` 会被覆盖。长期内容建议改 Excel 或改 `scripts/extract_excel.py` 里的整理逻辑。

## 更新新闻

更新 The Quantum Insider 新闻：

```bash
cd /Users/luobin/Documents/量子公司分析/website_development
/opt/anaconda3/bin/python3 scripts/fetch_quantum_news.py
```

脚本会更新：

- `data/news.json`
- `data/news-images/`

### 自动翻译新标题

脚本会优先复用 `data/news.json` 里已有的 `titleZh`。如果抓到新英文标题，可以设置 `OPENAI_API_KEY` 自动批量翻译成中文：

```bash
export OPENAI_API_KEY="你的 API key"
/opt/anaconda3/bin/python3 scripts/fetch_quantum_news.py
```

可选配置：

```bash
export NEWS_TRANSLATION_MODEL="gpt-5"
NEWS_TRANSLATE_TITLES=0 /opt/anaconda3/bin/python3 scripts/fetch_quantum_news.py
```

`NEWS_TRANSLATION_MODEL` 用来指定翻译模型；`NEWS_TRANSLATE_TITLES=0` 用来临时关闭自动翻译。

## 更新财务指标

刷新公开市场指标：

```bash
cd /Users/luobin/Documents/量子公司分析/website_development
/opt/anaconda3/bin/python3 scripts/fetch_stock_metrics.py
/opt/anaconda3/bin/python3 scripts/extract_excel.py
```

第一条命令从 StockAnalysis 更新 `data/market_metrics.json`。第二条命令把最新指标合并进每家公司 JSON。

Quantinuum 目前不是独立上市公司，公开市场指标使用 Honeywell `HON` 作为母公司口径。

## 推荐完整更新流程

如果想一次性更新新闻、财务指标和公司 JSON：

```bash
cd /Users/luobin/Documents/量子公司分析/website_development
export OPENAI_API_KEY="你的 API key"
/opt/anaconda3/bin/python3 scripts/fetch_quantum_news.py
/opt/anaconda3/bin/python3 scripts/fetch_stock_metrics.py
/opt/anaconda3/bin/python3 scripts/extract_excel.py
```

如果不需要自动翻译新闻标题：

```bash
NEWS_TRANSLATE_TITLES=0 /opt/anaconda3/bin/python3 scripts/fetch_quantum_news.py
/opt/anaconda3/bin/python3 scripts/fetch_stock_metrics.py
/opt/anaconda3/bin/python3 scripts/extract_excel.py
```

## 部署到 GitHub Pages

最简单的方式：

1. 把 `website_development` 目录中的内容放到 GitHub 仓库根目录。
2. 确认 `.nojekyll` 文件存在。
3. 在 GitHub 仓库里进入 `Settings` -> `Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择你的主分支，例如 `main`，目录选择 `/ (root)`。

如果你想保留其他项目文件，也可以把这些网站文件放到仓库的 `docs/` 目录，然后在 Pages 设置里选择 `/docs`。

## 维护备注

- 网站是静态站点，实时股价使用 TradingView 嵌入组件，不需要自己维护行情 API。
- 新闻和财务指标是抓取后写成本地 JSON，因此 GitHub Pages 上展示的是最近一次运行脚本时的数据。
- `shared.js` 里有 `DATA_VERSION`，如果浏览器缓存特别顽固，可以改这个版本号强制刷新数据文件。
- 基本面分析支持轻量 Markdown：标题、编号、列表、链接和换行都会被渲染。
- 如果未来公司数量明显增加，可以再迁移到 Vite / React / Next.js；当前版本的优点是轻、稳、部署简单。

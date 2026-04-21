from __future__ import annotations

import json
import re
import hashlib
import os
import shutil
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
COMPANIES_JSON = ROOT / "data" / "companies.json"
OUTPUT_JSON = ROOT / "data" / "news.json"
IMAGE_DIR = ROOT / "data" / "news-images"
DAILY_IMAGE_DIR = IMAGE_DIR / "daily"
COMPANY_IMAGE_DIR = IMAGE_DIR / "companies"

BASE_URL = "https://thequantuminsider.com"
DAILY_URL = f"{BASE_URL}/category/daily/"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_TRANSLATION_MODEL = "gpt-5"
GENERIC_DAILY_MATCH_TERMS = {
    "quantum computing",
    "quantum computing inc",
    "azure quantum",
    "intel quantum",
    "skywater quantum",
}


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="ignore")


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = unescape(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def parse_articles(html: str, max_items: int = 12) -> list[dict[str, Any]]:
    articles = []
    seen_urls = set()
    for match in re.finditer(r"<article\b.*?</article>", html, flags=re.S | re.I):
        block = match.group(0)

        href_match = re.search(r'href="([^"]+)"', block)
        title_match = re.search(
            r'<h\d[^>]*class="[^"]*elementor-post__title[^"]*"[^>]*>\s*<a[^>]*>(.*?)</a>',
            block,
            flags=re.S | re.I,
        )
        date_match = re.search(
            r'<span[^>]*class="[^"]*elementor-post-date[^"]*"[^>]*>(.*?)</span>',
            block,
            flags=re.S | re.I,
        )
        image_match = re.search(
            r'<img[^>]+(?:src|data-src|data-lazy-src)="([^"]+)"',
            block,
            flags=re.I,
        )

        if not href_match or not title_match:
            continue

        url = href_match.group(1).strip()
        if url in seen_urls:
            continue
        seen_urls.add(url)

        title = clean_text(title_match.group(1))
        if not title:
            continue

        articles.append(
            {
                "title": title,
                "url": url,
                "image": image_match.group(1).strip() if image_match else "",
                "date": clean_text(date_match.group(1)) if date_match else "",
                "source": "The Quantum Insider",
            }
        )

        if len(articles) >= max_items:
            break

    return articles


def date_slug(date_text: str) -> str:
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(date_text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def filter_latest_day_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not articles:
        return []

    latest_date = articles[0].get("date", "")
    if not latest_date:
        return articles

    return [article for article in articles if article.get("date") == latest_date]


def extract_meta_image(html: str) -> str:
    patterns = [
        r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"',
        r'<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"',
        r'<meta[^>]+property="og:image:url"[^>]+content="([^"]+)"',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.I)
        if match:
            return match.group(1).strip()
    return ""


def enrich_missing_images(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for article in articles:
        if article.get("image"):
            continue
        try:
            html = fetch_html(article["url"])
            article["image"] = extract_meta_image(html)
        except Exception:
            article["image"] = article.get("image", "")
    return articles


def image_filename(url: str) -> str:
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        suffix = ".jpg"
    return f"{hashlib.sha1(url.encode('utf-8')).hexdigest()}{suffix}"


def download_image(url: str, target_dir: Path, public_prefix: str) -> str:
    if not url:
        return ""

    filename = image_filename(url)
    target = target_dir / filename
    if target.exists():
        return f"{public_prefix}/{filename}"

    target_dir.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": USER_AGENT, "Referer": BASE_URL})
    with urlopen(request, timeout=30) as response:
        target.write_bytes(response.read())
    return f"{public_prefix}/{filename}"


def localize_images(articles: list[dict[str, Any]], target_dir: Path, public_prefix: str) -> list[dict[str, Any]]:
    for article in articles:
        image_url = article.get("image", "")
        if not image_url:
            continue
        try:
            article["remoteImage"] = image_url
            article["image"] = download_image(image_url, target_dir, public_prefix)
        except Exception:
            article["remoteImage"] = image_url
    return articles


def reset_daily_image_cache() -> None:
    if DAILY_IMAGE_DIR.exists():
        shutil.rmtree(DAILY_IMAGE_DIR)
    DAILY_IMAGE_DIR.mkdir(parents=True, exist_ok=True)


def load_companies() -> list[dict[str, Any]]:
    payload = json.loads(COMPANIES_JSON.read_text(encoding="utf-8"))
    return payload["companies"]


def load_existing_title_i18n() -> dict[str, dict[str, str]]:
    if not OUTPUT_JSON.exists():
        return {}

    try:
        existing = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    title_i18n = {}
    article_groups = [existing.get("latest", [])]
    article_groups.extend(existing.get("companies", {}).values())
    for articles in article_groups:
        for article in articles:
            title = article.get("title")
            if not title:
                continue
            title_i18n[title] = {
                "titleEn": article.get("titleEn", title),
                "titleZh": article.get("titleZh", title),
            }
    return title_i18n


def load_existing_company_news() -> dict[str, list[dict[str, Any]]]:
    if not OUTPUT_JSON.exists():
        return {}

    try:
        existing = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    companies = existing.get("companies", {})
    if not isinstance(companies, dict):
        return {}
    return {
        str(company_id): articles
        for company_id, articles in companies.items()
        if isinstance(articles, list)
    }


def has_chinese(value: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", value))


def title_needs_translation(title: str, translations: dict[str, dict[str, str]]) -> bool:
    translated = translations.get(title, {}).get("titleZh", "")
    return not translated or translated == title or not has_chinese(translated)


def extract_response_text(payload: dict[str, Any]) -> str:
    if payload.get("output_text"):
        return str(payload["output_text"])

    chunks = []
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                chunks.append(content["text"])
    return "\n".join(chunks).strip()


def parse_translation_response(text: str) -> dict[str, str]:
    text = text.strip()
    if not text:
        return {}

    json_match = re.search(r"\{.*\}", text, flags=re.S)
    if json_match:
        text = json_match.group(0)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    translations = parsed.get("translations", parsed)
    if not isinstance(translations, dict):
        return {}

    return {str(key): clean_text(str(value)) for key, value in translations.items() if value}


def translate_titles_with_openai(titles: list[str]) -> dict[str, str]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key or os.environ.get("NEWS_TRANSLATE_TITLES") == "0":
        return {}

    model = os.environ.get("NEWS_TRANSLATION_MODEL", DEFAULT_TRANSLATION_MODEL)
    title_payload = {str(index): title for index, title in enumerate(titles)}
    request_payload = {
        "model": model,
        "store": False,
        "temperature": 0,
        "instructions": (
            "You translate quantum-industry news headlines from English to concise Simplified Chinese. "
            "Keep company names, ticker symbols, product names, organization names, platform names, and acronyms in English. "
            "Do not add explanations. Return valid JSON only."
        ),
        "input": (
            "Translate each headline value into Simplified Chinese. "
            "Return a JSON object with a single key `translations`, preserving the same numeric string keys.\n\n"
            f"{json.dumps(title_payload, ensure_ascii=False)}"
        ),
    }
    request = Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )

    with urlopen(request, timeout=60) as response:
        response_payload = json.loads(response.read().decode("utf-8"))

    translated_by_index = parse_translation_response(extract_response_text(response_payload))
    return {
        title: translated_by_index.get(str(index), title)
        for index, title in enumerate(titles)
        if translated_by_index.get(str(index))
    }


def translate_missing_titles(title_i18n: dict[str, dict[str, str]], article_groups: list[list[dict[str, Any]]]) -> dict[str, dict[str, str]]:
    missing_titles = []
    seen = set()
    for articles in article_groups:
        for article in articles:
            title = article.get("title", "")
            if not title or title in seen:
                continue
            seen.add(title)
            if title_needs_translation(title, title_i18n):
                missing_titles.append(title)

    if not missing_titles:
        return title_i18n

    try:
        translated = translate_titles_with_openai(missing_titles)
    except Exception as error:
        print(f"Title translation skipped: {error}")
        translated = {}

    if not translated:
        print(
            "Title translation skipped: set OPENAI_API_KEY to translate newly fetched English headlines automatically."
        )
        return title_i18n

    for title in missing_titles:
        title_i18n[title] = {
            "titleEn": title,
            "titleZh": translated.get(title, title),
        }
    print(f"Translated {len(translated)} new headline(s).")
    return title_i18n


def apply_existing_title_i18n(articles: list[dict[str, Any]], title_i18n: dict[str, dict[str, str]]) -> list[dict[str, Any]]:
    for article in articles:
        title = article.get("title", "")
        translations = title_i18n.get(title, {})
        article["titleEn"] = translations.get("titleEn", title)
        article["titleZh"] = translations.get("titleZh", title)
    return articles


def article_key(article: dict[str, Any]) -> str:
    return str(article.get("url") or article.get("title") or "")


def merge_articles(new_articles: list[dict[str, Any]], existing_articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = []
    seen = set()
    for article in [*new_articles, *existing_articles]:
        key = article_key(article)
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(article)
    return merged


def company_terms(company: dict[str, Any]) -> list[str]:
    terms = {
        company.get("name", ""),
        company.get("newsSearchTerm", ""),
    }
    ticker = str(company.get("ticker", ""))
    if ":" in ticker:
        terms.add(ticker.split(":", 1)[1])
    name_without_ticker = re.sub(r"\s*\([^)]*\)", "", company.get("name", "")).strip()
    terms.add(name_without_ticker)
    return [
        term.lower()
        for term in terms
        if term and len(term) >= 3 and term.lower() not in GENERIC_DAILY_MATCH_TERMS
    ]


def daily_articles_for_company(articles: list[dict[str, Any]], company: dict[str, Any]) -> list[dict[str, Any]]:
    terms = company_terms(company)
    matched = []
    for article in articles:
        haystack = f"{article.get('title', '')} {article.get('url', '')}".lower()
        if any(term in haystack for term in terms):
            matched.append(dict(article))
    return matched


def copy_existing_local_image(article: dict[str, Any], target_dir: Path, public_prefix: str) -> str:
    image_path = str(article.get("image", ""))
    if not image_path.startswith("./data/news-images/"):
        return image_path

    source = ROOT / image_path.removeprefix("./")
    if not source.exists() or not source.is_file():
        return image_path

    filename = source.name
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / filename
    if not target.exists():
        shutil.copy2(source, target)
    return f"{public_prefix}/{filename}"


def localize_company_articles(company_id: str, articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    target_dir = COMPANY_IMAGE_DIR / company_id
    public_prefix = f"./data/news-images/companies/{company_id}"
    for article in articles:
        remote_image = article.get("remoteImage") or article.get("image", "")
        if isinstance(remote_image, str) and remote_image.startswith("http"):
            try:
                article["remoteImage"] = remote_image
                article["image"] = download_image(remote_image, target_dir, public_prefix)
                continue
            except Exception:
                article["remoteImage"] = remote_image

        article["image"] = copy_existing_local_image(article, target_dir, public_prefix)
    return articles


def fetch_latest_news() -> list[dict[str, Any]]:
    html = fetch_html(DAILY_URL)
    articles = filter_latest_day_articles(enrich_missing_images(parse_articles(html, max_items=60)))
    if not articles:
        return []
    slug = date_slug(articles[0].get("date", ""))
    return localize_images(
        articles,
        DAILY_IMAGE_DIR / slug,
        f"./data/news-images/daily/{slug}",
    )


def fetch_company_news(search_term: str, company_id: str) -> list[dict[str, Any]]:
    search_url = f"{BASE_URL}/?s={quote_plus(search_term)}"
    html = fetch_html(search_url)
    articles = enrich_missing_images(parse_articles(html, max_items=6))
    return localize_company_articles(company_id, articles)


def collect_referenced_images(payload: dict[str, Any]) -> set[Path]:
    referenced = set()
    groups = [payload.get("latest", [])]
    groups.extend(payload.get("companies", {}).values())
    for articles in groups:
        for article in articles:
            image = str(article.get("image", ""))
            if image.startswith("./data/news-images/"):
                referenced.add(ROOT / image.removeprefix("./"))
    return referenced


def prune_unreferenced_images(payload: dict[str, Any]) -> None:
    if not IMAGE_DIR.exists():
        return

    referenced = collect_referenced_images(payload)
    for path in IMAGE_DIR.rglob("*"):
        if path.is_file() and path not in referenced:
            path.unlink()


def build_payload() -> dict[str, Any]:
    companies = load_companies()
    title_i18n = load_existing_title_i18n()
    existing_company_news = load_existing_company_news()
    company_news = {}
    reset_daily_image_cache()
    latest_news = fetch_latest_news()

    for company in companies:
        term = company.get("newsSearchTerm") or company["name"]
        try:
            fetched_articles = fetch_company_news(term, company["id"])
        except Exception:
            fetched_articles = []
        matched_daily_articles = localize_company_articles(
            company["id"],
            daily_articles_for_company(latest_news, company),
        )
        company_news[company["id"]] = merge_articles(
            [*matched_daily_articles, *fetched_articles],
            localize_company_articles(company["id"], existing_company_news.get(company["id"], [])),
        )

    article_groups = [latest_news, *company_news.values()]
    title_i18n = translate_missing_titles(title_i18n, article_groups)
    latest_news = apply_existing_title_i18n(latest_news, title_i18n)
    company_news = {
        company_id: apply_existing_title_i18n(articles, title_i18n)
        for company_id, articles in company_news.items()
    }

    payload = {
        "meta": {
            "source": "The Quantum Insider",
            "sourceUrl": DAILY_URL,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "notes": "每日新闻每次更新为 The Quantum Insider 当日全部新闻；公司新闻按公司目录增量保留。",
        },
        "latest": latest_news,
        "companies": company_news,
    }
    prune_unreferenced_images(payload)
    return payload


def main() -> None:
    payload = build_payload()
    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()

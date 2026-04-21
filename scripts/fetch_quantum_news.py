from __future__ import annotations

import json
import re
import hashlib
import os
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

BASE_URL = "https://thequantuminsider.com"
DAILY_URL = f"{BASE_URL}/category/daily/"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_TRANSLATION_MODEL = "gpt-5"


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


def download_image(url: str) -> str:
    if not url:
        return ""

    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        suffix = ".jpg"

    filename = f"{hashlib.sha1(url.encode('utf-8')).hexdigest()}{suffix}"
    target = IMAGE_DIR / filename
    if target.exists():
        return f"./data/news-images/{filename}"

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    request = Request(url, headers={"User-Agent": USER_AGENT, "Referer": BASE_URL})
    with urlopen(request, timeout=30) as response:
        target.write_bytes(response.read())
    return f"./data/news-images/{filename}"


def localize_images(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for article in articles:
        image_url = article.get("image", "")
        if not image_url:
            continue
        try:
            article["remoteImage"] = image_url
            article["image"] = download_image(image_url)
        except Exception:
            article["remoteImage"] = image_url
    return articles


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


def fetch_latest_news() -> list[dict[str, Any]]:
    html = fetch_html(DAILY_URL)
    return localize_images(enrich_missing_images(parse_articles(html, max_items=9)))


def fetch_company_news(search_term: str) -> list[dict[str, Any]]:
    search_url = f"{BASE_URL}/?s={quote_plus(search_term)}"
    html = fetch_html(search_url)
    return localize_images(enrich_missing_images(parse_articles(html, max_items=6)))


def build_payload() -> dict[str, Any]:
    companies = load_companies()
    title_i18n = load_existing_title_i18n()
    company_news = {}

    for company in companies:
        term = company.get("newsSearchTerm") or company["name"]
        try:
            company_news[company["id"]] = fetch_company_news(term)
        except Exception:
            company_news[company["id"]] = []

    latest_news = fetch_latest_news()
    article_groups = [latest_news, *company_news.values()]
    title_i18n = translate_missing_titles(title_i18n, article_groups)
    latest_news = apply_existing_title_i18n(latest_news, title_i18n)
    company_news = {
        company_id: apply_existing_title_i18n(articles, title_i18n)
        for company_id, articles in company_news.items()
    }

    return {
        "meta": {
            "source": "The Quantum Insider",
            "sourceUrl": DAILY_URL,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "notes": "新闻数据由脚本构建时抓取 The Quantum Insider 页面结构生成。",
        },
        "latest": latest_news,
        "companies": company_news,
    }


def main() -> None:
    payload = build_payload()
    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()

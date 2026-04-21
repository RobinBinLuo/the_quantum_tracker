from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_JSON = ROOT / "data" / "market_metrics.json"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

COMPANY_TICKERS = {
    "Google": "GOOGL",
    "IBM": "IBM",
    "Microsoft": "MSFT",
    "IonQ": "IONQ",
    "Quantum Computing (QUBT)": "QUBT",
    "D-Wave Quantum (QBTS)": "QBTS",
    "Rigetti Computing (RGTI)": "RGTI",
    "Arqit Quantum (ARQQ)": "ARQQ",
    "SEALSQ Corp (LAES)": "LAES",
    "Intel (INTC)": "INTC",
    "Quantinuum": "HON",
    "Infleqtion (INFQ)": "INFQ",
    "SkyWater Technology, Inc. (SKYT)": "SKYT",
}

FIELD_MAP = {
    "Market Cap": "marketCap",
    "Enterprise Value": "enterpriseValue",
    "PE Ratio": "pe",
    "PS Ratio": "ps",
    "PB Ratio": "pb",
    "EV / Sales": "evSales",
    "Revenue": "ttmRevenue",
    "Gross Profit": "grossProfit",
    "Gross Margin": "grossMargin",
    "Total Cash": "totalCash",
    "Total Debt": "totalDebt",
    "Net Cash": "netCash",
}


def fetch_html(ticker: str) -> str:
    url = f"https://stockanalysis.com/stocks/{ticker.lower()}/statistics/"
    request = Request(url, headers={"User-Agent": USER_AGENT})
    last_error: Exception | None = None
    for _ in range(3):
        try:
            with urlopen(request, timeout=25) as response:
                return response.read().decode("utf-8", errors="ignore")
        except Exception as error:
            last_error = error
    raise last_error or RuntimeError(f"Failed to fetch {ticker}")


def clean_text(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def extract_cells(row_html: str) -> list[str]:
    cells = []
    for cell in re.findall(r"<td\b[^>]*>.*?</td>", row_html, flags=re.S | re.I):
        text = clean_text(cell)
        cells.append(text)
    return cells


def parse_metrics(html: str) -> dict[str, str]:
    metrics = {}
    for row in re.findall(r"<tr\b.*?</tr>", html, flags=re.S | re.I):
        cells = extract_cells(row)
        if len(cells) < 2:
            continue
        label, value = cells[0], cells[1]
        key = FIELD_MAP.get(label)
        if key and value and value != "-":
            metrics[key] = value
    return metrics


def build_payload() -> dict[str, Any]:
    companies = {}
    for company_name, ticker in COMPANY_TICKERS.items():
        try:
            html = fetch_html(ticker)
            companies[company_name] = {
                "ticker": ticker,
                "source": "StockAnalysis",
                "sourceUrl": f"https://stockanalysis.com/stocks/{ticker.lower()}/statistics/",
                "metrics": parse_metrics(html),
            }
        except Exception as error:
            companies[company_name] = {
                "ticker": ticker,
                "source": "StockAnalysis",
                "sourceUrl": f"https://stockanalysis.com/stocks/{ticker.lower()}/statistics/",
                "metrics": {},
                "error": str(error),
            }

    return {
        "meta": {
            "source": "StockAnalysis",
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "notes": "Public market statistics scraped from StockAnalysis company statistics pages. Values are point-in-time and should be refreshed before publication.",
        },
        "companies": companies,
    }


def main() -> None:
    payload = build_payload()
    OUTPUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()

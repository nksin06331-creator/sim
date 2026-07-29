#!/usr/bin/env python3
"""Update data/prices.json from the current published stock manifest.

The report analysis remains static. Only market quotes in prices.json change.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "index.html"
PRICE_PATH = ROOT / "data" / "prices.json"
USER_AGENT = "Mozilla/5.0 (compatible; SiM-Market-Lab/1.0)"


def load_manifest_path() -> Path:
    html = INDEX_PATH.read_text(encoding="utf-8")
    match = re.search(r'data-manifest-url=["\']([^"\']+)', html)
    if not match:
        raise RuntimeError("data-manifest-url was not found in index.html")
    relative = match.group(1).split("?", 1)[0].lstrip("./")
    path = ROOT / relative
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {path}")
    return path


def yahoo_symbol(stock: dict[str, Any]) -> str:
    ticker = str(stock.get("ticker", "")).strip().upper()
    market = str(stock.get("market", ""))
    if market == "日本株" and not ticker.endswith(".T"):
        return f"{ticker}.T"
    return ticker


def fetch_quote(symbol: str) -> dict[str, Any]:
    encoded = urllib.parse.quote(symbol, safe="")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=1d&range=5d"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response)

    result = payload.get("chart", {}).get("result") or []
    if not result:
        error = payload.get("chart", {}).get("error")
        raise RuntimeError(f"No quote result for {symbol}: {error}")

    item = result[0]
    meta = item.get("meta", {})
    price = meta.get("regularMarketPrice")
    previous_close = meta.get("chartPreviousClose") or meta.get("previousClose")
    market_timestamp = meta.get("regularMarketTime")
    currency = meta.get("currency")

    if price is None:
        closes = ((item.get("indicators", {}).get("quote") or [{}])[0].get("close") or [])
        price = next((value for value in reversed(closes) if value is not None), None)
    if price is None:
        raise RuntimeError(f"Price unavailable for {symbol}")

    change = None
    change_pct = None
    if previous_close not in (None, 0):
        change = float(price) - float(previous_close)
        change_pct = change / float(previous_close) * 100

    market_time = None
    if market_timestamp:
        market_time = datetime.fromtimestamp(int(market_timestamp), tz=timezone.utc).isoformat()

    return {
        "symbol": symbol,
        "price": round(float(price), 4),
        "previousClose": round(float(previous_close), 4) if previous_close is not None else None,
        "change": round(change, 4) if change is not None else None,
        "changePct": round(change_pct, 4) if change_pct is not None else None,
        "currency": currency,
        "marketTime": market_time,
        "status": "ok",
    }


def load_existing() -> dict[str, Any]:
    if not PRICE_PATH.exists():
        return {"prices": {}}
    try:
        return json.loads(PRICE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"prices": {}}


def main() -> None:
    manifest_path = load_manifest_path()
    stocks = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing = load_existing().get("prices", {})
    prices: dict[str, Any] = {}
    errors: dict[str, str] = {}

    published = [stock for stock in stocks if stock.get("status") != "draft" and stock.get("ticker")]
    for index, stock in enumerate(published, start=1):
        ticker = str(stock["ticker"]).strip().upper()
        symbol = yahoo_symbol(stock)
        try:
            quote = fetch_quote(symbol)
            quote["currency"] = quote.get("currency") or stock.get("price", {}).get("currency")
            prices[ticker] = quote
            print(f"[{index}/{len(published)}] {ticker}: {quote['price']} {quote['currency']}")
        except (urllib.error.URLError, TimeoutError, RuntimeError, ValueError, KeyError) as exc:
            errors[ticker] = str(exc)
            fallback = existing.get(ticker)
            if fallback:
                prices[ticker] = {**fallback, "status": "stale"}
            else:
                report_price = stock.get("price", {}).get("current")
                prices[ticker] = {
                    "symbol": symbol,
                    "price": report_price,
                    "previousClose": None,
                    "change": None,
                    "changePct": None,
                    "currency": stock.get("price", {}).get("currency"),
                    "marketTime": stock.get("updated"),
                    "status": "report-fallback",
                }
            print(f"[{index}/{len(published)}] {ticker}: ERROR {exc}")
        time.sleep(0.15)

    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "Yahoo Finance chart endpoint",
        "manifest": manifest_path.relative_to(ROOT).as_posix(),
        "quoteCount": len(prices),
        "errorCount": len(errors),
        "errors": errors,
        "prices": prices,
    }
    PRICE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PRICE_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if not prices:
        raise RuntimeError("No prices were written")


if __name__ == "__main__":
    main()

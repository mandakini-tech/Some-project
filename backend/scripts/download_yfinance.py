#!/usr/bin/env python3
import sys, json, os
from datetime import datetime
import pandas as pd
import yfinance as yf

def ensure_dir(p):
    os.makedirs(p, exist_ok=True)

def download_all(ticker, out_dir):
    ensure_dir(out_dir)

    start = "2020-01-01"
    end = "2025-01-01"
    # Prices
    df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ['_'.join([str(c) for c in col if c]) for col in df.columns]
    df.reset_index(inplace=True)
    price_path = os.path.join(out_dir, f"{ticker}.csv")
    df.to_csv(price_path, index=False)

    # Info
    tk = yf.Ticker(ticker)
    info = tk.fast_info if hasattr(tk, "fast_info") else {}
    full_info = tk.info if hasattr(tk, "info") else {}
    info_obj = {
        "ticker": ticker,
        "sector": full_info.get("sector"),
        "industry": full_info.get("industry"),
        "longName": full_info.get("longName") or full_info.get("shortName"),
        "marketCap": full_info.get("marketCap"),
        "currency": full_info.get("currency") or info.get("currency"),
    }
    info_path = os.path.join(out_dir, f"{ticker}_info.json")
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(info_obj, f, ensure_ascii=False)

    # News (best-effort via .news if available)
    news_items = []
    try:
        if hasattr(tk, "news") and tk.news:
            for n in tk.news[:30]:
                news_items.append({
                    "title": n.get("title"),
                    "publisher": n.get("publisher"),
                    "link": n.get("link"),
                    "providerPublishTime": n.get("providerPublishTime"),
                    "type": n.get("type")
                })
    except Exception:
        pass
    news_path = os.path.join(out_dir, f"{ticker}_news.json")
    with open(news_path, "w", encoding="utf-8") as f:
        json.dump({"ticker": ticker, "downloadedAt": datetime.utcnow().isoformat()+"Z", "news": news_items}, f, ensure_ascii=False)

    print(json.dumps({"ok": True, "price_path": price_path, "info_path": info_path, "news_path": news_path}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing ticker"}))
        sys.exit(1)
    t = sys.argv[1].strip().upper()
    out_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    download_all(t, os.path.abspath(out_dir))

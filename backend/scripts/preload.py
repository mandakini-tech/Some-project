import os
import sys
from download_yfinance import download_data

TICKERS = ["SPY", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM", "NFLX", "AMD"]

def main():
    print(f"Preloading financial data for {len(TICKERS)} tickers...")
    for ticker in TICKERS:
        try:
            download_data(ticker)
        except Exception as e:
            print(f"Failed to preload {ticker}: {e}")
    print("Preload finished!")

if __name__ == "__main__":
    main()

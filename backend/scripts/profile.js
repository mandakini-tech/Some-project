import { analyzeTicker, analyzePortfolioRisk } from "../Services/aiservices.js";
import { loadLocalOrRootCSV, readCSV, tickerPaths, fileExists } from "../utils/fileIO.js";
import fs from "node:fs/promises";
import path from "node:path";

async function runProfile() {
  console.log("=========================================");
  console.log("🚀 STARTING PROFILER");
  console.log("=========================================");

  // 1. Profile CSV file loading
  console.log("\n--- Profiling CSV File Reads & Parsing ---");
  
  const csvPath = tickerPaths("AAPL").csv;
  
  let start = Date.now();
  const rawCsvData1 = await readCSV(csvPath);
  let duration = Date.now() - start;
  console.log(`Read local AAPL.csv (approx. 1258 lines): ${duration}ms`);

  start = Date.now();
  const rawCsvData2 = await readCSV(csvPath);
  duration = Date.now() - start;
  console.log(`Read local AAPL.csv again (no cache): ${duration}ms`);

  // Profile reading root StockPriceDataset.csv
  start = Date.now();
  const rootRows1 = await loadLocalOrRootCSV("TSLA"); // Should load from root since it doesn't exist locally yet
  duration = Date.now() - start;
  console.log(`Load TSLA from StockPriceDataset.csv (2.8MB, first read/parse): ${duration}ms`);

  start = Date.now();
  const rootRows2 = await loadLocalOrRootCSV("NVDA"); // Will read/parse root CSV again
  duration = Date.now() - start;
  console.log(`Load NVDA from StockPriceDataset.csv (2.8MB, second read/parse): ${duration}ms`);

  // 2. Profile single stock analysis (Cached)
  console.log("\n--- Profiling analyzeTicker (Cached) ---");
  start = Date.now();
  await analyzeTicker("AAPL");
  duration = Date.now() - start;
  console.log(`analyzeTicker("AAPL") (local files exist): ${duration}ms`);

  // 3. Profile single stock analysis (Uncached - trigger Python spawn)
  console.log("\n--- Profiling analyzeTicker (Uncached - Spawning Python) ---");
  
  const testTicker = "DIS";
  const paths = tickerPaths(testTicker);
  
  // Clean up existing files for DIS to force download
  try {
    await fs.unlink(paths.csv);
    await fs.unlink(paths.info);
    await fs.unlink(paths.news);
    console.log("Deleted old DIS data files to force clean download.");
  } catch (e) {
    // Ignore if files don't exist
  }

  start = Date.now();
  await analyzeTicker(testTicker);
  duration = Date.now() - start;
  console.log(`analyzeTicker("${testTicker}") (with Python download): ${duration}ms`);

  // 4. Profile portfolio analysis (sequential)
  console.log("\n--- Profiling analyzePortfolioRisk (3 Tickers: AAPL, MSFT, GOOGL) ---");
  const holdings = [
    { ticker: "AAPL", shares: 10, buyPrice: 150 },
    { ticker: "MSFT", shares: 5, buyPrice: 300 },
    { ticker: "GOOGL", shares: 15, buyPrice: 100 }
  ];

  start = Date.now();
  const result = await analyzePortfolioRisk(holdings);
  duration = Date.now() - start;
  console.log(`analyzePortfolioRisk() execution: ${duration}ms`);

  console.log("=========================================");
}

runProfile().catch(console.error);

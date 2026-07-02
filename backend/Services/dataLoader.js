const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../data');
const ROOT_DATASET = path.join(__dirname, '../../StockPriceDataset.csv');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Reads the cache file and returns the cache object.
 */
function getCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading cache.json:', err);
  }
  return {};
}

/**
 * Updates the cache file with a new ticker date.
 */
function updateCache(ticker) {
  try {
    const cache = getCache();
    const todayStr = new Date().toISOString().split('T')[0];
    cache[ticker.toUpperCase()] = todayStr;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('Error writing cache.json:', err);
  }
}

/**
 * Determines if cache is valid for a given ticker.
 * Cache is valid if it exists and the cached date matches today's date.
 */
function isCacheValid(ticker) {
  const cache = getCache();
  const todayStr = new Date().toISOString().split('T')[0];
  const tickerKey = ticker.toUpperCase();
  
  // Check if ticker is in cache and the date is today
  if (cache[tickerKey] && cache[tickerKey] === todayStr) {
    // Also verify essential files exist
    const csvPath = path.join(DATA_DIR, `${tickerKey}.csv`);
    const infoPath = path.join(DATA_DIR, `${tickerKey}_info.json`);
    const newsPath = path.join(DATA_DIR, `${tickerKey}_news.json`);
    
    if (fs.existsSync(csvPath) && fs.existsSync(infoPath) && fs.existsSync(newsPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Executes the python script to download yfinance data.
 */
function executePythonDownloader(ticker, logs) {
  const tickerKey = ticker.toUpperCase();
  const scriptPath = path.join(__dirname, '../scripts/download_yfinance.py');
  
  logs.push(`DataLoader: Local data for ${tickerKey} missing/stale. Invoking Python yfinance downloader...`);
  
  try {
    // Check if scripts directory exists
    const scriptsDir = path.dirname(scriptPath);
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Run python script synchronously
    const command = `python "${scriptPath}" "${tickerKey}"`;
    logs.push(`DataLoader: Running: ${command}`);
    execSync(command, { stdio: 'pipe' });
    
    logs.push(`DataLoader: Download completed successfully for ${tickerKey}.`);
    updateCache(tickerKey);
    return true;
  } catch (err) {
    const errorMsg = err.stderr ? err.stderr.toString() : err.message;
    logs.push(`DataLoader: Python download failed for ${tickerKey}: ${errorMsg.slice(0, 150)}`);
    return false;
  }
}

/**
 * Parses a downloaded stock price CSV file.
 * Returns array of { date, close } sorted chronologically.
 */
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (lines.length <= 1) return [];

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const dateIdx = headers.indexOf('Date');
  const closeIdx = headers.indexOf('Close');
  const adjCloseIdx = headers.indexOf('Adj Close');

  const history = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length <= Math.max(dateIdx, closeIdx)) continue;
    
    const date = cols[dateIdx].trim();
    // Default to Adj Close if Close is NaN, or vice versa
let close = Number(cols[closeIdx]);

if (Number.isNaN(close) && adjCloseIdx !== -1) {
    close = Number(cols[adjCloseIdx]);
}

if (!Number.isNaN(close)) {
    history.push({
        date,
        close
    });
}    if (date && !isNaN(close)) {
      history.push({ date, close });
    }
  }
  return history;
}

/**
 * Fallback to reading the ticker data from the root StockPriceDataset.csv file.
 */
function loadFromRootDataset(ticker, logs) {
  const tickerKey = ticker.toUpperCase();
  logs.push(`DataLoader: Attempting secondary fallback from StockPriceDataset.csv for ${tickerKey}...`);
  
  if (!fs.existsSync(ROOT_DATASET)) {
    logs.push(`DataLoader: StockPriceDataset.csv not found at root path: ${ROOT_DATASET}`);
    return [];
  }

  try {
    const content = fs.readFileSync(ROOT_DATASET, 'utf8');
    const lines = content.split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dateIdx = headers.indexOf('Date');
    const closeIdx = headers.indexOf('Close');
    const tickerIdx = headers.indexOf('Ticker');

    if (dateIdx === -1 || closeIdx === -1 || tickerIdx === -1) {
      logs.push(`DataLoader: StockPriceDataset.csv header format is invalid.`);
      return [];
    }

    const history = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length <= tickerIdx) continue;
      
      const fileTicker = cols[tickerIdx].trim().toUpperCase();
      if (fileTicker === tickerKey) {
        const date = cols[dateIdx].trim();
        const close = parseFloat(cols[closeIdx]) || 0;
        if (date && !isNaN(close)) {
          history.push({ date, close });
        }
      }
    }
    
    logs.push(`DataLoader: Successfully extracted ${history.length} records from StockPriceDataset.csv for ${tickerKey}`);
    return history;
  } catch (err) {
    logs.push(`DataLoader: Error parsing StockPriceDataset.csv: ${err.message}`);
    return [];
  }
}

/**
 * Returns mock price history if everything else fails.
 */
function generateMockHistory(ticker, logs) {
  logs.push(`DataLoader: All data sources failed for ${ticker.toUpperCase()}. Generating mock history...`);
  const history = [];
  const today = new Date();
  for (let i = 180; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const randomSeed = ticker.charCodeAt(0) % 5;
    const basePrice = 100 + (randomSeed * 25);
    const wave = Math.sin(i / 10) * 5;
    const noise = (Math.random() - 0.5) * 3;
    const close = basePrice + wave + noise;
    
    history.push({ date: dateStr, close });
  }
  return history;
}

/**
 * Main Loader function. Loads price history, news, and financials for a ticker.
 */
async function loadTickerData(ticker, logs = []) {
  const tickerKey = ticker.toUpperCase();
  const csvPath = path.join(DATA_DIR, `${tickerKey}.csv`);
  const infoPath = path.join(DATA_DIR, `${tickerKey}_info.json`);
  const newsPath = path.join(DATA_DIR, `${tickerKey}_news.json`);
  
  // 1. Check if cache is valid. If not, trigger downloader.
  if (!isCacheValid(tickerKey)) {
    const success = executePythonDownloader(tickerKey, logs);
    if (!success && !fs.existsSync(csvPath)) {
      // If download failed and we don't even have old cached csv files, try secondary fallback
      const rootHistory = loadFromRootDataset(tickerKey, logs);
      if (rootHistory.length > 0) {
        // Mock save the root history to a local csv file for future fast access
        try {
          const header = "Date,Close\n";
          const rows = rootHistory.map(r => `${r.date},${r.close}`).join('\n');
          fs.writeFileSync(csvPath, header + rows);
          
          // Generate a basic dummy info and news file for the fallback
          const dummyInfo = {
            symbol: tickerKey,
            longName: `${tickerKey} Inc. (Offline Fallback)`,
            sector: tickerKey === 'SPY' ? 'Index' : 'Other',
            currentPrice: rootHistory[rootHistory.length - 1].close
          };
          fs.writeFileSync(infoPath, JSON.stringify(dummyInfo, null, 2));
          fs.writeFileSync(newsPath, JSON.stringify([], null, 2));
        } catch (e) {
          logs.push(`DataLoader: Failed to save fallback files: ${e.message}`);
        }
      }
    }
  }

  // 2. Load historical prices
  let history = [];
  if (fs.existsSync(csvPath)) {
    history = parseCSV(csvPath);
    logs.push(`DataLoader: Loaded ${history.length} price records from cached CSV for ${tickerKey}`);
  } else {
    history = generateMockHistory(tickerKey, logs);
  }

  // 3. Load general Info
  let info = {};
  if (fs.existsSync(infoPath)) {
    try {
      info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch (e) {
      logs.push(`DataLoader: Error parsing info JSON for ${tickerKey}: ${e.message}`);
    }
  } else {
    info = {
      symbol: tickerKey,
      longName: `${tickerKey} Corporation`,
      sector: 'Other',
      currentPrice: history.length > 0 ? history[history.length - 1].close : 100
    };
  }

  // 4. Load News
  let news = [];
  if (fs.existsSync(newsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(newsPath, "utf8"));

news = parsed.news || [];
    } catch (e) {
      logs.push(`DataLoader: Error parsing news JSON for ${tickerKey}: ${e.message}`);
    }
  }

  // 5. Load additional financial statement files if they exist (income, balance sheet, cashflow, dividends)
  const incomePath = path.join(DATA_DIR, `${tickerKey}_income.json`);
  const balanceSheetPath = path.join(DATA_DIR, `${tickerKey}_balance_sheet.json`);
  const cashflowPath = path.join(DATA_DIR, `${tickerKey}_cashflow.json`);
  const dividendsPath = path.join(DATA_DIR, `${tickerKey}_dividends.json`);

  let incomeStatement = null;
  let balanceSheet = null;
  let cashflow = null;
  let dividends = null;


  try {
    if (fs.existsSync(incomePath)) incomeStatement = JSON.parse(fs.readFileSync(incomePath, 'utf8'));
    if (fs.existsSync(balanceSheetPath)) balanceSheet = JSON.parse(fs.readFileSync(balanceSheetPath, 'utf8'));
    if (fs.existsSync(cashflowPath)) cashflow = JSON.parse(fs.readFileSync(cashflowPath, 'utf8'));
    if (fs.existsSync(dividendsPath)) dividends = JSON.parse(fs.readFileSync(dividendsPath, 'utf8'));
  } catch (e) {
    logs.push(`DataLoader: Error reading additional financial files for ${tickerKey}: ${e.message}`);
  }
const latestClose =
  history.length > 0
    ? Number(history[history.length - 1].close)
    : NaN;

const currentPrice =
  !Number.isNaN(latestClose)
    ? latestClose
    : (!Number.isNaN(Number(info.currentPrice))
        ? Number(info.currentPrice)
        : 100);

  const latestClose =
  history.length > 0
    ? Number(history[history.length - 1].close)
    : NaN;

const currentPrice =
  !Number.isNaN(latestClose)
    ? latestClose
    : (!Number.isNaN(Number(info.currentPrice))
        ? Number(info.currentPrice)
        : 100);

console.log("================================");
console.log("Ticker:", tickerKey);
console.log("Info Path:", infoPath);
console.log("Sector:", info.sector);
console.log("Industry:", info.industry);
console.log("Current Price:", currentPrice);
console.log("================================");


  return {
    ticker: tickerKey,
    currentPrice,
    sector: info.sector || info.industry || "Unknown",
    longName: info.longName || tickerKey,
    history,
    info,
    news,
    incomeStatement,
    balanceSheet,
    cashflow,
    dividends
  };
}

module.exports = {
  loadTickerData,
  DATA_DIR
};

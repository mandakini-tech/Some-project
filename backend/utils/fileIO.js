import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const dataDir = path.join(projectRoot, "backend", "data");
const rootCsvPath = path.join(projectRoot, "StockPriceDataset.csv");


export async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export function tickerPaths(ticker) {
  ticker = ticker.toUpperCase();

  return {
    csv: path.join(dataDir, `${ticker}.csv`),
    info: path.join(dataDir, `${ticker}_info.json`),
    news: path.join(dataDir, `${ticker}_news.json`)
  };
}

export async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readJSON(file, fallback = null) {
  try {
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

export async function readCSV(file) {
  const txt = await fs.readFile(file, "utf8");

  return parse(txt, {
    columns: true,
    skip_empty_lines: true,
  });
}

export async function loadLocalOrRootCSV(ticker) {
  const { csv } = tickerPaths(ticker);

  if (await fileExists(csv)) {
    console.log("Using local CSV:", csv);
    return readCSV(csv);
  }

  console.log("Using root CSV:", rootCsvPath);

  const rows = await readCSV(rootCsvPath);

  const filtered = rows.filter(
    r => (r.Ticker || "").toUpperCase() === ticker.toUpperCase()
  );

  if (!filtered.length) {
    throw new Error(`Ticker ${ticker} not found in StockPriceDataset.csv`);
  }

  return filtered;
}
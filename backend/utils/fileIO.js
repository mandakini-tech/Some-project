import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const dataDir = path.resolve(process.cwd(), "backend", "data");
const rootCsvPath = path.resolve(process.cwd(), "../StockPriceDataset.csv");

export async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
  return dataDir;
}

export function tickerPaths(t) {
  const ticker = t.toUpperCase();
  return {
    csv: path.join(dataDir, `${ticker}.csv`),
    info: path.join(dataDir, `${ticker}_info.json`),
    news: path.join(dataDir, `${ticker}_news.json`),
  };
}

export async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function readJSON(p, fallback = null) {
  try { return JSON.parse(await fs.readFile(p, "utf-8")); } catch { return fallback; }
}

export async function readCSV(p) {
  const raw = await fs.readFile(p, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true });
}

export async function loadLocalOrRootCSV(ticker) {
  const { csv } = tickerPaths(ticker);
  if (await fileExists(csv)) return await readCSV(csv);
  // fallback: root dataset
  const rows = await readCSV(rootCsvPath);
  const filtered = rows.filter(r => (r.Ticker || r.ticker || "").toUpperCase() === ticker.toUpperCase());
  if (filtered.length) return filtered;
  throw new Error(`No CSV data for ${ticker}`);
}

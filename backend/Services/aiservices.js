import path from "node:path";
import { ensureDataDir, tickerPaths, loadLocalOrRootCSV, readCSV, fileExists } from "../utils/fileIO.js";
import { runPython } from "../utils/python.js";
import { summarize } from "./quant.js";
import { loadInfo, retrieveNews } from "./ragNews.js";

async function ensureLocalData(ticker) {
  await ensureDataDir();
  const { csv, info, news } = tickerPaths(ticker);
  const allExists = await fileExists(csv) && await fileExists(info) && await fileExists(news);
  if (allExists) return true;

  // run python downloader
  const script = path.resolve(process.cwd(), "backend", "scripts", "download_yfinance.py");
  try {
    await runPython([script, ticker]);
    return true;
  } catch (e) {
    // swallow; fallback flows will handle
    return false;
  }
}

export async function analyzeTicker(ticker) {
  const t = ticker.toUpperCase();
  const got = await ensureLocalData(t);

  // Load asset CSV (from local or root fallback)
  const assetRows = await loadLocalOrRootCSV(t);

  // Ensure SPY for market
  await ensureLocalData("SPY").catch(()=>{});
  let spyRows;
  try { spyRows = await loadLocalOrRootCSV("SPY"); }
  catch { spyRows = assetRows.slice(0, 252).map(r=>({ ...r })); } // weak fallback

  const stats = summarize(assetRows, spyRows);
  const info = await loadInfo(t);
  const topNews = await retrieveNews(t, 5);

  // Decision report (minimal rule-based)
  const riskNote = [
    stats.beta > 1.2 ? "Beta > 1.2 (more sensitive than market)." :
    stats.beta < 0.8 ? "Beta < 0.8 (less sensitive than market)." :
    "Beta near 1 (market-like).",
    stats.volatilityAnnualized > 0.35 ? "Elevated annualized volatility." :
    stats.volatilityAnnualized < 0.20 ? "Moderate annualized volatility." : "Typical volatility.",
    `1-day 95% VaR ≈ ${(stats.var95*100).toFixed(2)}% (historical).`
  ].join(" ");

  const newsBullets = topNews.map(n => `- ${n.title} (${n.publisher})`).join("\n");

  const md = [
    `# ${info.longName || t} (${t}) — Risk Snapshot`,
    ``,
    `- Sector: ${info.sector || "N/A"} | Industry: ${info.industry || "N/A"}`,
    `- Last Price: ${stats.lastPrice ?? "N/A"}`,
    `- Beta (vs SPY): ${stats.beta.toFixed(2)}`,
    `- Volatility (ann.): ${(stats.volatilityAnnualized*100).toFixed(2)}%`,
    `- 1-day 95% VaR: ${(stats.var95*100).toFixed(2)}%`,
    ``,
    `## Interpretation`,
    riskNote,
    ``,
    `## Recent News`,
    newsBullets || "_No recent headlines found_"
  ].join("\n");

  return {
    ticker: t,
    info,
    stats,
    news: topNews,
    reportMarkdown: md
  };
}

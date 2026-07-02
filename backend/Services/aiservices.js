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
  console.error("Python download failed:", e);
  return false;
}
}

export async function analyzeTicker(ticker) {
  const t = ticker.toUpperCase();
  const got = await ensureLocalData(t);

  // Load asset CSV (from local or root fallback)
  let assetRows;

try {
  assetRows = await loadLocalOrRootCSV(t);
} catch (err) {
  console.error("CSV loading failed:", err);
  throw err;
}

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
export async function analyzePortfolioRisk(holdings = []) {
  if (!holdings.length) {
    return {
      metrics: {
        beta: 0,
        volatility: 0,
        valueAtRisk: 0,
        diversificationScore: 100,
        annualReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      },
      holdings: [],
      agentReport: "Portfolio is empty.",
      agentLogs: [],
    };
  }
const results = [];

for (const holding of holdings) {
  try {
    console.log("Analyzing:", holding.ticker);

    const analysis = await analyzeTicker(holding.ticker);

    results.push({
      holding,
      analysis
    });

  } catch (err) {
    console.error(`Error analyzing ${holding.ticker}:`, err);

    results.push({
      holding,
      analysis: {
        ticker: holding.ticker,
        stats: {
          beta: 0,
          volatilityAnnualized: 0,
          var95: 0,
          lastPrice: holding.buyPrice
        },
        info: {
          sector: "Unknown"
        },
        reportMarkdown: `Unable to analyze ${holding.ticker}.`
      }
    });
  }
}

  const totalValue = results.reduce(
    (sum, r) =>
      sum + (r.holding.shares || 0) * (r.analysis.stats.lastPrice || 0),
    0
  );

  let beta = 0;
  let volatility = 0;
  let var95 = 0;

  for (const r of results) {
    const value =
      (r.holding.shares || 0) * (r.analysis.stats.lastPrice || 0);

    const weight = totalValue > 0 ? value / totalValue : 0;

    beta += weight * (r.analysis.stats.beta || 0);

    volatility +=
      Math.pow(weight * (r.analysis.stats.volatilityAnnualized || 0), 2);

    var95 += weight * (r.analysis.stats.var95 || 0);
  }

  volatility = Math.sqrt(volatility);

  return {
    metrics: {
      beta,
      volatility,
      valueAtRisk: var95,
      diversificationScore:
  holdings.length <= 1
    ? 20
    : Math.min(100, holdings.length * 20),
      annualReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
    },
    holdings: results.map(r => ({
  ticker: r.holding.ticker,
  shares: r.holding.shares,
  buyPrice: r.holding.buyPrice,

  currentPrice: r.analysis.stats.lastPrice,
  currentValue: r.holding.shares * r.analysis.stats.lastPrice,

  sector: r.analysis.info.sector,
  industry: r.analysis.info.industry,
  longName: r.analysis.info.longName,

  beta: r.analysis.stats.beta,
  volatility: r.analysis.stats.volatilityAnnualized,
  valueAtRisk: r.analysis.stats.var95,

  report: r.analysis.reportMarkdown
})),
    agentReport: `Portfolio analyzed successfully with ${results.length} holdings.`,
    agentLogs: [
      `Processed ${results.length} holdings.`,
      "Risk metrics calculated.",
    ],
  };
}
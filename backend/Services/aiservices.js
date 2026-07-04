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

  const enrichedHoldings = [];

  let totalValue = 0;

  for (const holding of holdings) {
    try {
      const result = await analyzeTicker(holding.ticker);

      const currentPrice =
        Number(result.stats.lastPrice) || Number(holding.buyPrice);

      const currentValue =
        Number(holding.shares) * currentPrice;

      totalValue += currentValue;

      enrichedHoldings.push({
        ticker: holding.ticker.toUpperCase(),

        shares: Number(holding.shares),

        buyPrice: Number(holding.buyPrice),

        currentPrice,

        currentValue,

        sector:
          result.info.sector ||
          "Unknown",

        industry:
          result.info.industry ||
          "Unknown",

        longName:
          result.info.longName ||
          holding.ticker,

        beta:
          result.stats.beta || 0,

        volatility:
          result.stats.volatilityAnnualized || 0,

        valueAtRisk:
          result.stats.var95 || 0,

        annualReturn:
          result.stats.annualReturn || 0,

        report:
          result.reportMarkdown
      });

    } catch (err) {

      console.error(
        "Analysis failed:",
        holding.ticker,
        err.message
      );

      enrichedHoldings.push({
        ticker: holding.ticker,

        shares: holding.shares,

        buyPrice: holding.buyPrice,

        currentPrice: holding.buyPrice,

        currentValue:
          holding.buyPrice * holding.shares,

        sector: "Unknown",

        industry: "Unknown",

        longName: holding.ticker,

        beta: 0,

        volatility: 0,

        valueAtRisk: 0,

        annualReturn: 0,

        report: `Unable to analyze ${holding.ticker}`
      });
    }
  }

  //---------------------------------------------------
  // Portfolio aggregation
  //---------------------------------------------------

  let beta = 0;

  let volatilitySquared = 0;

  let var95 = 0;

  let annualReturn = 0;

  for (const h of enrichedHoldings) {

    const weight =
      totalValue > 0
        ? h.currentValue / totalValue
        : 0;

    beta +=
      weight * h.beta;

    volatilitySquared +=
      Math.pow(
        weight * h.volatility,
        2
      );

    var95 +=
      weight * h.valueAtRisk;

    annualReturn +=
      weight * h.annualReturn;
  }

  const volatility =
    Math.sqrt(volatilitySquared);

  const sharpeRatio =
    volatility > 0
      ? annualReturn / volatility
      : 0;

  const sectorCount =
    new Set(
      enrichedHoldings.map(
        h => h.sector
      )
    ).size;

  const diversificationScore =
    Math.min(
      100,
      sectorCount * 25
    );

  return {

    metrics: {

      beta,

      volatility,

      valueAtRisk: var95,

      diversificationScore,

      annualReturn,

      sharpeRatio,

      maxDrawdown: 0,

    },

    holdings:
      enrichedHoldings,

    agentReport:
      `Portfolio analyzed successfully with ${enrichedHoldings.length} holdings.`,

    agentLogs: [

      `Processed ${enrichedHoldings.length} holdings.`,

      "Risk metrics calculated.",

    ]
  };
}
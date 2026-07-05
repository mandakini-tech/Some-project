import path from "node:path";
import {
  ensureDataDir,
  tickerPaths,
  loadLocalOrRootCSV,
  fileExists
} from "../utils/fileIO.js";

import { runPython } from "../utils/python.js";

import {
  summarize,
  var95
} from "./quant.js";

import { loadInfo, retrieveNews } from "./ragNews.js";
/* -------------------------------------------------------
   Download local yfinance data if missing
-------------------------------------------------------- */

async function ensureLocalData(ticker) {
  await ensureDataDir();

  const { csv, info, news } = tickerPaths(ticker);

  const exists =
    (await fileExists(csv)) &&
    (await fileExists(info)) &&
    (await fileExists(news));

  if (exists) return true;

  const script = path.resolve(
    process.cwd(),
    "backend",
    "scripts",
    "download_yfinance.py"
  );

  try {
    await runPython([script, ticker]);
    return true;
  } catch (err) {
    console.error(
      `Failed downloading ${ticker}:`,
      err.message
    );
    return false;
  }
}

/* -------------------------------------------------------
   Analyze Single Stock
-------------------------------------------------------- */

export async function analyzeTicker(ticker) {
  const symbol = ticker.toUpperCase();

  await ensureLocalData(symbol);

  let assetRows;

  try {
    assetRows = await loadLocalOrRootCSV(symbol);
  } catch (err) {
    console.error(
      "Unable to load CSV:",
      symbol,
      err.message
    );
    throw err;
  }

  await ensureLocalData("SPY").catch(() => {});

  let spyRows;

  try {
    spyRows = await loadLocalOrRootCSV("SPY");
  } catch {
    spyRows = assetRows;
  }

  const stats = summarize(assetRows, spyRows);

  const info = await loadInfo(symbol);

  const news = await retrieveNews(symbol, 5);

  /* ---------------- Decision Summary ---------------- */

  const interpretation = [];

  if (stats.beta > 1.2)
    interpretation.push(
      "High beta indicates greater market sensitivity."
    );
  else if (stats.beta < 0.8)
    interpretation.push(
      "Low beta indicates defensive characteristics."
    );
  else
    interpretation.push(
      "Beta close to market average."
    );

  if (stats.volatilityAnnualized > 0.35)
    interpretation.push(
      "Historical volatility is high."
    );
  else if (stats.volatilityAnnualized < 0.20)
    interpretation.push(
      "Historical volatility is relatively low."
    );
  else
    interpretation.push(
      "Historical volatility is moderate."
    );

  if (stats.sharpeRatio > 1)
    interpretation.push(
      "Risk-adjusted return is strong."
    );
  else if (stats.sharpeRatio > 0)
    interpretation.push(
      "Risk-adjusted return is acceptable."
    );
  else
    interpretation.push(
      "Risk-adjusted return is weak."
    );

  const markdown = [

    `# ${info.longName || symbol} (${symbol})`,

    "",

    `Sector: ${info.sector || "N/A"}`,

    `Industry: ${info.industry || "N/A"}`,

    "",

    `Current Price: $${stats.lastPrice?.toFixed(2)}`,

    `Beta: ${stats.beta.toFixed(2)}`,

    `Annual Return: ${(stats.annualReturn * 100).toFixed(2)}%`,

    `Annual Volatility: ${(stats.volatilityAnnualized * 100).toFixed(2)}%`,

    `Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}`,

    `Maximum Drawdown: ${(stats.maxDrawdown * 100).toFixed(2)}%`,

    `1-Day VaR (95%): ${(stats.var95 * 100).toFixed(2)}%`,

    "",

    "## Interpretation",

    interpretation.join(" "),

    "",

    "## Recent News",

    ...(news.length
      ? news.map(
          n =>
            `- ${n.title} (${n.publisher})`
        )
      : ["No recent news available."])

  ].join("\n");

  return {

    ticker: symbol,

    info,

    stats,

    news,

    reportMarkdown: markdown

  };
}

/* ===========================================================
   PART 2 STARTS HERE
   Next message will contain analyzePortfolioRisk()
=========================================================== */
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

  //----------------------------------------------------
  // Analyze every holding
  //----------------------------------------------------

  for (const holding of holdings) {

    try {

      const result =
        await analyzeTicker(holding.ticker);

      const currentPrice =
        Number(result.stats.lastPrice) ||
        Number(holding.buyPrice);

      const currentValue =
        Number(holding.shares) *
        currentPrice;

      totalValue += currentValue;

      enrichedHoldings.push({

        ticker:
          holding.ticker.toUpperCase(),

        shares:
          Number(holding.shares),

        buyPrice:
          Number(holding.buyPrice),

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

        annualReturn:
          result.stats.annualReturn || 0,

        sharpeRatio:
          result.stats.sharpeRatio || 0,

        maxDrawdown:
          result.stats.maxDrawdown || 0,

        valueAtRisk:
          result.stats.var95 || 0,

        report:
          result.reportMarkdown

      });

    }

    catch (err) {

      console.error(
        "Ticker Analysis Failed:",
        holding.ticker,
        err.message
      );

      enrichedHoldings.push({

        ticker:
          holding.ticker,

        shares:
          Number(holding.shares),

        buyPrice:
          Number(holding.buyPrice),

        currentPrice:
          Number(holding.buyPrice),

        currentValue:
          Number(holding.buyPrice) *
          Number(holding.shares),

        sector:
          "Unknown",

        industry:
          "Unknown",

        longName:
          holding.ticker,

        beta: 0,

        volatility: 0,

        annualReturn: 0,

        sharpeRatio: 0,

        maxDrawdown: 0,

        valueAtRisk: 0,

        report:
          `Unable to analyze ${holding.ticker}`

      });

    }

  }

  //----------------------------------------------------
  // Portfolio aggregation
  //----------------------------------------------------

  let beta = 0;

  let annualReturn = 0;

  let volatilitySquared = 0;

  let sharpeWeighted = 0;

  for (const holding of enrichedHoldings) {

    const weight =
      totalValue > 0
        ? holding.currentValue / totalValue
        : 0;

    beta +=
      weight *
      holding.beta;

    annualReturn +=
      weight *
      holding.annualReturn;

    sharpeWeighted +=
      weight *
      holding.sharpeRatio;

    volatilitySquared +=
      Math.pow(
        weight *
        holding.volatility,
        2
      );

  }

  const volatility =
    Math.sqrt(volatilitySquared);

const portfolioVaR =
    totalValue *
    (volatility / Math.sqrt(252)) *
    1.645;
  const maxDrawdown =
    Math.max(
      ...enrichedHoldings.map(
        h => h.maxDrawdown
      )
    );

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

  const sharpeRatio =
    volatility > 0
      ? Number(
          (
            (annualReturn - 0.04) /
            volatility
          ).toFixed(2)
        )
      : 0;

  //----------------------------------------------------
  // Agent Logs
  //----------------------------------------------------

  const logs = [];

  logs.push(
    "Market Agent ▶ Loading historical prices..."
  );

  logs.push(
    `Market Agent ▶ Loaded ${enrichedHoldings.length} assets`
  );

  logs.push(
    "Market Agent ▶ Computing portfolio statistics..."
  );

  logs.push(
    `Market Agent ▶ Portfolio Beta = ${beta.toFixed(2)}`
  );

  logs.push(
    `Market Agent ▶ Annual Return = ${(annualReturn * 100).toFixed(2)}%`
  );

  logs.push(
    `Market Agent ▶ Annual Volatility = ${(volatility * 100).toFixed(2)}%`
  );

  logs.push(
    `Market Agent ▶ Sharpe Ratio = ${sharpeRatio}`
  );

  logs.push(
    `Market Agent ▶ Max Drawdown = ${(maxDrawdown * 100).toFixed(2)}%`
  );

  logs.push(
    `Market Agent ▶ Portfolio VaR = $${portfolioVaR}`
  );
    //----------------------------------------------------
  // Decision Agent
  //----------------------------------------------------

  let riskLevel = "Low";

  if (beta > 1.2 || volatility > 0.35)
    riskLevel = "High";
  else if (beta > 0.8 || volatility > 0.20)
    riskLevel = "Moderate";

  logs.push(
    "Decision Agent ▶ Evaluating portfolio risk..."
  );

  logs.push(
    `Decision Agent ▶ Overall Risk = ${riskLevel}`
  );

  //----------------------------------------------------
  // Recommendation Agent
  //----------------------------------------------------

  const recommendations = [];

  if (riskLevel === "High") {
    recommendations.push(
      "Reduce exposure to high-beta assets."
    );
  }

  if (diversificationScore < 50) {
    recommendations.push(
      "Increase sector diversification."
    );
  }

  if (sharpeRatio < 0.5) {
    recommendations.push(
      "Improve risk-adjusted return by balancing defensive and growth stocks."
    );
  }

  if (annualReturn < 0) {
    recommendations.push(
      "Portfolio has negative historical return. Review underperforming holdings."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Portfolio appears well balanced."
    );
  }

  logs.push(
    "Recommendation Agent ▶ Generating portfolio recommendations..."
  );

  recommendations.forEach(r =>
    logs.push(`Recommendation Agent ▶ ${r}`)
  );

  logs.push(
    "Portfolio analysis completed successfully."
  );

  //----------------------------------------------------
  // Final Report
  //----------------------------------------------------

  const report = [
    `Portfolio Value : $${totalValue.toFixed(2)}`,
    `Portfolio Beta : ${beta.toFixed(2)}`,
    `Annual Return : ${(annualReturn * 100).toFixed(2)}%`,
    `Annual Volatility : ${(volatility * 100).toFixed(2)}%`,
    `Sharpe Ratio : ${sharpeRatio}`,
    `Maximum Drawdown : ${(maxDrawdown * 100).toFixed(2)}%`,
    `95% VaR : $${portfolioVaR}`,
    `Diversification Score : ${diversificationScore}/100`,
    "",
    "Recommendations:",
    ...recommendations.map(r => `• ${r}`)
  ].join("\n");

  //----------------------------------------------------
  // Return
  //----------------------------------------------------

  return {

    metrics: {

      beta,

      volatility,

      valueAtRisk: portfolioVaR,

      diversificationScore,

      annualReturn,

      sharpeRatio,

      maxDrawdown

    },

    holdings: enrichedHoldings,

    agentReport: report,

    agentLogs: logs

  };

}
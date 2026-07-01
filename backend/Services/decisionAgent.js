const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

/**
 * Decision Agent
 * Responsibilities:
 * - Synthesis of numerical market data and qualitative news RAG text
 * - Invokes OpenAI GPT model if API key is provided
 * - Executes high-fidelity rule-based markdown generation as a local fallback
 */
async function runDecisionAgent(marketData, newsData, logs) {
  logs.push('Decision Agent: Commencing qualitative synthesis and report generation...');

  const { portfolioMetrics, holdings, sectorAllocations } = marketData;
  const { ragContexts } = newsData;

  const openaiApiKey = process.env.OPENAI_API_KEY;
  let reportContent = '';

  // Compile detailed portfolio context text for LLM / local engine
  const portfolioTextContext = `
=== PORTFOLIO QUANTITATIVE DATA ===
Total Market Value: $${portfolioMetrics.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Annual Return (Weighted): ${(portfolioMetrics.annualReturn * 100).toFixed(2)}%
Annualized Volatility: ${(portfolioMetrics.volatility * 100).toFixed(2)}%
Portfolio Beta: ${portfolioMetrics.beta.toFixed(2)} (SPY Baseline = 1.00)
Sharpe Ratio: ${portfolioMetrics.sharpeRatio.toFixed(2)} (Risk-Free Rate: 4.00%)
Maximum Drawdown: ${(portfolioMetrics.maxDrawdown * 100).toFixed(2)}%
Estimated 1-Day 95% Value-at-Risk (VaR): $${portfolioMetrics.valueAtRisk.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
Diversification Rating: ${portfolioMetrics.diversificationScore}/100

=== ASSET BREAKDOWN ===
${holdings.map(h => {
  return `- ${h.ticker} (${h.longName}):
  Shares: ${h.shares}
  Current Price: $${h.currentPrice.toFixed(2)}
  Cost Basis: $${h.buyPrice.toFixed(2)}
  Portfolio Weight: ${h.weight.toFixed(2)}%
  Beta: ${h.metrics.beta.toFixed(2)}
  Volatility: ${(h.metrics.volatility * 100).toFixed(2)}%
  Sharpe Ratio: ${h.metrics.sharpeRatio.toFixed(2)}
  Max Drawdown: ${(h.metrics.maxDrawdown * 100).toFixed(2)}%
  30-day Momentum: ${(h.metrics.momentum30 * 100).toFixed(2)}%
  Sector: ${h.sector}`;
}).join('\n\n')}

=== SECTOR ALLOCATIONS ===
${Object.entries(sectorAllocations).map(([sec, w]) => `- ${sec}: ${(w * 100).toFixed(2)}%`).join('\n')}

=== QUALITATIVE RAG KNOWLEDGE BASE ===
${ragContexts.map(r => r.contextString).join('\n')}
`;

  if (openaiApiKey && openaiApiKey.trim() !== '') {
    try {
      logs.push('Decision Agent: Initiating connection to OpenAI LangChain instance...');
      
      const chat = new ChatOpenAI({
        openAIApiKey: openaiApiKey,
        modelName: 'gpt-4o-mini',
        temperature: 0.25
      });

      const systemPrompt = `You are a professional wealth manager and risk analyst decision agent. 
Analyze the stock portfolio data, RAG fundamentals, and news alerts. Explain the portfolio's risk profile and suggest strategic diversification.
Format your output in clean, premium Markdown. Use bullet lists and blockquotes to highlight risk warnings.
Your report MUST contain:
1. Executive Portfolio Risk Summary (with key metrics)
2. Quantitative Deep Dive (Evaluate Beta, Volatility, Sharpe, Drawdown, and VaR)
3. Sector Allocation and Concentration Warnings
4. Qualitative News & Sentiment Threat Assessment (Detailing yfinance news alerts & sentiment)
5. Strategic Diversification and Hedging Recommendations.`;

      const response = await chat.call([
        new SystemMessage(systemPrompt),
        new HumanMessage(portfolioTextContext)
      ]);

      reportContent = response.content;
      logs.push('Decision Agent: OpenAI RAG Report compiled successfully.');
    } catch (err) {
      logs.push(`Decision Agent: OpenAI connection failed (${err.message}). Activating local engine...`);
      reportContent = generateLocalReport(portfolioMetrics, holdings, sectorAllocations, ragContexts);
    }
  } else {
    logs.push('Decision Agent: No API Key found. Engaging local advisory engine...');
    reportContent = generateLocalReport(portfolioMetrics, holdings, sectorAllocations, ragContexts);
  }

  return reportContent;
}

/**
 * Local Rule-Based Advisory Report Generator
 * Renders a rich, publication-grade markdown document from computed metrics.
 */
function generateLocalReport(metrics, holdings, sectors, ragContexts) {
  const dateStr = new Date().toLocaleDateString('en-US', { dateStyle: 'long' });
  
  // Classify ratings
  const getRiskLabel = (beta, vol) => {
    if (beta > 1.25 || vol > 0.28) return { text: 'Aggressive / High Risk', class: '🔴' };
    if (beta > 0.8 || vol > 0.16) return { text: 'Moderate / Growth Oriented', class: '🟡' };
    return { text: 'Conservative / Defensive', class: '🟢' };
  };

  const getDivLabel = (score) => {
    if (score >= 80) return 'Excellent / Well Diversified';
    if (score >= 60) return 'Moderate / Rebalancing Recommended';
    return 'Highly Concentrated / Severe Risk';
  };

  const riskLabel = getRiskLabel(metrics.beta, metrics.volatility);
  const divLabel = getDivLabel(metrics.diversificationScore);

  let report = `# 📊 Executive Portfolio Risk Analysis Report
*Generated on: ${dateStr} | Engine: Local RAG Decision Analytics Fallback*

---

## 1. Executive Summary
Your portfolio of **${holdings.length} assets** has a total market valuation of **$${metrics.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}**.

- **Portfolio Risk Profile:** ${riskLabel.class} **${riskLabel.text}**
- **Diversification Rating:** \`${metrics.diversificationScore}/100\` — **${divLabel}**
- **1-Day 95% Value-at-Risk (VaR):** **$${metrics.valueAtRisk.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}**
  > [!NOTE]
  > Under normal market conditions, there is a **5% statistical probability** that this portfolio could lose **$${metrics.valueAtRisk.toLocaleString(undefined, {maximumFractionDigits: 0})} or more** in a single trading day.

---

## 2. Quantitative Performance & Risk Deep Dive

### Core Portfolio Statistics
| Metric | Value | benchmark (SPY) | Description |
| :--- | :---: | :---: | :--- |
| **Portfolio Beta** | \`${metrics.beta.toFixed(2)}\` | \`1.00\` | Systematic market sensitivity. |
| **Annualized Return** | \` ${(metrics.annualReturn * 100).toFixed(1)}%\` | \`N/A\` | Average daily return annualized. |
| **Annualized Volatility** | \` ${(metrics.volatility * 100).toFixed(1)}%\` | \`15.0%\` | Annualized standard deviation of returns. |
| **Sharpe Ratio** | \`${metrics.sharpeRatio.toFixed(2)}\` | \`N/A\` | Risk-adjusted return (using 4% risk-free rate). |
| **Max Drawdown** | \` ${(metrics.maxDrawdown * 100).toFixed(1)}%\` | \`N/A\` | Peak-to-trough historical drop. |

### Asset Breakdown
| Ticker | Company | Weight | Beta | Sharpe | Volatility | Max Drawdown | 30-day Momentum |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
${holdings.map(h => {
  return `| **${h.ticker}** | ${h.longName} | ${h.weight.toFixed(1)}% | ${h.metrics.beta.toFixed(2)} | ${h.metrics.sharpeRatio.toFixed(1)} | ${(h.metrics.volatility * 100).toFixed(1)}% | ${(h.metrics.maxDrawdown * 100).toFixed(1)}% | ${(h.metrics.momentum30 * 100).toFixed(1)}% |`;
}).join('\n')}

---

## 3. Sector Distribution & Concentration Concerns

The capital allocation across industrial sectors is distributed as follows:
${Object.entries(sectors).map(([sec, weight]) => `- **${sec}:** \`${(weight * 100).toFixed(1)}%\` of portfolio value.`).join('\n')}

### Concentration Risk Assessment
`;

  // Sector concentration analysis
  const dominantSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];
  if (dominantSector && dominantSector[1] > 0.45) {
    report += `> [!WARNING]
> **HIGH SECTOR CONCENTRATION ALERT:** Your holdings are heavily concentrated in the **${dominantSector[0]}** sector (\`${(dominantSector[1] * 100).toFixed(1)}%\`). A regulatory challenge or economic shock to this specific sector will have outsized impacts. We recommend capping any single sector at 30%.\n`;
  } else {
    report += `> [!NOTE]
> **BALANCED SECTOR EXPOSURE:** No single industry sector controls more than 45% of your capital. This distribution provides built-in cushioning against specific sector downturns.\n`;
  }

  // Single stock concentration analysis
  const concentratedStock = holdings.find(h => h.weight > 30);
  if (concentratedStock) {
    report += `> [!CAUTION]
> **SINGLE-STOCK CONCENTRATION WARNING:** **${concentratedStock.ticker}** accounts for **${concentratedStock.weight.toFixed(1)}%** of your entire portfolio. Standard asset allocation theory suggests capping single stock allocations at 15-20% to mitigate idiosyncratic (company-specific) business failure risks.\n`;
  }

  report += `
---

## 4. 🔍 News Threats & RAG Sentiment Assessment
Based on active news headlines downloaded via the yfinance pipeline, the following alerts are active:

`;

  let newsAlertCount = 0;
  ragContexts.forEach(context => {
    if (context.newsAlerts && context.newsAlerts.length > 0) {
      report += `### 📄 Ticker: ${context.ticker}
`;
      context.newsAlerts.forEach(n => {
        newsAlertCount++;
        const dateStr = n.published ? new Date(n.published).toLocaleDateString() : 'Recent';
        report += `* **[${n.sentiment}]** *"${n.title}"* — **${n.publisher}** (${dateStr})
  > *Summary: ${n.summary.slice(0, 200)}...*\n`;
      });
      report += '\n';
    }
  });

  if (newsAlertCount === 0) {
    report += `*No negative or risk-alert news headlines retrieved in the current yfinance cycle. Baseline macroeconomic assumptions are applied.*\n`;
  }

  report += `
---

## 5. 🎯 Diversification & Strategic Advice

Based on your quantitative analytics and news alerts, we recommend the following adjustments:
`;

  // Action suggestions
  if (metrics.beta > 1.25) {
    report += `- **Lower Market Volatility Exposure:** With a portfolio Beta of \`${metrics.beta.toFixed(2)}\`, your portfolio will decline faster than the market during sell-offs. Swap high-beta holdings for defensive equities like Healthcare (**JNJ**) or Consumer Staples (**PG**).\n`;
  }

  if (metrics.sharpeRatio < 0.5 && metrics.sharpeRatio > 0) {
    report += `- **Optimize Risk-Adjusted Returns:** Your Sharpe ratio of \`${metrics.sharpeRatio.toFixed(2)}\` is positive but sub-optimal, indicating high risk for low return. Consider trimming assets with low Sharpe ratios (such as underperforming cyclicals) and moving capital into assets with higher Sharpe scores.\n`;
  } else if (metrics.sharpeRatio <= 0) {
    report += `- **Negative Sharpe Ratio Risk:** Your portfolio risk-adjusted performance is currently negative. This indicates that your return is lower than the risk-free cash yield (4.0%). Reallocate underperforming assets to dividend-paying blue chips or cash equivalents.\n`;
  }

  // Sector rebalancing suggestion
  if (sectors['Technology'] && sectors['Technology'] > 0.40) {
    report += `- **Trimming Tech Concentration:** Technology represents a massive \`${(sectors['Technology'] * 100).toFixed(1)}%\` of your portfolio. Trim tech growth stocks and allocate 10-15% of your capital to high cash flow yielding Financials (**JPM**, **GS**) or Energy (**XOM**) to hedge tech multiple compression.\n`;
  }

  if (holdings.length < 5) {
    report += `- **Increase Holding Breadth:** You only have **${holdings.length} assets** in your portfolio. To reduce company-specific risks, expand your portfolio to at least 5-8 distinct holdings across at least 3-4 different sectors.\n`;
  }

  // Sentiment momentum advice
  const negativeHoldings = holdings.filter(h => {
    const negCount = h.news.filter(n => n.sentiment === 'Negative').length;
    return negCount >= 2;
  });
  if (negativeHoldings.length > 0) {
    const tickers = negativeHoldings.map(h => h.ticker).join(', ');
    report += `- **Monitor Negative Sentiment Tailwinds:** Assets like **${tickers}** are experiencing multiple negative news sentiment items. Closely monitor their earnings reports and technical supports for potential stop-loss triggers.\n`;
  }

  report += `\n*Disclaimer: This automated report is generated by a multi-agent AI system based on statistical metrics and news headlines, and does not constitute official investment planning or financial advisory.*`;

  return report;
}

module.exports = {
  runDecisionAgent
};

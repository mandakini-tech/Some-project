const { loadTickerData } = require('./dataLoader');
const { 
  calculateBeta, 
  calculateAnnualReturn, 
  calculateAnnualizedVolatility, 
  calculateSharpeRatio, 
  calculateMaxDrawdown, 
  calculateMomentum,
  mean,
  stdDev
} = require('../utils/statistics');
const { calculateVaR, calculateDiversificationScore } = require('../utils/riskMetrics');

/**
 * Market Analysis Agent
 * Responsibilities:
 * - Load historical pricing for holdings and baseline index (SPY)
 * - Compute quantitative metrics (returns, beta, volatility, Sharpe, drawdown, momentum)
 * - Perform portfolio-level aggregation using advanced returns alignment
 */
async function runMarketAgent(holdings, logs) {
  logs.push('Market Analysis Agent: Initiating quantitative evaluation...');

  // 1. Load SPY baseline index data
  logs.push('Market Analysis Agent: Loading baseline index data (SPY)...');
  const spyData = await loadTickerData('SPY', logs);
  const spyHistory = spyData.history;

  if (spyHistory.length === 0) {
    logs.push('Market Analysis Agent: Warning: SPY historical data empty. Calculations may use defaults.');
  }

  // Calculate SPY daily returns
  const spyReturnsMap = {};
  const spyReturnsList = [];
  for (let i = 1; i < spyHistory.length; i++) {
    const prev = spyHistory[i - 1].close;
    const curr = spyHistory[i].close;
    if (prev > 0) {
      const ret = (curr - prev) / prev;
      spyReturnsMap[spyHistory[i].date] = ret;
      spyReturnsList.push(ret);
    }
  }

  // 2. Fetch data and calculate individual metrics for each holding
  const holdingsMetrics = [];
  let totalPortfolioValue = 0;

  for (const holding of holdings) {
    const ticker = holding.ticker.toUpperCase();
    const shares = parseFloat(holding.shares);
    const buyPrice = parseFloat(holding.buyPrice);

    // Load data (CSV + JSON info)
    const stockData = await loadTickerData(ticker, logs);
    const history = stockData.history;
    const currentPrice = stockData.currentPrice;
    const value = shares * currentPrice;
    totalPortfolioValue += value;

    // Calculate daily returns for this stock
    const stockReturnsMap = {};
    const stockReturnsList = [];
    const pricesList = [];

    history.forEach(h => pricesList.push(h.close));

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].close;
      const curr = history[i].close;
      if (prev > 0) {
        const ret = (curr - prev) / prev;
        stockReturnsMap[history[i].date] = ret;
        stockReturnsList.push(ret);
      }
    }

    // Align returns with SPY to calculate Beta
    const alignedStockReturns = [];
    const alignedSpyReturns = [];
    for (let i = 1; i < history.length; i++) {
      const date = history[i].date;
      if (stockReturnsMap[date] !== undefined && spyReturnsMap[date] !== undefined) {
        alignedStockReturns.push(stockReturnsMap[date]);
        alignedSpyReturns.push(spyReturnsMap[date]);
      }
    }

    // Individual stock metrics
    const annualReturn = calculateAnnualReturn(stockReturnsList);
    const annualizedVol = calculateAnnualizedVolatility(stockReturnsList);
    const beta = calculateBeta(alignedStockReturns, alignedSpyReturns);
    const sharpe = calculateSharpeRatio(annualReturn, annualizedVol);
    const maxDrawdown = calculateMaxDrawdown(pricesList);
    const momentum30 = calculateMomentum(pricesList, 30);

    holdingsMetrics.push({
      ticker,
      shares,
      buyPrice,
      currentPrice,
      value,
      sector: stockData.sector,
      longName: stockData.longName,
      returnsMap: stockReturnsMap,
      pricesList,
      metrics: {
        annualReturn,
        volatility: annualizedVol,
        beta,
        sharpeRatio: sharpe,
        maxDrawdown,
        momentum30
      },
      info: stockData.info,
      dividends: stockData.dividends,
      incomeStatement: stockData.incomeStatement,
      balanceSheet: stockData.balanceSheet,
      cashflow: stockData.cashflow
    });

    logs.push(`Market Analysis Agent: Ticker ${ticker} metrics computed (Beta: ${beta.toFixed(2)}, Vol: ${(annualizedVol * 100).toFixed(1)}%, MaxDD: ${(maxDrawdown * 100).toFixed(1)}%)`);
  }

  // 3. Calculate portfolio-wide metrics
  logs.push('Market Analysis Agent: Aggregating portfolio-level metrics...');
  const sectorAllocations = {};
  
  // Calculate weights and group sectors
  holdingsMetrics.forEach(h => {
    h.weight = totalPortfolioValue > 0 ? (h.value / totalPortfolioValue) * 100 : 0;
    const sector = h.sector || 'Other';
    sectorAllocations[sector] = (sectorAllocations[sector] || 0) + (h.weight / 100);
  });

  // Align dates across all stocks to construct portfolio daily returns
  const allDates = new Set();
  holdingsMetrics.forEach(h => {
    Object.keys(h.returnsMap).forEach(date => allDates.add(date));
  });

  const sortedDates = Array.from(allDates).sort();
  const portfolioReturns = [];
  const alignedPortfolioSpyReturns = [];

  sortedDates.forEach(date => {
    let dayReturn = 0;
    let validWeightsSum = 0;

    holdingsMetrics.forEach(h => {
      if (h.returnsMap[date] !== undefined) {
        const weightFraction = h.weight / 100;
        dayReturn += h.returnsMap[date] * weightFraction;
        validWeightsSum += weightFraction;
      }
    });

    // Normalize return in case of missing data for some stock on a specific date
    if (validWeightsSum > 0) {
      dayReturn = dayReturn / validWeightsSum;
      portfolioReturns.push(dayReturn);

      if (spyReturnsMap[date] !== undefined) {
        alignedPortfolioSpyReturns.push(spyReturnsMap[date]);
      }
    }
  });

  // Calculate overall portfolio metrics
  const portfolioAnnualReturn = calculateAnnualReturn(portfolioReturns);
  const portfolioVolatility = calculateAnnualizedVolatility(portfolioReturns);
  const portfolioBeta = calculateBeta(portfolioReturns, alignedPortfolioSpyReturns);
  const portfolioSharpe = calculateSharpeRatio(portfolioAnnualReturn, portfolioVolatility);

  // Portfolio simulated prices list to calculate portfolio Max Drawdown
  const portfolioPrices = [100];
  portfolioReturns.forEach(ret => {
    const nextPrice = portfolioPrices[portfolioPrices.length - 1] * (1 + ret);
    portfolioPrices.push(nextPrice);
  });
  const portfolioMaxDrawdown = calculateMaxDrawdown(portfolioPrices);

  // Value-at-Risk (VaR) 1-day 95%
  const portfolioVaR = calculateVaR(totalPortfolioValue, portfolioVolatility, 0.95, 1);

  // Diversification Score
  const diversificationScore = calculateDiversificationScore(holdingsMetrics, sectorAllocations);

  const portfolioMetrics = {
    totalValue: totalPortfolioValue,
    annualReturn: portfolioAnnualReturn,
    volatility: portfolioVolatility,
    beta: portfolioBeta,
    sharpeRatio: portfolioSharpe,
    maxDrawdown: portfolioMaxDrawdown,
    valueAtRisk: portfolioVaR,
    diversificationScore
  };

  logs.push(`Market Analysis Agent: Portfolio calculations complete. Value: $${totalPortfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}, Beta: ${portfolioBeta.toFixed(2)}, Vol: ${(portfolioVolatility * 100).toFixed(1)}%, MaxDD: ${(portfolioMaxDrawdown * 100).toFixed(1)}%`);

  return {
    portfolioMetrics,
    holdings: holdingsMetrics,
    sectorAllocations
  };
}

module.exports = {
  runMarketAgent
};

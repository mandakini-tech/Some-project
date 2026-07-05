// ======================================================
// Quantitative Analysis Utilities
// ======================================================

const TRADING_DAYS = 252;
const RISK_FREE_RATE = 0.04;

// ------------------------------------------------------
// Convert CSV rows into ordered price series
// ------------------------------------------------------

export function toSeries(rows = []) {

  return rows
    .map(r => ({
      date: new Date(r.Date || r.date),
      close: Number(
        r["Adj Close"] ??
        r["AdjClose"] ??
        r["Adj_Close"] ??
        r["Close"] ??
        r["close"]
      )
    }))
    .filter(x =>
      x.date instanceof Date &&
      !isNaN(x.date) &&
      Number.isFinite(x.close)
    )
    .sort((a, b) => a.date - b.date);
}

// ------------------------------------------------------
// Daily Returns
// ------------------------------------------------------

export function dailyReturns(series) {

  const returns = [];

  for (let i = 1; i < series.length; i++) {

    const previous = series[i - 1].close;
    const current = series[i].close;

    if (previous > 0) {

      returns.push({

        date: series[i].date,

        r: (current - previous) / previous

      });

    }

  }

  return returns;
}

// ------------------------------------------------------
// Mean
// ------------------------------------------------------

export function mean(values = []) {

  if (!values.length) return 0;

  return values.reduce((a, b) => a + b, 0) / values.length;

}

// ------------------------------------------------------
// Standard Deviation
// ------------------------------------------------------

export function stdev(values = []) {

  if (values.length < 2)
    return 0;

  const avg = mean(values);

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - avg, 2),
      0
    ) / (values.length - 1);

  return Math.sqrt(variance);

}

// ------------------------------------------------------
// Covariance
// ------------------------------------------------------

export function covariance(xs = [], ys = []) {

  const n = Math.min(xs.length, ys.length);

  if (n < 2)
    return 0;

  const x = xs.slice(-n);

  const y = ys.slice(-n);

  const mx = mean(x);

  const my = mean(y);

  let total = 0;

  for (let i = 0; i < n; i++) {

    total +=
      (x[i] - mx) *
      (y[i] - my);

  }

  return total / (n - 1);

}

// ------------------------------------------------------
// Beta
// ------------------------------------------------------

export function beta(assetReturns, marketReturns) {

  const asset =
    assetReturns.map(r => r.r);

  const market =
    marketReturns.map(r => r.r);

  const cov =
    covariance(asset, market);

  const marketVariance =
    Math.pow(
      stdev(market),
      2
    );

  if (marketVariance === 0)
    return 1;

  return cov / marketVariance;

}

// ------------------------------------------------------
// Historical VaR
// ------------------------------------------------------

export function var95(assetReturns) {

  if (!assetReturns.length)
    return 0;

  const sorted =
    assetReturns
      .map(r => r.r)
      .sort((a, b) => a - b);

  const index =
    Math.floor(
      sorted.length * 0.05
    );

  return Math.abs(sorted[index]);

}

// ------------------------------------------------------
// Maximum Drawdown
// ------------------------------------------------------

export function maxDrawdown(prices) {

  if (prices.length < 2)
    return 0;

  let peak = prices[0];

  let maxDD = 0;

  for (const price of prices) {

    if (price > peak)
      peak = price;

    const dd =
      (peak - price) / peak;

    if (dd > maxDD)
      maxDD = dd;

  }

  return maxDD;

}

// ------------------------------------------------------
// Momentum
// ------------------------------------------------------

export function momentum(prices, days = 30) {

  if (prices.length <= days)
    return 0;

  const latest =
    prices[prices.length - 1];

  const old =
    prices[prices.length - 1 - days];

  return (latest - old) / old;

}

// ------------------------------------------------------
// CAGR
// ------------------------------------------------------

export function annualReturn(prices) {

  if (prices.length < 2)
    return 0;

  const years =
    prices.length /
    TRADING_DAYS;

  return (
    Math.pow(
      prices[prices.length - 1] /
      prices[0],
      1 / years
    ) - 1
  );

}

// ------------------------------------------------------
// Sharpe Ratio
// ------------------------------------------------------

export function sharpeRatio(
  annualReturn,
  annualVolatility
) {

  if (
    annualVolatility <= 0
  )
    return 0;

  return (
    annualReturn -
    RISK_FREE_RATE
  ) / annualVolatility;

}

// ======================================================
// Main Summary
// ======================================================

export function summarize(
  assetRows,
  spyRows
) {

  const assetSeries =
    toSeries(assetRows);

  const marketSeries =
    toSeries(spyRows);

  const assetReturns =
    dailyReturns(assetSeries);

  const marketReturns =
    dailyReturns(marketSeries);

  const prices =
    assetSeries.map(
      x => x.close
    );

  const returns =
    assetReturns.map(
      x => x.r
    );

  const dailyVol =
    stdev(returns);

  const annualVol =
    dailyVol *
    Math.sqrt(TRADING_DAYS);

  const annReturn =
    annualReturn(prices);

  const sharpe =
    sharpeRatio(
      annReturn,
      annualVol
    );

  return {

    nPrices:
      prices.length,

    nReturns:
      returns.length,

    lastPrice:
      prices.length
        ? prices[
            prices.length - 1
          ]
        : null,

    beta:
      beta(
        assetReturns,
        marketReturns
      ),

    volatilityDaily:
      dailyVol,

    volatilityAnnualized:
      annualVol,

    annualReturn:
      annReturn,

    sharpeRatio:
      Number(
        sharpe.toFixed(2)
      ),

    maxDrawdown:
      maxDrawdown(prices),

    momentum:
      momentum(prices),

    var95:
      var95(assetReturns)

  };

}
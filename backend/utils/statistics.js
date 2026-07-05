/**
 * Statistics and Quantitative Finance Utility Functions
 */

/**
 * Calculate the mean of an array of numbers
 */
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate the sample variance of an array of numbers
 */
function variance(arr, avg) {
  if (!arr || arr.length <= 1) return 0;
  const meanVal = avg !== undefined ? avg : mean(arr);
  const sumSqDiffs = arr.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0);
  return sumSqDiffs / (arr.length - 1);
}

/**
 * Calculate the sample standard deviation (volatility) of an array of numbers
 */
function stdDev(arr, avg) {
  if (!arr || arr.length <= 1) return 0;
  return Math.sqrt(variance(arr, avg));
}

/**
 * Calculate the sample covariance between two arrays of numbers
 */
function covariance(arr1, arr2) {
  const n = Math.min(arr1.length, arr2.length);
  if (n <= 1) return 0;

  const mean1 = mean(arr1);
  const mean2 = mean(arr2);

  let sumDiffProduct = 0;
  for (let i = 0; i < n; i++) {
    sumDiffProduct += (arr1[i] - mean1) * (arr2[i] - mean2);
  }

  return sumDiffProduct / (n - 1);
}

/**
 * Calculate Beta of a stock returns array relative to the market returns array
 */
function calculateBeta(stockReturns, marketReturns) {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n <= 1) return 1.0; // default to market beta

  const cov = covariance(stockReturns, marketReturns);
  const marketVar = variance(marketReturns);

  return marketVar > 0 ? cov / marketVar : 1.0;
}

/**
 * Calculate Annual Return (assuming 252 trading days)
 */
function calculateAnnualReturn(dailyReturns) {

    if (!dailyReturns.length)
        return 0;

    const avg =
        mean(dailyReturns);

    return avg * 252;
}

/**
 * Calculate Annualized Volatility (assuming 252 trading days)
 */
function calculateAnnualizedVolatility(dailyReturns) {
  if (!dailyReturns || dailyReturns.length <= 1) return 0;
  return stdDev(dailyReturns) * Math.sqrt(252);
}

/**
 * Calculate Sharpe Ratio (assuming standard 4% risk-free rate)
 */
function calculateSharpeRatio(
    annualReturn,
    annualizedVolatility,
    riskFreeRate = 0.04
) {

    if (
        annualizedVolatility <= 0 ||
        !isFinite(annualizedVolatility)
    )
        return 0;

    return Number(
        (
            (annualReturn - riskFreeRate) /
            annualizedVolatility
        ).toFixed(2)
    );
}

/**
 * Calculate Maximum Drawdown of price history
 * prices: array of numbers (e.g. closing prices chronologically)
 */
function calculateMaxDrawdown(prices){

    if(prices.length<2)
        return 0;

    let peak=prices[0];
    let maxDD=0;

    for(const price of prices){

        if(price>peak)
            peak=price;

        const dd=
            (peak-price)/peak;

        if(dd>maxDD)
            maxDD=dd;
    }

    return maxDD;
}

/**
 * Calculate 30-day Momentum (percentage change over last 30 trading days)
 */
function calculateMomentum(prices, window = 30) {
  if (!prices || prices.length <= 1) return 0;
  const latestPrice = prices[prices.length - 1];
  const referenceIdx = Math.max(0, prices.length - 1 - window);
  const referencePrice = prices[referenceIdx];
  
  if (referencePrice <= 0) return 0;
  return (latestPrice - referencePrice) / referencePrice;
}

module.exports = {
  mean,
  variance,
  stdDev,
  covariance,
  calculateBeta,
  calculateAnnualReturn,
  calculateAnnualizedVolatility,
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateMomentum
};

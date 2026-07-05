const { mean, stdDev } = require('./statistics');

/**
 * Quantifies Value-at-Risk (VaR) using the parametric (Variance-Covariance) method.
 * VaR = Portfolio Value * (Portfolio Volatility / sqrt(252) * Z)
 * Z = 1.645 for 95% confidence level, 2.326 for 99% confidence level.
 */
export function calculateVaR(
    portfolioValue,
    annualizedVolatility,
    confidenceLevel = 0.95,
    days = 1
) {
    if (portfolioValue <= 0 || annualizedVolatility <= 0)
        return 0;

    let z = 1.645;

    if (confidenceLevel === 0.99)
        z = 2.326;

    if (confidenceLevel === 0.90)
        z = 1.282;

    const dailyVol =
        annualizedVolatility / Math.sqrt(252);

    const timeAdjustedVol =
        dailyVol * Math.sqrt(days);

    const var95 =
        portfolioValue *
        timeAdjustedVol *
        z;

    return Number(var95.toFixed(2));
}

/**
 * Computes portfolio-wide diversification score (0 - 100).
 * High concentration in a single stock or sector reduces this score.
 */
function calculateDiversificationScore(holdings, sectorAllocations) {
  const numHoldings = holdings.length;
  if (numHoldings === 0) return 100;
  if (numHoldings === 1) return 30; // Sole asset is heavily concentrated

  let maxWeight = 0;
  let sectorConcentrationPenalty = 0;

  holdings.forEach(h => {
    const weight = h.weight / 100; // convert percentage to fraction
    if (weight > maxWeight) maxWeight = weight;
  });

  Object.values(sectorAllocations).forEach(weight => {
    // weight is a fraction of total portfolio value
    if (weight > 0.5) {
      sectorConcentrationPenalty += (weight - 0.5) * 60; // Penalize weight over 50%
    }
  });

  // Ideal weight is 1 / numHoldings. Deviation from ideal weight penalizes score.
  const idealWeight = 1 / numHoldings;
  const weightConcentrationPenalty = (maxWeight - idealWeight) * 50;

  let rawScore = 100 - weightConcentrationPenalty - sectorConcentrationPenalty;
  
  // Cap score between 10 and 100
  return Math.max(10, Math.min(100, Math.round(rawScore)));
}

module.exports = {
  calculateVaR,
  calculateDiversificationScore
};

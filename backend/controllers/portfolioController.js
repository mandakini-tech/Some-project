import Portfolio from "../models/Portfolio.js";
import { analyzePortfolioRisk } from "../Services/aiservices.js";
import { dbState } from "../Config/db.js";

// Helper to get fallback portfolio or create if not exists
const getFallbackPortfolio = (userId, data) => {
  let portfolio = data.portfolios.find(p => p.user === userId);
  if (!portfolio) {
    portfolio = {
      id: `portfolio_${Date.now()}`,
      user: userId,
      holdings: [],
      riskMetrics: {
        beta: 0,
        volatility: 0,
        valueAtRisk: 0,
        diversificationScore: 100,
        lastAnalyzed: null,
        agentReport: '',
        agentLogs: []
      },
      updatedAt: new Date().toISOString()
    };
    data.portfolios.push(portfolio);
    dbState.writeFallbackData(data);
  }
  return portfolio;
};

// @desc    Get current user portfolio
// @route   GET /api/portfolio
// @access  Private
const getPortfolio = async  (req, res) => {
  try {
    if (dbState.isFallback) {
      const data = dbState.readFallbackData();
      const portfolio = getFallbackPortfolio(req.user.id, data);
      return res.json(portfolio);
    } else {
      let portfolio = await Portfolio.findOne({ user: req.user.id });
      if (!portfolio) {
        portfolio = new Portfolio({ user: req.user.id, holdings: [] });
        await portfolio.save();
      }
      return res.json(portfolio);
    }
  } catch (err) {
    console.error('Get portfolio error:', err.message);
    res.status(500).send('Server error retrieving portfolio');
  }
};

// @desc    Add stock holding to portfolio
// @route   POST /api/portfolio/holdings
// @access  Private
const addHolding = async (req, res) => {
  let { ticker, shares, buyPrice } = req.body;

  if (!ticker || !shares || !buyPrice) {
    return res.status(400).json({ msg: 'Please provide ticker, shares, and purchase price' });
  }

  ticker = ticker.toUpperCase().trim();
  shares = parseFloat(shares);
  buyPrice = parseFloat(buyPrice);

  if (isNaN(shares) || shares <= 0) {
    return res.status(400).json({ msg: 'Shares must be a positive number' });
  }
  if (isNaN(buyPrice) || buyPrice < 0) {
    return res.status(400).json({ msg: 'Purchase price must be a non-negative number' });
  }

  try {
    if (dbState.isFallback) {
      const data = dbState.readFallbackData();
      const portfolio = getFallbackPortfolio(req.user.id, data);

      const existingHoldingIndex = portfolio.holdings.findIndex(h => h.ticker === ticker);
      if (existingHoldingIndex > -1) {
        // Average the buy price and add shares
        const existing = portfolio.holdings[existingHoldingIndex];
        const newTotalShares = existing.shares + shares;
        const newAverageBuyPrice = ((existing.shares * existing.buyPrice) + (shares * buyPrice)) / newTotalShares;
        
        existing.shares = parseFloat(newTotalShares.toFixed(4));
        existing.buyPrice = parseFloat(newAverageBuyPrice.toFixed(2));
      } else {
        portfolio.holdings.push({
          id: `holding_${Date.now()}`,
          ticker,
          shares,
          buyPrice
        });
      }

      // Automatically recalculate base risk metrics
      const analysis = await analyzePortfolioRisk(portfolio.holdings);
      portfolio.riskMetrics = {
        ...analysis.metrics,
        lastAnalyzed: new Date().toISOString(),
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      };
      portfolio.updatedAt = new Date().toISOString();

      dbState.writeFallbackData(data);
      return res.json(portfolio);

    } else {
      let portfolio = await Portfolio.findOne({ user: req.user.id });
      if (!portfolio) {
        portfolio = new Portfolio({ user: req.user.id, holdings: [] });
      }

      const existingHolding = portfolio.holdings.find(h => h.ticker === ticker);
      if (existingHolding) {
        const newTotalShares = existingHolding.shares + shares;
        const newAverageBuyPrice = ((existingHolding.shares * existingHolding.buyPrice) + (shares * buyPrice)) / newTotalShares;
        
        existingHolding.shares = parseFloat(newTotalShares.toFixed(4));
        existingHolding.buyPrice = parseFloat(newAverageBuyPrice.toFixed(2));
      } else {
        portfolio.holdings.push({ ticker, shares, buyPrice });
      }

      // Automatically recalculate base risk metrics
      const analysis = await analyzePortfolioRisk(portfolio.holdings);
      portfolio.riskMetrics = {
        ...analysis.metrics,
        lastAnalyzed: new Date(),
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      };
      portfolio.updatedAt = new Date();

      await portfolio.save();
      return res.json(portfolio);
    }
  } catch (err) {
    console.error('Add holding error:', err.message);
    res.status(500).send('Server error adding stock holding');
  }
};

// @desc    Delete stock holding from portfolio
// @route   DELETE /api/portfolio/holdings/:ticker
// @access  Private
const removeHolding = async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().trim();

  try {
    if (dbState.isFallback) {
      const data = dbState.readFallbackData();
      const portfolio = getFallbackPortfolio(req.user.id, data);

      const holdingIndex = portfolio.holdings.findIndex(h => h.ticker === ticker);
      if (holdingIndex === -1) {
        return res.status(404).json({ msg: 'Holding not found in portfolio' });
      }

      portfolio.holdings.splice(holdingIndex, 1);

      // Recalculate metrics
      const analysis = await analyzePortfolioRisk(portfolio.holdings);
      portfolio.riskMetrics = {
        ...analysis.metrics,
        lastAnalyzed: new Date().toISOString(),
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      };
      portfolio.updatedAt = new Date().toISOString();

      dbState.writeFallbackData(data);
      return res.json(portfolio);

    } else {
      let portfolio = await Portfolio.findOne({ user: req.user.id });
      if (!portfolio) {
        return res.status(404).json({ msg: 'Portfolio not found' });
      }

      const holdingIndex = portfolio.holdings.findIndex(h => h.ticker === ticker);
      if (holdingIndex === -1) {
        return res.status(404).json({ msg: 'Holding not found in portfolio' });
      }

      portfolio.holdings.splice(holdingIndex, 1);

      // Recalculate metrics
      const analysis = await analyzePortfolioRisk(portfolio.holdings);
      portfolio.riskMetrics = {
        ...analysis.metrics,
        lastAnalyzed: new Date(),
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      };
      portfolio.updatedAt = new Date();

      await portfolio.save();
      return res.json(portfolio);
    }
  } catch (err) {
    console.error('Remove holding error:', err.message);
    res.status(500).send('Server error removing stock holding');
  }
};

// @desc    Re-analyze portfolio and get detailed Multi-Agent report
// @route   POST /api/portfolio/analyze
// @access  Private
const analyzePortfolio = async (req, res) => {
  try {
    if (dbState.isFallback) {
      const data = dbState.readFallbackData();
      const portfolio = getFallbackPortfolio(req.user.id, data);

      if (portfolio.holdings.length === 0) {
        return res.status(400).json({ msg: 'Cannot analyze an empty portfolio' });
      }

      const analysis = await analyzePortfolioRisk(portfolio.holdings);
      portfolio.riskMetrics = {
        ...analysis.metrics,
        lastAnalyzed: new Date().toISOString(),
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      };
      portfolio.updatedAt = new Date().toISOString();

      dbState.writeFallbackData(data);
      return res.json({
        metrics: analysis.metrics,
        holdings: analysis.holdings,
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      });

    } else {
      const portfolio = await Portfolio.findOne({ user: req.user.id });
      if (!portfolio) {
        return res.status(404).json({ msg: 'Portfolio not found' });
      }

      if (portfolio.holdings.length === 0) {
        return res.status(400).json({ msg: 'Cannot analyze an empty portfolio' });
      }

      const analysis = await analyzePortfolioRisk(portfolio.holdings);
      portfolio.riskMetrics = {
        ...analysis.metrics,
        lastAnalyzed: new Date(),
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      };
      portfolio.updatedAt = new Date();

      await portfolio.save();
      return res.json({
        metrics: analysis.metrics,
        holdings: analysis.holdings,
        agentReport: analysis.agentReport,
        agentLogs: analysis.agentLogs
      });
    }
  } catch (err) {
    console.error('Analyze portfolio error:', err.message);
    res.status(500).send('Server error running risk analysis');
  }
};

export {
  getPortfolio,
  addHolding,
  removeHolding,
  analyzePortfolio,
};
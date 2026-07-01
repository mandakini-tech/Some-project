const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes here are private and require authorization header
router.use(authMiddleware);

// @route   GET api/portfolio
// @desc    Get user portfolio and risk stats
router.get('/', portfolioController.getPortfolio);

// @route   POST api/portfolio/holdings
// @desc    Add or update holding in portfolio
router.post('/holdings', portfolioController.addHolding);

// @route   DELETE api/portfolio/holdings/:ticker
// @desc    Remove holding from portfolio
router.delete('/holdings/:ticker', portfolioController.removeHolding);

// @route   POST api/portfolio/analyze
// @desc    Trigger LangChain multi-agent risk analysis
router.post('/analyze', portfolioController.analyzePortfolio);

module.exports = router;

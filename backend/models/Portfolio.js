const mongoose = require('mongoose');

const HoldingSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  shares: {
    type: Number,
    required: true,
    min: 0.0001
  },
  buyPrice: {
    type: Number,
    required: true,
    min: 0
  }
});

const RiskMetricsSchema = new mongoose.Schema({
  beta: { type: Number, default: 0 },
  volatility: { type: Number, default: 0 },
  valueAtRisk: { type: Number, default: 0 },
  diversificationScore: { type: Number, default: 0 },
  annualReturn: { type: Number, default: 0 },
  sharpeRatio: { type: Number, default: 0 },
  maxDrawdown: { type: Number, default: 0 },
  lastAnalyzed: { type: Date },
  agentReport: { type: String, default: '' },
  agentLogs: { type: [String], default: [] }
});

const PortfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  holdings: [HoldingSchema],
  riskMetrics: {
    type: RiskMetricsSchema,
    default: () => ({})
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Portfolio', PortfolioSchema);

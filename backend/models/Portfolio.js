import mongoose from "mongoose";

const HoldingSchema = new mongoose.Schema(
  {
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    shares: {
      type: Number,
      required: true,
      min: 0.0001,
    },

    buyPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Calculated / enriched fields
    currentPrice: {
      type: Number,
      default: 0,
    },

    currentValue: {
      type: Number,
      default: 0,
    },

    sector: {
      type: String,
      default: "Unknown",
    },

    industry: {
      type: String,
      default: "Unknown",
    },

    longName: {
      type: String,
      default: "",
    },

    beta: {
      type: Number,
      default: 0,
    },

    volatility: {
      type: Number,
      default: 0,
    },

    valueAtRisk: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const RiskMetricsSchema = new mongoose.Schema(
  {
    beta: { type: Number, default: 0 },
    volatility: { type: Number, default: 0 },
    valueAtRisk: { type: Number, default: 0 },

    diversificationScore: { type: Number, default: 100 },

    annualReturn: { type: Number, default: 0 },

    sharpeRatio: { type: Number, default: 0 },

    maxDrawdown: { type: Number, default: 0 },

    lastAnalyzed: Date,

    agentReport: {
      type: String,
      default: "",
    },

    agentLogs: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const PortfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    holdings: {
      type: [HoldingSchema],
      default: [],
    },

    riskMetrics: {
      type: RiskMetricsSchema,
      default: () => ({}),
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Portfolio", PortfolioSchema);
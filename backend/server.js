import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB, dbState } from "./Config/db.js";

import userRoutes from "./routes/userRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import riskRoutes from "./routes/risk.js";

dotenv.config();

const app = express();

// Connect Database
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/risk", riskRoutes);

// Health Check Route
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    database: dbState.isFallback
      ? "fallback-json-file"
      : "mongodb-connection",
    timestamp: new Date().toISOString(),
  });
});

// Root Route
app.get("/", (req, res) => {
  res.json({
    message: "Investment Risk Analyzer API is running",
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("===================================================");
  console.log(`🚀 Investment Risk Analyzer Server running on port ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}`);
  console.log(`❤️ Health: http://localhost:${PORT}/api/health`);
  console.log("===================================================");
});
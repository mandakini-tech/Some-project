import express from "express";
import cors from "cors";
import riskRoutes from "./routes/risk.js";
// ...other imports (auth, portfolios) you already have

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/risk", riskRoutes);


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./Config/db');

const app = express();

// 1. Establish Database Connection (gracefully handles failure)
connectDB();

// 2. Setup Middlewares
app.use(cors());
app.use(express.json());

// 3. Define Route Middlewares
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/portfolio', require('./routes/portfolioRoutes'));

// Root diagnostic route
app.get('/api/health', (req, res) => {
  const { dbState } = require('./Config/db');
  res.json({
    status: 'healthy',
    database: dbState.isFallback ? 'fallback-json-file' : 'mongodb-connection',
    timestamp: new Date().toISOString()
  });
});

// 4. Listen on Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Investment Risk Analyzer server running on port ${PORT}`);
  console.log(`🌐 API Health Endpoint: http://localhost:${PORT}/api/health`);
  console.log(`===================================================`);
});

import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  getPortfolio,
  addHolding,
  removeHolding,
  analyzePortfolio,
} from "../controllers/portfolioController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getPortfolio);

router.post("/holdings", addHolding);

router.delete("/holdings/:ticker", removeHolding);

router.post("/analyze", analyzePortfolio);

export default router;
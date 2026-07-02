import { Router } from "express";
import { analyzeTicker } from "../Services/aiservices.js";

const router = Router();

// GET /api/risk/:ticker
router.get("/:ticker", async (req, res) => {
  try {
    const data = await analyzeTicker(req.params.ticker);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// POST /api/risk/portfolio
// body: { holdings: [{ ticker, shares, avgPrice }], market: "SPY" }
router.post("/portfolio", async (req, res) => {
  const { holdings = [], market = "SPY" } = req.body || {};
  try {
    const per = [];
    for (const h of holdings) per.push(await analyzeTicker(h.ticker));
    // simple aggregate: weight by market value using lastPrice
    const totalMV = per.reduce((s,x,i)=> s + (holdings[i].shares||0)*(x.stats.lastPrice||0), 0);
    const weights = per.map((x,i)=> {
      const mv = (holdings[i].shares||0)*(x.stats.lastPrice||0);
      return totalMV>0 ? mv/totalMV : 0;
    });
    const aggBeta = per.reduce((s,x,i)=> s + weights[i]*(x.stats.beta||0), 0);
    const aggVol = Math.sqrt(per.reduce((s,x,i)=> s + Math.pow(weights[i]*(x.stats.volatilityAnnualized||0), 2), 0)); // ignores corr
    const md = [
      `# Portfolio Risk`,
      `- Aggregate Beta (vs SPY): ${aggBeta.toFixed(2)}`,
      `- Approx. Aggregated Volatility (ann., naive): ${(aggVol*100).toFixed(2)}%`,
      ``,
      `## Constituents`,
      ...per.map((x,i)=> `- ${x.ticker}: w=${(weights[i]*100).toFixed(1)}%, beta=${x.stats.beta.toFixed(2)}, vol_ann=${(x.stats.volatilityAnnualized*100).toFixed(2)}%`)
    ].join("\n");
    res.json({ ok: true, data: { per, weights, aggregate: { beta: aggBeta, volAnnualized: aggVol, reportMarkdown: md } } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

export default router;

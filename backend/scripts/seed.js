import { runPython } from "../utils/python.js";
import path from "node:path";

const tickers = ["SPY","AAPL","MSFT","AMZN","GOOGL","META","NVDA","TSLA","JPM","UNH","XOM"];

async function main(){
  const script = path.resolve(process.cwd(),"backend","scripts","download_yfinance.py");
  for (const t of tickers) {
    try {
      const r = await runPython([script, t]);
      console.log(`Seeded ${t}: ${r.out.trim()}`);
    } catch(e) {
      console.error(`Seed ${t} failed:`, e.message);
    }
  }
}
main();

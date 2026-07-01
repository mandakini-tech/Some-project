// Simple, dependable stats on Close prices.
// rows: [{Date, Open, High, Low, Close, Adj Close, Volume, ...}]
export function toSeries(rows) {
  return rows
    .map(r => ({
      date: new Date(r.Date || r.date),
      close: Number(r["Adj Close"] || r["AdjClose"] || r["Adj_Close"] || r["Close"] || r["close"]),
    }))
    .filter(x => Number.isFinite(x.close))
    .sort((a,b)=>a.date-b.date);
}

export function dailyReturns(series) {
  const out = [];
  for (let i=1;i<series.length;i++) {
    const r = (series[i].close/series[i-1].close)-1;
    out.push({ date: series[i].date, r });
  }
  return out;
}

export function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a,b)=>a+b,0)/xs.length;
}

export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s,x)=>s+(x-m)*(x-m),0)/(xs.length-1);
  return Math.sqrt(v);
}

export function covariance(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(-n));
  const my = mean(ys.slice(-n));
  let acc = 0;
  for (let i=0;i<n;i++) acc += (xs[xs.length-n+i]-mx)*(ys[ys.length-n+i]-my);
  return acc/(n-1);
}

export function beta(assetRets, marketRets) {
  const xs = assetRets.map(x=>x.r);
  const ys = marketRets.map(x=>x.r);
  const cov = covariance(xs, ys);
  const varM = stdev(ys)**2;
  return varM === 0 ? 0 : cov/varM;
}

export function var95(assetRets) {
  if (!assetRets.length) return 0;
  const arr = assetRets.map(x=>x.r).slice().sort((a,b)=>a-b);
  const idx = Math.floor(0.05*arr.length);
  return arr[idx]; // negative number means 5% tail loss
}

export function summarize(assetRows, spyRows) {
  const sA = toSeries(assetRows);
  const sM = toSeries(spyRows);
  const rA = dailyReturns(sA);
  const rM = dailyReturns(sM);
  const sd = stdev(rA.map(x=>x.r));
  return {
    nPrices: sA.length,
    nReturns: rA.length,
    volatilityDaily: sd,
    volatilityAnnualized: sd * Math.sqrt(252),
    beta: beta(rA, rM),
    var95: var95(rA),
    lastPrice: sA.length ? sA[sA.length-1].close : null,
  };
}

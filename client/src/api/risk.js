const BASE = import.meta.env.VITE_API_URL || "[localhost](http://localhost:5000)";

export async function getTickerRisk(ticker) {
  const res = await fetch(`${BASE}/api/risk/${encodeURIComponent(ticker)}`);
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "risk error");
  return j.data;
}

export async function postPortfolioRisk(holdings) {
  const res = await fetch(`${BASE}/api/risk/portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings })
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "risk error");
  return j.data;
}

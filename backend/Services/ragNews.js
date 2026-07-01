import { readJSON, tickerPaths, fileExists } from "../utils/fileIO.js";

const STATIC_INFO = (t)=>({
  ticker: t.toUpperCase(),
  sector: "Unknown",
  industry: "Unknown",
  longName: t.toUpperCase()
});

export async function loadInfo(ticker) {
  const { info } = tickerPaths(ticker);
  if (await fileExists(info)) return await readJSON(info, STATIC_INFO(ticker));
  return STATIC_INFO(ticker);
}

export async function loadNews(ticker) {
  const { news } = tickerPaths(ticker);
  const data = await readJSON(news, { news: [] });
  return Array.isArray(data.news) ? data.news : [];
}

// simple retrieval: latest k items (could embed later)
export async function retrieveNews(ticker, k=5) {
  const all = await loadNews(ticker);
  return all
    .sort((a,b)=> (b.providerPublishTime||0) - (a.providerPublishTime||0))
    .slice(0,k);
}

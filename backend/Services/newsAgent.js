/**
 * News Analysis & RAG Agent
 * Responsibilities:
 * - Load, parse, and clean recent news items from the local JSON files
 * - Rank headlines based on market relevance and sentiment polarity
 * - Assemble a rich RAG context block containing qualitative news threats and fundamental ratios
 */
function runNewsAgent(holdings, logs) {
  logs.push('News Agent: Preparing qualitative risk contexts and fundamental analysis...');
  
  const ragContexts = [];
  
  holdings.forEach(h => {
    const ticker = h.ticker;
    const info = h.info || {};
    const news = h.news || [];
    
    logs.push(`News Agent: Extracting fundamentals and ranking headlines for ${ticker}...`);

    // 1. Format corporate fundamental metrics for RAG
    const marketCap = info.marketCap ? `$${(info.marketCap / 1e9).toFixed(2)}B` : 'N/A';
    const peRatio = info.forwardPE || info.trailingPE || 'N/A';
    const low52 = info.fiftyTwoWeekLow ? `$${info.fiftyTwoWeekLow}` : 'N/A';
    const high52 = info.fiftyTwoWeekHigh ? `$${info.fiftyTwoWeekHigh}` : 'N/A';
    const profitMargin = info.profitMargins ? `${(info.profitMargins * 100).toFixed(2)}%` : 'N/A';
    const divYield = info.dividendYield ? `${(info.dividendYield * 100).toFixed(2)}%` : 'N/A';
    
    // Revenue extraction (handle varying yfinance info keys)
    const revenue = info.totalRevenue 
      ? `$${(info.totalRevenue / 1e9).toFixed(2)}B` 
      : (info.revenue ? `$${(info.revenue / 1e9).toFixed(2)}B` : 'N/A');

    // 2. Rank headlines by keyword relevance and sentiment strength
    // We prioritize headlines with strong keywords or non-neutral sentiment
    const rankedNews = [...news].map(item => {
      let priorityScore = 0;
      const titleLower = item.title.toLowerCase();
      
      // Keywords that increase article relevance for risk analysis
      const threatKeywords = ['risk', 'antitrust', 'lawsuit', 'litigation', 'drop', 'slump', 'miss', 'cut', 'warning', 'margin', 'supply chain', 'downsize'];
      const growthKeywords = ['ai', 'upgrade', 'beats', 'launch', 'growth', 'acquisition', 'bullish', 'strong'];
      
      threatKeywords.forEach(k => { if (titleLower.includes(k)) priorityScore += 3; });
      growthKeywords.forEach(k => { if (titleLower.includes(k)) priorityScore += 2; });
      
      if (item.sentiment !== 'Neutral') priorityScore += 1;
      
      return { ...item, priorityScore };
    }).sort((a, b) => {
      // Sort primarily by priority score, and secondarily by date (most recent first)
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return new Date(b.published) - new Date(a.published);
    });

    // Take top 4 news items for RAG context to keep LLM context clean
    const topNews = rankedNews.slice(0, 4);

    // 3. Assemble RAG report segment for this stock
    let stockContext = `### ${h.longName} (${ticker})\n`;
    stockContext += `- **Sector:** ${h.sector}\n`;
    stockContext += `- **Market Capitalization:** ${marketCap}\n`;
    stockContext += `- **P/E Ratio:** ${peRatio}\n`;
    stockContext += `- **52-Week Range:** ${low52} - ${high52}\n`;
    stockContext += `- **Revenue:** ${revenue}\n`;
    stockContext += `- **Profit Margin:** ${profitMargin}\n`;
    stockContext += `- **Dividend Yield:** ${divYield}\n`;
    
    if (info.longBusinessSummary) {
      // Truncate summary to keep context size manageable
      const summary = info.longBusinessSummary.slice(0, 250) + '...';
      stockContext += `- **Business Summary:** ${summary}\n`;
    }

    stockContext += `- **Top Financial News & Alerts:**\n`;
    if (topNews.length === 0) {
      stockContext += `  * No active news warnings found in local database.\n`;
    } else {
      topNews.forEach((n, idx) => {
        const dateStr = n.published ? new Date(n.published).toLocaleDateString() : 'Recent';
        stockContext += `  ${idx + 1}. **[${n.sentiment}]** *${n.title}* (${n.publisher} - ${dateStr})\n`;
        if (n.summary && n.summary !== `Headline: ${n.title}. Publisher: ${n.publisher}.`) {
          stockContext += `     > Summary: ${n.summary.slice(0, 150)}...\n`;
        }
      });
    }

    ragContexts.push({
      ticker,
      contextString: stockContext,
      newsAlerts: topNews
    });
  });

  logs.push(`News Agent: Assembled RAG context blocks for ${ragContexts.length} assets.`);
  return {
    ragContexts
  };
}

module.exports = {
  runNewsAgent
};

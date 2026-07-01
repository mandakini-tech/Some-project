import React, { useState } from 'react';
import { getTickerRisk, postPortfolioRisk } from "../api/risk";
import TickerCard from "./TickerCard";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { 
  TrendingUp, 
  Trash2, 
  Plus, 
  Activity, 
  ShieldAlert, 
  Cpu, 
  FileText, 
  RefreshCw, 
  FolderPlus, 
  AlertTriangle 
} from 'lucide-react';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend);

// Custom, Lightweight, and Safe Markdown Parser for React
const renderMarkdown = (mdText) => {
  if (!mdText) return null;

  const lines = mdText.split('\n');
  let currentList = [];
  const elements = [];
  let inBlockquote = false;
  let blockquoteContent = [];

  const flushList = (key) => {
    if (currentList.length > 0) {
      elements.push(<ul key={`list-${key}`}>{...currentList}</ul>);
      currentList = [];
    }
  };

  const flushBlockquote = (key) => {
    if (inBlockquote && blockquoteContent.length > 0) {
      elements.push(
        <blockquote key={`quote-${key}`}>
          {blockquoteContent.join(' ')}
        </blockquote>
      );
      blockquoteContent = [];
      inBlockquote = false;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushList(index);
      inBlockquote = true;
      blockquoteContent.push(trimmed.slice(1).replace(/"/g, '').trim());
      return;
    } else {
      flushBlockquote(index);
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      flushList(index);
      elements.push(<h1 key={`h1-${index}`}>{trimmed.slice(2)}</h1>);
    } else if (trimmed.startsWith('## ')) {
      flushList(index);
      elements.push(<h2 key={`h2-${index}`}>{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('### ')) {
      flushList(index);
      elements.push(<h3 key={`h3-${index}`}>{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith('---')) {
      flushList(index);
      elements.push(<hr key={`hr-${index}`} style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '18px 0' }} />);
    }
    // List Items
    else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      let contentStr = trimmed.slice(2);
      // Parse strong/bold text inside bullets (e.g., **Text:**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIdx = 0;
      let match;
      let matchCount = 0;

      while ((match = boldRegex.exec(contentStr)) !== null) {
        if (match.index > lastIdx) {
          parts.push(contentStr.substring(lastIdx, match.index));
        }
        parts.push(<strong key={`bold-${index}-${matchCount}`}>{match[1]}</strong>);
        lastIdx = boldRegex.lastIndex;
        matchCount++;
      }
      if (lastIdx < contentStr.length) {
        parts.push(contentStr.substring(lastIdx));
      }

      const finalContent = parts.length > 0 ? parts : contentStr;
      currentList.push(<li key={`li-${index}`}>{finalContent}</li>);
    } 
    // Normal paragraphs
    else if (trimmed.length > 0) {
      flushList(index);
      
      // Inline code highlights
      let contentStr = trimmed;
      const codeRegex = /`(.*?)`/g;
      const parts = [];
      let lastIdx = 0;
      let match;
      let matchCount = 0;

      while ((match = codeRegex.exec(contentStr)) !== null) {
        if (match.index > lastIdx) {
          parts.push(contentStr.substring(lastIdx, match.index));
        }
        parts.push(<code key={`code-${index}-${matchCount}`}>{match[1]}</code>);
        lastIdx = codeRegex.lastIndex;
        matchCount++;
      }
      if (lastIdx < contentStr.length) {
        parts.push(contentStr.substring(lastIdx));
      }

      const finalContent = parts.length > 0 ? parts : contentStr;
      elements.push(<p key={`p-${index}`}>{finalContent}</p>);
    } else {
      flushList(index);
    }
  });

  flushList(lines.length);
  flushBlockquote(lines.length);

  return elements;
};

export default function Dashboard({ 
  portfolio, 
  onAddHolding, 
  onRemoveHolding, 
  onAnalyzePortfolio,
  isActionLoading,
  isAnalyzing,
  notification
}) {
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [buyPrice, setBuyPrice] = useState('');

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!ticker || !shares || !buyPrice) return;
    onAddHolding(ticker.trim(), shares, buyPrice);
    setTicker('');
    setShares('');
    setBuyPrice('');
  };

  const holdings = portfolio.holdings || [];
  const metrics = portfolio.riskMetrics || { beta: 0, volatility: 0, valueAtRisk: 0, diversificationScore: 100 };

  // Calculate dynamic parameters for charts
  const totalValue = holdings.reduce((sum, h) => sum + (h.shares * (h.currentPrice || h.buyPrice)), 0);

  const sectorDataMap = {};
  holdings.forEach(h => {
    const val = h.shares * (h.currentPrice || h.buyPrice);
    const sector = h.sector || 'Other';
    sectorDataMap[sector] = (sectorDataMap[sector] || 0) + val;
  });

  const chartLabels = Object.keys(sectorDataMap);
  const chartValues = Object.values(sectorDataMap);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        data: chartValues,
        backgroundColor: [
          'rgba(59, 130, 246, 0.45)',  // Blue
          'rgba(139, 92, 246, 0.45)', // Purple
          'rgba(16, 185, 129, 0.45)', // Green
          'rgba(245, 158, 11, 0.45)', // Yellow/Amber
          'rgba(239, 68, 68, 0.45)',  // Red
          'rgba(236, 72, 153, 0.45)', // Pink
          'rgba(6, 182, 212, 0.45)'   // Cyan
        ],
        borderColor: [
          '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'
        ],
        borderWidth: 1.5,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#e2e8f0',
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const val = context.raw || 0;
            const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : 0;
            return ` $${val.toLocaleString(undefined, {maximumFractionDigits: 0})} (${pct}%)`;
          }
        }
      }
    },
    maintainAspectRatio: false
  };

  // Get Risk level classification
  const getBetaLevel = (b) => {
    if (b > 1.25) return { text: 'High Risk (Cyclical)', class: 'high-risk' };
    if (b > 0.8) return { text: 'Moderate Risk (Market-like)', class: 'mod-risk' };
    return { text: 'Low Risk (Defensive)', class: 'low-risk' };
  };

  const getVolatilityLevel = (v) => {
    if (v > 0.3) return { text: 'High Volatility', class: 'high-risk' };
    if (v > 0.15) return { text: 'Moderate Volatility', class: 'mod-risk' };
    return { text: 'Low Volatility', class: 'low-risk' };
  };

  const getDiversificationLevel = (d) => {
    if (d >= 80) return { text: 'Well Diversified', class: 'low-risk' };
    if (d >= 60) return { text: 'Moderate Diversification', class: 'mod-risk' };
    return { text: 'Highly Concentrated', class: 'high-risk' };
  };

  const getReturnLevel = (r = 0) => {
    if (r > 0.12) return { text: 'High Growth Return', class: 'low-risk' };
    if (r > 0.04) return { text: 'Moderate Return', class: 'mod-risk' };
    return { text: 'Low / Negative Return', class: 'high-risk' };
  };

  const getSharpeLevel = (s = 0) => {
    if (s >= 1.0) return { text: 'Strong Risk-Adjusted', class: 'low-risk' };
    if (s >= 0.5) return { text: 'Moderate Risk-Adjusted', class: 'mod-risk' };
    return { text: 'Underperforming', class: 'high-risk' };
  };

  const getDrawdownLevel = (d = 0) => {
    const absD = Math.abs(d);
    if (absD < 0.15) return { text: 'Defensive Drawdown', class: 'low-risk' };
    if (absD < 0.30) return { text: 'Moderate Drawdown', class: 'mod-risk' };
    return { text: 'High Drawdown Exposure', class: 'high-risk' };
  };

  const betaRisk = getBetaLevel(metrics.beta);
  const volRisk = getVolatilityLevel(metrics.volatility);
  const divRisk = getDiversificationLevel(metrics.diversificationScore);
  const returnRisk = getReturnLevel(metrics.annualReturn);
  const sharpeRisk = getSharpeLevel(metrics.sharpeRatio);
  const drawdownRisk = getDrawdownLevel(metrics.maxDrawdown);

  return (
    <main className="dashboard-grid">
      
      {/* COLUMN 1: Portfolio Holdings & Ticker Entry */}
      <section className="dashboard-column">
        <div className="glass-card">
          <div className="card-title">
            <FolderPlus size={20} className="text-blue" />
            Add Asset Holding
          </div>

          {notification && (
            <div className={`notification notification-${notification.type}`}>
              {notification.type === 'error' ? <ShieldAlert size={16} /> : <Activity size={16} />}
              {notification.message}
            </div>
          )}

          <form onSubmit={handleAddSubmit} className="add-asset-form">
            <input 
              type="text" 
              placeholder="Ticker (e.g. AAPL)" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="input-field"
              required
              disabled={isActionLoading}
            />
            <input 
              type="number" 
              step="any"
              placeholder="Shares (e.g. 10)" 
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="input-field"
              required
              disabled={isActionLoading}
            />
            <input 
              type="number" 
              step="any"
              placeholder="Avg Price ($)" 
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              className="input-field"
              required
              disabled={isActionLoading}
            />
            <button type="submit" className="btn btn-primary" disabled={isActionLoading}>
              {isActionLoading ? <span className="spinner"></span> : <Plus size={16} />}
              Add
            </button>
          </form>
        </div>

        <div className="glass-card" style={{ flex: 1 }}>
          <div className="card-title">
            <TrendingUp size={20} className="text-blue" />
            Asset Holdings Breakdown
          </div>

          {holdings.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle className="empty-state-icon" size={32} />
              <p>Your portfolio is currently empty.</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>Add stock tickers to trigger the Multi-Agent risk analytics.</p>
            </div>
          ) : (
            <div className="holdings-table-wrapper">
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Shares</th>
                    <th>Cost basis</th>
                    <th>Current Value</th>
                    <th>Sector</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => {
                    const price = h.currentPrice || h.buyPrice;
                    const value = h.shares * price;
                    return (
                      <tr key={h.ticker + i}>
                        <td>
                          <span className="holdings-ticker">{h.ticker}</span>
                        </td>
                        <td>{h.shares}</td>
                        <td>${parseFloat(h.buyPrice).toFixed(2)}</td>
                        <td>${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            {h.sector || 'Loading...'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            onClick={() => onRemoveHolding(h.ticker)} 
                            className="btn btn-danger" 
                            style={{ padding: '6px 10px', borderRadius: '6px' }}
                            disabled={isActionLoading}
                            title="Delete Ticker"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* COLUMN 2: Risk Speedometers & Sector Allocations */}
      <section className="dashboard-column">
        <div className="glass-card">
          <div className="card-title">
            <Activity size={20} className="text-blue" />
            Quantitative Risk Speedometers
          </div>

          <div className="risk-metrics-grid">
            <div className="metric-badge">
              <div className="metric-label">Weighted Beta</div>
              <div className={`metric-val ${betaRisk.class}`}>{metrics.beta.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{betaRisk.text}</div>
            </div>

            <div className="metric-badge">
              <div className="metric-label">Annualized Vol</div>
              <div className={`metric-val ${volRisk.class}`}>{(metrics.volatility * 100).toFixed(1)}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{volRisk.text}</div>
            </div>

            <div className="metric-badge">
              <div className="metric-label">Annual Return</div>
              <div className={`metric-val ${returnRisk.class}`}>{(metrics.annualReturn !== undefined ? metrics.annualReturn * 100 : 0).toFixed(1)}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{returnRisk.text}</div>
            </div>

            <div className="metric-badge">
              <div className="metric-label">Sharpe Ratio</div>
              <div className={`metric-val ${sharpeRisk.class}`}>{metrics.sharpeRatio !== undefined ? metrics.sharpeRatio.toFixed(2) : '0.00'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{sharpeRisk.text}</div>
            </div>

            <div className="metric-badge">
              <div className="metric-label">Max Drawdown</div>
              <div className={`metric-val ${drawdownRisk.class}`}>{(metrics.maxDrawdown !== undefined ? metrics.maxDrawdown * 100 : 0).toFixed(1)}%</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{drawdownRisk.text}</div>
            </div>

            <div className="metric-badge">
              <div className="metric-label">Diversification Score</div>
              <div className={`metric-val ${divRisk.class}`}>{metrics.diversificationScore}/100</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{divRisk.text}</div>
            </div>

            <div className="metric-badge" style={{ gridColumn: 'span 2' }}>
              <div className="metric-label">1-Day 95% Value-at-Risk (VaR)</div>
              <div className="metric-val text-blue" style={{ fontSize: '26px' }}>
                ${metrics.valueAtRisk.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Maximum statistical daily loss at 95% confidence level
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ flex: 1 }}>
          <div className="card-title">
            <FileText size={20} className="text-blue" />
            Sector Allocations Breakdown
          </div>
          {holdings.length === 0 ? (
            <div className="empty-state">
              <p>No sector data to visualize.</p>
            </div>
          ) : (
            <div className="chart-container">
              <Pie data={chartData} options={chartOptions} />
            </div>
          )}
        </div>
      </section>

      {/* COLUMN 3: Multi-Agent Logger & Decision advisory report */}
      <section className="dashboard-column agent-column">
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={20} className="text-purple" />
              Multi-Agent AI Engine Panel
            </div>
            
            <button 
              onClick={onAnalyzePortfolio} 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12px' }}
              disabled={isAnalyzing || holdings.length === 0}
            >
              {isAnalyzing ? <RefreshCw size={12} className="spinner" /> : <RefreshCw size={12} />}
              <span style={{ marginLeft: '4px' }}>Re-Analyze</span>
            </button>
          </div>

          <div className="analyze-banner">
            <span className="analyze-banner-text">
              {isAnalyzing 
                ? "Engaging Market Analysis, RAG, and Decision Agents..." 
                : "LangChain Multi-Agent platform compiled & operational."}
            </span>
          </div>

          {/* Real-time agent activity logs */}
          <div className="agent-logs-console">
            {(metrics.agentLogs || []).length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>
                &gt;_ Console idle. Add assets or click "Re-Analyze" to trigger agent logs.
              </div>
            ) : (
              metrics.agentLogs.map((log, index) => (
                <div key={index} className="log-entry">
                  <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
                  <span className="log-arrow">&gt;&gt;</span>
                  <span>{log}</span>
                </div>
              ))
            )}
            {isAnalyzing && (
              <div className="log-entry" style={{ color: 'white' }}>
                <span className="log-time">[{new Date().toLocaleTimeString()}]</span>
                <span className="log-arrow">&gt;&gt;</span>
                <span>Agent processing sequence in progress... <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }}></span></span>
              </div>
            )}
          </div>

          {/* Decisive markdown report */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
            <div className="advisory-report-wrapper">
              {isAnalyzing ? (
                <div className="empty-state">
                  <RefreshCw size={24} className="spinner" style={{ marginBottom: '12px' }} />
                  <p>Orchestrating agents and querying financial indexes...</p>
                </div>
              ) : metrics.agentReport ? (
                renderMarkdown(metrics.agentReport)
              ) : (
                <div className="empty-state">
                  <Cpu size={24} className="empty-state-icon" />
                  <p>No advisory report generated yet.</p>
                  <p style={{ fontSize: '11px', marginTop: '6px' }}>Add stock holdings to trigger the Decision Agent's quantitative-qualitative analysis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}

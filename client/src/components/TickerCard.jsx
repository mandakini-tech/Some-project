import React from "react";
import ReactMarkdown from "react-markdown";

export default function TickerCard({ data }) {
  const s = data.stats;
  return (
    <div className="card">
      <div className="row">
        <div><b>{data.info.longName || data.ticker}</b> ({data.ticker})</div>
        <div>Last: {s.lastPrice ?? "N/A"}</div>
      </div>
      <div className="row">
        <div>Beta: {s.beta.toFixed(2)}</div>
        <div>Vol (ann): {(s.volatilityAnnualized*100).toFixed(2)}%</div>
        <div>VaR(95%): {(s.var95*100).toFixed(2)}%</div>
      </div>
      <details>
        <summary>Advisory Report</summary>
        <ReactMarkdown>{data.reportMarkdown}</ReactMarkdown>
      </details>
    </div>
  );
}

import { FileText, Download } from 'lucide-react';

export default function PDFExport({ results }) {
  if (!results) return null;

  const handleExport = () => {
    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const ai = results.ai_analysis || {};
    const articles = results.all_articles || [results.headline, ...(results.articles || [])].filter(Boolean);

    const articlesHTML = articles.map((a, i) => `
      <div class="article-item">
        <div class="article-num">${i + 1}</div>
        <div class="article-body">
          <h3>${a.title}</h3>
          <div class="article-meta">${a.source} · ${a.time_ago || 'recently'} · Sentiment: ${a.sentiment?.label || 'neutral'}</div>
          <p>${a.summary || a.full_text_preview || ''}</p>
        </div>
      </div>
    `).join('');

    const themesHTML = (ai.key_themes || []).map(t => `<span class="theme-pill">${t}</span>`).join('');
    const keywordsHTML = (ai.keywords || []).map(k => `<span class="keyword-pill">${k}</span>`).join('');

    const sentimentHTML = (results.sentiment_chart || []).map(s =>
      `<div class="stat-item"><span class="stat-label">${s.name}</span><span class="stat-value">${s.value} articles</span></div>`
    ).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NewsIntel Intelligence Report — ${results.topic}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; color: #1a1a2e; padding: 48px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #6366f1; padding-bottom: 24px; }
          .header h1 { font-size: 2rem; font-weight: 800; color: #6366f1; margin-bottom: 4px; }
          .header .subtitle { font-size: 0.9rem; color: #666; }
          .header .meta { font-size: 0.8rem; color: #999; margin-top: 8px; }
          .section { margin-bottom: 32px; }
          .section h2 { font-size: 1.2rem; font-weight: 700; color: #6366f1; margin-bottom: 12px; border-left: 4px solid #6366f1; padding-left: 12px; }
          .overview { background: #f8f9ff; padding: 20px; border-radius: 8px; font-size: 0.95rem; line-height: 1.7; }
          .risk-grid { display: flex; gap: 16px; margin-top: 12px; }
          .risk-card { background: #f8f9ff; padding: 12px 16px; border-radius: 8px; flex: 1; }
          .risk-card .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: #999; }
          .risk-card .value { font-size: 1.1rem; font-weight: 700; margin-top: 4px; }
          .risk-card .value.low { color: #34d399; }
          .risk-card .value.medium { color: #fbbf24; }
          .risk-card .value.high { color: #f43f5e; }
          .themes { display: flex; flex-wrap: wrap; gap: 8px; }
          .theme-pill { background: #eff0ff; color: #6366f1; padding: 4px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 500; }
          .keyword-pill { background: #f5f0ff; color: #a855f7; padding: 3px 10px; border-radius: 4px; font-size: 0.75rem; font-family: monospace; }
          .keywords { display: flex; flex-wrap: wrap; gap: 6px; }
          .article-item { display: flex; gap: 12px; padding: 16px 0; border-bottom: 1px solid #eee; }
          .article-num { width: 28px; height: 28px; background: #6366f1; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
          .article-body h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 4px; }
          .article-meta { font-size: 0.75rem; color: #999; margin-bottom: 6px; }
          .article-body p { font-size: 0.85rem; color: #555; }
          .stats { display: flex; gap: 12px; }
          .stat-item { background: #f8f9ff; padding: 8px 16px; border-radius: 8px; }
          .stat-label { font-size: 0.75rem; color: #999; }
          .stat-value { font-size: 0.9rem; font-weight: 600; margin-left: 8px; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; font-size: 0.75rem; color: #999; }
          @media print {
            body { padding: 24px; }
            .article-item { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚡ NewsIntel Intelligence Report</h1>
          <div class="subtitle">${results.topic} — ${results.region_flag || ''} ${results.region_name || 'Global'}</div>
          <div class="meta">Generated: ${new Date().toLocaleString()} · ${results.article_count || 0} Sources Analyzed · AI-Powered Analysis</div>
        </div>

        <div class="section">
          <h2>Intelligence Brief</h2>
          <div class="overview">${ai.overview || 'Analysis pending.'}</div>
          <div class="risk-grid">
            <div class="risk-card">
              <div class="label">Risk Level</div>
              <div class="value ${ai.risk_level || 'medium'}">${(ai.risk_level || 'medium').toUpperCase()}</div>
            </div>
            <div class="risk-card">
              <div class="label">Market Impact</div>
              <div class="value">${(ai.market_impact || 'neutral').toUpperCase()}</div>
            </div>
            <div class="risk-card">
              <div class="label">Confidence</div>
              <div class="value">${Math.round((ai.confidence || 0.5) * 100)}%</div>
            </div>
          </div>
        </div>

        ${(ai.key_themes || []).length > 0 ? `
        <div class="section">
          <h2>Key Themes</h2>
          <div class="themes">${themesHTML}</div>
        </div>
        ` : ''}

        ${(ai.keywords || []).length > 0 ? `
        <div class="section">
          <h2>Keywords</h2>
          <div class="keywords">${keywordsHTML}</div>
        </div>
        ` : ''}

        ${sentimentHTML ? `
        <div class="section">
          <h2>Sentiment Distribution</h2>
          <div class="stats">${sentimentHTML}</div>
        </div>
        ` : ''}

        <div class="section">
          <h2>Articles Analyzed (${articles.length})</h2>
          ${articlesHTML}
        </div>

        <div class="footer">
          NewsIntel v4.0 — AI-Powered News Intelligence Platform<br/>
          Powered by FastAPI · HuggingFace NLP · Google Gemini · React
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <button className="pdf-export-btn" onClick={handleExport} id="pdf-export" title="Export as PDF report">
      <FileText size={13} />
      Export PDF
    </button>
  );
}

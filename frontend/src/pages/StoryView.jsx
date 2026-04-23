import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function StoryView() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const article = state?.article;

  const [perspectives, setPerspectives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!article) { navigate('/dashboard'); return; }
    window.scrollTo(0, 0);

    const load = async () => {
      try {
        const res = await api.storyDeepDive(article.title, article.text_preview || article.text, article.source);
        setPerspectives(res.perspectives || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [article, navigate]);

  if (!article) return null;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 100 }}>
      <button onClick={() => navigate('/dashboard')} className="wire-btn" style={{ marginBottom: 32 }}>← RETURN TO COMMAND CENTER</button>

      <div className="panel" style={{ padding: 40, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div className="label" style={{ marginBottom: 12 }}>{article.source} // {new Date(article.published).toLocaleString()}</div>
            <h1 style={{ fontSize: 32, marginBottom: 16 }}>{article.title}</h1>
          </div>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-premium">Read Original ↗</a>
        </div>
        <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.8 }}>{article.text_preview || article.text}</p>
        
        {article.entities?.length > 0 && (
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {article.entities.map((e, i) => (
              <span key={i} className="badge neu" style={{ fontSize: 10, padding: '4px 12px' }}>{e.name}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {loading ? (
          <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
            <div className="label pulse-glow">Analyzing Narrative Perspectives...</div>
          </div>
        ) : (
          perspectives.map((p, i) => (
            <div key={i} className="panel" style={{ padding: 24 }}>
              <div className="label" style={{ marginBottom: 16, color: 'var(--theme-main)' }}>{p.viewpoint} PERSPECTIVE</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{p.framing}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <strong>EMPHASIS:</strong> {p.emphasis}<br/><br/>
                <strong>OMISSION:</strong> {p.omission}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

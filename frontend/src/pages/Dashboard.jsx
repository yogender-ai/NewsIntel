import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, BookOpen, AlertTriangle, Zap, User } from 'lucide-react';

export default function Dashboard() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tension, setTension] = useState(0);
  const [impact, setImpact] = useState([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // 1. Send dummy articles to cluster endpoint for tension and entities
        const clusterRes = await axios.post('http://127.0.0.1:8000/api/stories/cluster', {
          articles: [
            { id: "1", source: "Reuters", text: "Global markets tumble as new tariffs are announced between US and China. Tech stocks hit hardest." },
            { id: "2", source: "Bloomberg", text: "Apple announces AI breakthrough, boosting sentiment in Silicon Valley despite global tension." }
          ]
        });
        setTension(clusterRes.data.tension_index);

        // 2. Get Daily Brief
        const briefRes = await axios.post('http://127.0.0.1:8000/api/daily-brief', {
          articles: [
            { id: "1", source: "Reuters", text: "Global markets tumble as new tariffs are announced between US and China. Tech stocks hit hardest." },
            { id: "2", source: "Bloomberg", text: "Apple announces AI breakthrough, boosting sentiment in Silicon Valley despite global tension." }
          ]
        });
        setBrief(briefRes.data.daily_brief);

        // 3. Get So What (Personal Impact)
        const impactRes = await axios.post('http://127.0.0.1:8000/api/personalize/impact', {
          story_text: "Global markets tumble as new tariffs are announced between US and China. Tech stocks hit hardest. Apple announces AI breakthrough, boosting sentiment in Silicon Valley despite global tension."
        });
        setImpact(impactRes.data.impact_items);

      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="gradient-text" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity className="lucide-spin" /> Synthesizing Global Intelligence...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Layer 01: Daily Brief */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, color: 'var(--accent-primary)' }}>
            <BookOpen size={24} /> The Daily Brief
          </h2>
          <div style={{ fontSize: '18px', lineHeight: '1.8', color: 'var(--text-primary)' }}>
            {brief ? brief : "Failed to load the daily brief. Ensure the Hugging Face Space is active."}
          </div>
        </div>

        {/* Layer 05: So What? (Personal Impact) */}
        <div className="glass-panel" style={{ padding: '30px', borderLeft: '4px solid var(--accent-tertiary)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, color: 'var(--accent-tertiary)' }}>
            <User size={24} /> So What For You?
          </h2>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {impact.map((item, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '16px', color: 'var(--text-secondary)' }}>
                <Zap size={20} color="var(--accent-tertiary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sidebar Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Layer 03: Tension Meter */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, color: 'var(--accent-secondary)' }}>
            <AlertTriangle size={24} /> Global Tension
          </h2>
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Current Index</span>
              <span style={{ fontWeight: 'bold', color: tension > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {tension > 0 ? '+' : ''}{tension}
              </span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${Math.min(Math.max((tension + 5) * 10, 0), 100)}%`, 
                background: 'linear-gradient(90deg, var(--success), var(--warning), var(--danger))',
                transition: 'width 1s ease-in-out'
              }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

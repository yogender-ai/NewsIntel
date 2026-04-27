import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, Radio, Share2, ShieldAlert } from 'lucide-react';
import api from '../api';
import { formatRelativeTime } from '../lib/dashboardAdapter';
import Sidebar from '../components/worldpulse/Sidebar';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      try {
        // Fetch specific event from clusters or events endpoint
        // For MVP, if we don't have a direct event endpoint, we can fetch dashboard and find it
        const res = await api.get('/dashboard/live');
        if (res.data?.clusters) {
          const found = res.data.clusters.find(c => c.thread_id === id);
          if (found) {
            setEvent(found);
          }
        }
      } catch (err) {
        console.error("Failed to load event detail", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  if (loading) {
    return (
      <div className="world-pulse-page">
        <Sidebar activePath="/dashboard" />
        <main className="world-pulse-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="pulse-glow" style={{ width: 24, height: 24, background: '#8da2ff', borderRadius: '50%' }} />
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="world-pulse-page">
        <Sidebar activePath="/dashboard" />
        <main className="world-pulse-main">
          <div style={{ padding: 40 }}>
            <button onClick={() => navigate(-1)} className="wp-icon-btn" style={{ marginBottom: 24 }}><ArrowLeft size={16}/> Back</button>
            <h2>Intelligence Signal Not Found</h2>
            <p style={{ color: '#94a3b8' }}>The requested event may have expired from the live pulse stream.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="world-pulse-page">
      <Sidebar activePath="/dashboard" />
      
      <main className="world-pulse-main" style={{ overflowY: 'auto', paddingRight: '12px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          
          <button onClick={() => navigate(-1)} className="wp-icon-btn" style={{ marginBottom: 32 }}>
            <ArrowLeft size={16}/> Back to Command Center
          </button>
          
          <div className="event-detail-header" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <span className="sca-category">{event.matched_preferences?.[0]?.label || 'Global'}</span>
              <span className="sca-impact" style={{ background: 'rgba(255,155,169,0.1)', color: '#ff9ba9', border: '1px solid rgba(255,155,169,0.2)' }}>
                {event.signal_tier === 'CRITICAL' ? <ShieldAlert size={12}/> : <Activity size={12}/>}
                {event.signal_tier}
              </span>
            </div>
            
            <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.2, color: '#f8fafc', marginBottom: 16 }}>
              {event.summary?.split('.')[0] || 'Intelligence Report'}
            </h1>
            
            <div style={{ display: 'flex', gap: 24, color: '#94a3b8', fontSize: 13, alignItems: 'center' }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Clock size={14}/> First Detected: {formatRelativeTime(event.first_detected_at) || 'Recently'}
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Activity size={14}/> Pulse Score: {Math.round(event.pulse_score)}
              </span>
              <button className="wp-icon-btn" style={{ marginLeft: 'auto', height: 32 }}><Share2 size={14}/> Share</button>
            </div>
          </div>
          
          <div className="wp-card" style={{ padding: 32, marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, color: '#8da2ff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={16}/> EXECUTIVE BRIEFING
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#e2e8f0', marginBottom: 24 }}>
              {event.summary}
            </p>
            
            {event.impact_line && (
              <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, borderLeft: '4px solid #8da2ff' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>AI IMPACT ANALYSIS</span>
                <p style={{ fontSize: 14, color: '#f8fafc', margin: 0, lineHeight: 1.5 }}>{event.impact_line}</p>
              </div>
            )}
          </div>
          
          <div className="wp-card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: 16, color: '#a5b4fc', marginBottom: 16 }}>SOURCING & CLUSTERING</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              This intelligence is corroborated by {event.articles?.length || 1} independent source nodes across the global ingestion network. Confidence interval is assessed as {(event.pulse_score > 70 ? 'HIGH' : 'ELEVATED')}.
            </p>
          </div>
          
        </div>
      </main>
    </div>
  );
}

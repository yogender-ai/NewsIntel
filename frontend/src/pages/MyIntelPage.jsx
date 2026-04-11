import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReadingList } from '../components/ReadingList';
import { Bookmark, FileText, Download, ShieldCheck, Mail, ArrowRight, Lock } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import { useNavigate } from 'react-router-dom';

export default function MyIntelPage() {
  const { user } = useAuth();
  const { list } = useReadingList();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    // Simulated PDF Export
    setTimeout(() => {
       setIsExporting(false);
       window.print(); // Easy generic export trigger for the browser
    }, 1500);
  };

  if (!user) {
    return (
      <div style={{ padding: '60px 40px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Lock size={48} color="#94a3b8" style={{ marginBottom: '24px' }} />
        <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 16px' }}>Clearance Required</h1>
        <p style={{ color: '#94a3b8', fontSize: '15px' }}>You must sign in to access your personalized Intelligence Dashboard.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: '24px', background: '#38bdf8', color: '#000', padding: '12px 24px', borderRadius: '50px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img src={user.photoURL || 'https://via.placeholder.com/80'} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #38bdf8' }} />
            <div>
               <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>{user.displayName}'s command</h1>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#cbd5e1', marginTop: '8px', fontSize: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14}/> {user.email}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}><ShieldCheck size={14}/> CLEARED</span>
               </div>
            </div>
         </div>

         <button 
           onClick={handleExport}
           disabled={isExporting || list.length === 0}
           style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.4)', color: '#38bdf8', padding: '12px 20px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center', cursor: (isExporting || list.length===0) ? 'not-allowed' : 'pointer', fontWeight: 600, transition: 'all 0.3s', opacity: (isExporting || list.length===0) ? 0.5 : 1 }}
         >
           {isExporting ? <div className="loader-ring" style={{ width: '16px', height: '16px' }}/> : <Download size={16} />}
           {isExporting ? 'GENERATING BRIEFING...' : 'EXPORT PDF BRIEFING'}
         </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '40px' }}>
        
        {/* Saved Intelligence */}
        <div>
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 24px', color: '#e2e8f0', fontWeight: 600, fontSize: '18px' }}>
             <Bookmark size={20} color="#a855f7" /> SAVED INTELLIGENCE DOSSIERS ({list.length})
           </div>

           {list.length === 0 ? (
             <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '24px', padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <div style={{ fontSize: '16px', fontWeight: 500, color: '#94a3b8' }}>Dossier Empty</div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>Bookmark news feeds from the command center to build your briefing.</div>
                <button onClick={() => navigate('/')} style={{ marginTop: '24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 20px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                   Go to Feed <ArrowRight size={14} />
                </button>
             </div>
           ) : (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px' }}>
                {list.map((art, i) => (
                  <ArticleCard key={i} article={art} hideBookmark={true} />
                ))}
             </div>
           )}
        </div>

        {/* Dashboard Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div style={{ background: 'linear-gradient(145deg, rgba(16,185,129,0.1), rgba(0,0,0,0.2))', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '24px', padding: '24px' }}>
              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, letterSpacing: '1px', marginBottom: '8px' }}>SYSTEM TRUST INDICATOR</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>99.8%</div>
              <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '13px' }}>Neural sentiment accuracy over 1,482 verified sources today.</p>
           </div>

           <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, letterSpacing: '1px', marginBottom: '16px' }}>RECENT TOPICS MONITORED</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                 {['Geopolitics', 'Market Trends', 'Tech Outages', 'Energy'].map(t =>(
                   <span key={t} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', color: '#cbd5e1' }}>{t}</span>
                 ))}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter, Settings, ChevronDown, ChevronRight,
  Swords, DollarSign, Zap, Flame, Globe,
  Droplets, Shield, CheckCircle, Star, BookOpen,
  MessageSquare, Heart, GitFork, Eye, ExternalLink,
  BarChart2, Activity, Sparkles
} from 'lucide-react';
import CommunityPost from '../components/CommunityPost';
import TrendsSidebar from '../components/TrendsSidebar';
import Watchlist from '../components/Watchlist';
import AnalystLeaderboard from '../components/AnalystLeaderboard';
import GithubWidget from '../components/GithubWidget';
import { useLanguage } from '../context/LanguageContext';
import { fetchReddit, fetchHackerNews, fetchAnalystSummary, fetchGitHubStats } from '../api';

const SIDEBAR_CATEGORIES = [
  { section: 'TRENDS', items: [
    { label: 'WAR', icon: Swords },
    { label: 'ECONOMY', icon: DollarSign },
    { label: 'ENERGY', icon: Zap },
    { label: 'TECH', icon: Globe },
  ]},
  { section: 'COMMUNITY', items: [
    { label: 'TRENDING', icon: Flame },
    { label: 'WAR', icon: Swords },
    { label: 'ECONOMY', icon: DollarSign },
    { label: 'GEOPOLITICS', icon: Globe },
    { label: 'ENERGY', icon: Droplets },
    { label: 'TECH', icon: Zap },
  ]},
];

const GUIDELINES = [
  'Be respectful and civil',
  'Back your claims with sources',
  'No spam or self promotion',
  'Stay on topic',
];

// ── GitHub Stats Panel ──────────────────────────────────────────────────────
function GitHubStatsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const REPO_URL = 'https://github.com/yogender-ai/News-Intel-Feedback';
  const MAIN_REPO = 'https://github.com/yogender-ai/News-Intel';

  useEffect(() => {
    fetchGitHubStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="github-stats-panel">
      <div className="github-stats-hero">
        <div className="github-stats-hero-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </div>
        <div>
          <h2 className="github-stats-title">NewsIntel on GitHub</h2>
          <p className="github-stats-subtitle">Open-source AI-powered news intelligence</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="github-metric-grid">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="github-metric-card skeleton-card">
              <div className="skeleton-shimmer" />
            </div>
          ))
        ) : (
          <>
            <div className="github-metric-card metric-gold">
              <Star size={20} className="metric-icon" />
              <div className="metric-value">{stats?.stars ?? '—'}</div>
              <div className="metric-label">Stars</div>
            </div>
            <div className="github-metric-card metric-blue">
              <GitFork size={20} className="metric-icon" />
              <div className="metric-value">{stats?.forks ?? '—'}</div>
              <div className="metric-label">Forks</div>
            </div>
            <div className="github-metric-card metric-purple">
              <Eye size={20} className="metric-icon" />
              <div className="metric-value">{stats?.watchers ?? '—'}</div>
              <div className="metric-label">Watchers</div>
            </div>
            <div className="github-metric-card metric-green">
              <Activity size={20} className="metric-icon" />
              <div className="metric-value">Live</div>
              <div className="metric-label">Status</div>
            </div>
          </>
        )}
      </div>

      {/* What's New */}
      <div className="github-whats-new">
        <div className="whats-new-header">
          <Sparkles size={14} color="#a855f7" />
          <span>What's in NewsIntel v4.0</span>
        </div>
        <ul className="whats-new-list">
          <li><CheckCircle size={12} className="check-green" /> Real-time Gemini AI analysis on every search</li>
          <li><CheckCircle size={12} className="check-green" /> Multi-region news aggregation (15+ countries)</li>
          <li><CheckCircle size={12} className="check-green" /> Holographic world map with country intel</li>
          <li><CheckCircle size={12} className="check-green" /> Live stock ticker + weather integration</li>
          <li><CheckCircle size={12} className="check-green" /> Community feedback system with GitHub auth</li>
          <li><CheckCircle size={12} className="check-green" /> Voice AI analyst powered by Gemini</li>
        </ul>
      </div>

      {/* CTA Buttons */}
      <div className="github-cta-group">
        <a href={MAIN_REPO} target="_blank" rel="noopener noreferrer" className="github-cta-primary" id="star-main-repo">
          <Star size={16} className="cta-star-icon" />
          Star on GitHub
          <ExternalLink size={13} />
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="github-cta-secondary" id="view-feedback-repo">
          <MessageSquare size={15} />
          Feedback Repo
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Open source note */}
      <div className="github-open-source-note">
        <span>⭐ Every star helps us reach more developers. Thank you!</span>
      </div>
    </div>
  );
}

// ── Main Community Page ────────────────────────────────────────────────────
export default function CommunityPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  // Main tab: discussions | feedback | github
  const [mainTab, setMainTab] = useState('discussions');
  const [postFilter, setPostFilter] = useState('featured');
  const [activeCategory, setActiveCategory] = useState('World News');
  const [expandedSections, setExpandedSections] = useState({ TRENDS: true, COMMUNITY: true });
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analystSummary, setAnalystSummary] = useState('');

  useEffect(() => {
    if (mainTab !== 'discussions') return;
    (async () => {
      setLoading(true);
      
      const topicMap = {
        'World News': 'worldnews',
        'Tech': 'technology',
        'Economy': 'economy',
        'War': 'geopolitics'
      };
      const fetchTopic = topicMap[activeCategory] || 'worldnews';
      
      const [redditData, hnData, summaryData] = await Promise.all([
        fetchReddit(fetchTopic),
        fetchHackerNews(),
        fetchAnalystSummary(activeCategory)
      ]);
      
      setAnalystSummary(summaryData.summary || '');

      const formattedReddit = (redditData.posts || []).map(p => ({
        author: 'Reddit User',
        role: 'Community Pulse',
        verified: false,
        timestamp: 'Just now',
        title: p.title,
        content: `Discussing ${fetchTopic} globally.`,
        tags: [{ label: 'Reddit', type: 'reddit' }, { label: fetchTopic, type: 'topic' }],
        votes: p.score || 0,
        comments: p.num_comments || 0,
        discussion: `Join the conversation on this ${fetchTopic} trend.`,
      }));

      const formattedHN = (hnData.stories || []).map(s => ({
        author: s.by,
        role: 'HN Insider',
        verified: true,
        timestamp: 'Live Feed',
        title: s.title,
        content: `Sourced directly from Hacker News API.`,
        tags: [{ label: 'Hacker News', type: 'hn' }, { label: 'Tech', type: 'tech' }],
        votes: s.score || 0,
        comments: 0,
        discussion: 'Technical discussion active.',
      }));

      let mixed = [];
      let i = 0;
      while(i < formattedReddit.length || i < formattedHN.length) {
        if(formattedReddit[i]) mixed.push(formattedReddit[i]);
        if(formattedHN[i]) mixed.push(formattedHN[i]);
        i++;
      }
      
      setPosts(mixed);
      setLoading(false);
    })();
  }, [activeCategory, mainTab]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const tabConfig = [
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
    { id: 'feedback', label: 'Feedback Hub', icon: Heart },
    { id: 'github', label: 'GitHub', icon: BarChart2 },
  ];

  return (
    <div className="community-page">
      {/* ── Main Tab Navigation ── */}
      <div className="community-tabs">
        <div className="community-tabs-left">
          <span className="community-version">INTEL FEED</span>
          {tabConfig.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`community-tab ${mainTab === tab.id ? 'active' : ''}`}
                onClick={() => setMainTab(tab.id)}
                id={`community-tab-${tab.id}`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="community-tabs-right">
          <a
            href="https://github.com/yogender-ai/News-Intel"
            target="_blank"
            rel="noopener noreferrer"
            className="community-tab-action github-link-btn"
            id="community-github-link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
        </div>
      </div>

      <div className="community-layout">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="community-sidebar-left">
          <div className="comm-filters-section">
            <div className="comm-filters-header">
              <Filter size={13} />
              <span>FILTERS</span>
              <div className="comm-online-dot" />
            </div>

            <div className="comm-user-card">
              <div className="comm-user-avatar">
                <div className="comm-user-avatar-placeholder">AI</div>
              </div>
              <div className="comm-user-info">
                <div className="comm-user-name">Intel Agent</div>
                <div className="comm-user-role">Community Feed</div>
                <span className="comm-user-handle">
                  <Shield size={9} /> @system
                </span>
              </div>
            </div>
            <button className="comm-manage-btn">
              <Settings size={12} /> Manage Account
            </button>
          </div>

          {SIDEBAR_CATEGORIES.map((section, idx) => (
            <div key={idx} className="comm-category-section">
              <button
                className="comm-category-header"
                onClick={() => toggleSection(section.section)}
              >
                <span>{section.section}</span>
                {expandedSections[section.section] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {expandedSections[section.section] && (
                <div className="comm-category-list">
                  {section.items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={i}
                        className="comm-category-item"
                        onClick={() => navigate(`/search/${encodeURIComponent(item.label)}`)}
                      >
                        <Icon size={13} />
                        <span>{item.label}</span>
                        <ChevronRight size={11} className="comm-cat-arrow" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* ── CENTER CONTENT ── */}
        <main className="community-feed">

          {/* ── TAB: DISCUSSIONS ── */}
          {mainTab === 'discussions' && (
            <>
              <div className="comm-feed-filters">
                <div className="comm-feed-tabs">
                  <button
                    className={`comm-feed-tab ${postFilter === 'featured' ? 'active' : ''}`}
                    onClick={() => setPostFilter('featured')}
                  >
                    <Star size={12} /> FEATURED
                  </button>
                  <button
                    className={`comm-feed-tab ${postFilter === 'recent' ? 'active' : ''}`}
                    onClick={() => setPostFilter('recent')}
                  >
                    RECENT
                  </button>
                </div>
                <div className="comm-category-chips">
                  {['World News', 'Tech', 'Economy', 'War'].map((cat, i) => (
                    <button
                      key={i}
                      className={`comm-cat-chip ${activeCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              
              {analystSummary && (
                <div className="comm-analyst-summary" style={{ background: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Zap size={14} color="#10b981" />
                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>AI ANALYST SENTIMENT: {activeCategory.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: 1.6, margin: 0 }}>
                    {analystSummary}
                  </p>
                </div>
              )}

              <div className="comm-posts-list">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#a855f7' }}>Syncing global nodes...</div>
                ) : posts.length > 0 ? posts.map((post, idx) => (
                  <CommunityPost key={idx} post={post} />
                )) : (
                  <div style={{textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '14px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px'}}>No community discussions found for this sector.</div>
                )}
              </div>
            </>
          )}

          {/* ── TAB: FEEDBACK HUB ── */}
          {mainTab === 'feedback' && (
            <div className="community-feedback-tab">
              <GithubWidget />
            </div>
          )}

          {/* ── TAB: GITHUB ── */}
          {mainTab === 'github' && (
            <div className="community-github-tab">
              <GitHubStatsPanel />
            </div>
          )}
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="community-sidebar-right">
          <TrendsSidebar />
          <Watchlist />
          <AnalystLeaderboard />

          {/* Community Guidelines */}
          <div className="comm-guidelines">
            <div className="comm-guidelines-header">
              <BookOpen size={13} />
              <span>COMMUNITY GUIDELINES</span>
            </div>
            <ul className="comm-guidelines-list">
              {GUIDELINES.map((g, i) => (
                <li key={i}>
                  <CheckCircle size={11} className="comm-guideline-check" />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

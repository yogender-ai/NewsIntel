import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Settings, ChevronDown, ChevronRight,
  TrendingUp, Swords, DollarSign, Zap, Flame, Globe,
  Droplets, Users, Shield, CheckCircle, Star, BookOpen
} from 'lucide-react';
import CommunityPost from '../components/CommunityPost';
import TrendsSidebar from '../components/TrendsSidebar';
import Watchlist from '../components/Watchlist';
import AnalystLeaderboard from '../components/AnalystLeaderboard';
import { useLanguage } from '../context/LanguageContext';

const CATEGORY_FILTERS = [
  { label: 'War', icon: '⚔️' },
  { label: 'Economy', icon: '💰' },
  { label: 'Geopolitics', icon: '🌍' },
  { label: 'Oil', icon: '🛢️' },
  { label: 'Tech', icon: '💻' },
  { label: 'Climate', icon: '🌡️' },
];

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

const MOCK_POSTS = [
  {
    author: 'Isaac Chen',
    role: 'Senior Market Strategist',
    verified: true,
    timestamp: '3 hours ago',
    title: 'Dow spikes 1,200 points as US-Iran ceasefire sparks buying frenzy.',
    content: 'We just witnessed a major +1,200 point surge in Dow Futures on reports of a pending US-Iran ceasefire. But if this rally sustainable?',
    tags: [
      { label: 'Trending', icon: '🔥' },
      { label: 'Economy', icon: '💰', type: 'accent' },
      { label: 'Iran', icon: '🇮🇷' },
      { label: 'Ceasefire' },
      { label: 'VERIFIED', type: 'verified' },
    ],
    votes: 758,
    comments: 124,
    discussion: 'What are your risk levels here?',
  },
  {
    author: 'Maxine Forsythe',
    role: 'Geopolitical Analyst',
    verified: true,
    timestamp: '6 hours ago',
    title: 'Middle East tensions run high amid new ceasefire talks',
    content: 'Brent crude spikes to $89/barrel as US-Iran ceasefire talks fuel optimism for reduced Middle East tension.',
    tags: [
      { label: 'Reuters' },
      { label: 'breakdown', type: 'accent' },
      { label: 'Iran 1.20' },
      { label: 'Verich' },
    ],
    votes: 635,
    comments: 68,
    discussion: 'Think this ceasefire deal will stick?',
  },
  {
    author: 'Paul D.',
    role: 'Energy Trader',
    verified: true,
    timestamp: '2 hours ago',
    title: 'Brent crude spikes to $89/barrel as US-Iran ceasefire talks fuel optimism',
    content: 'Expect oil prices to stay elevated. Reduced Middle East tension could stabilize supply, but it\'s far from over.',
    tags: [
      { label: 'Fuel' },
      { label: 'Brice Nbr' },
    ],
    votes: 508,
    comments: 31,
    chartData: {
      label: 'Brent Oil Futures',
      change: 1.84,
    },
  },
];

const GUIDELINES = [
  'Be respectful and civil',
  'Back your claims with sources',
  'No spam or self promotion',
  'Stay on topic',
];

export default function CommunityPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('community');
  const [postFilter, setPostFilter] = useState('featured');
  const [activeCategory, setActiveCategory] = useState('War');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState({ TRENDS: true, COMMUNITY: true });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="community-page">
      {/* Tab Navigation */}
      <div className="community-tabs">
        <div className="community-tabs-left">
          <span className="community-version">AI INTELLIGENCE V5.0</span>
          {['COMMUNITY', 'MY FEED', 'ACTIVITY & DISCUSSIONS'].map(tab => (
            <button
              key={tab}
              className={`community-tab ${activeTab === tab.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_') ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'))}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="community-tabs-right">
          <button className="community-tab-action">⭐ FAVILLS</button>
          <button className="community-tab-action">📊 MATESTIC</button>
          <button className="community-tab-action accent">🚀 APPAY</button>
        </div>
      </div>

      <div className="community-layout">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="community-sidebar-left">
          {/* User Profile */}
          <div className="comm-filters-section">
            <div className="comm-filters-header">
              <Filter size={13} />
              <span>FILTERS</span>
              <div className="comm-online-dot" />
            </div>

            <div className="comm-user-card">
              <div className="comm-user-avatar">
                <div className="comm-user-avatar-placeholder">IC</div>
              </div>
              <div className="comm-user-info">
                <div className="comm-user-name">Isaac Chen</div>
                <div className="comm-user-role">Senior Market Strategist</div>
                <span className="comm-user-handle">
                  <Shield size={9} /> @Isaac_Chen
                </span>
              </div>
            </div>
            <button className="comm-manage-btn">
              <Settings size={12} /> Manage Account
            </button>
          </div>

          {/* Category Sections */}
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

        {/* ── CENTER: POST FEED ── */}
        <main className="community-feed">
          {/* Filter Bar */}
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
              {CATEGORY_FILTERS.map((cat, i) => (
                <button
                  key={i}
                  className={`comm-cat-chip ${activeCategory === cat.label ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.label)}
                >
                  <span>{cat.icon}</span> {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Posts */}
          <div className="comm-posts-list">
            {MOCK_POSTS.map((post, idx) => (
              <CommunityPost key={idx} post={post} />
            ))}
          </div>

          {/* Pagination */}
          <div className="comm-pagination">
            <button className="comm-page-btn">‹</button>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} className={`comm-page-btn ${n === 1 ? 'active' : ''}`}>{n}</button>
            ))}
            <button className="comm-page-btn">›</button>
          </div>
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

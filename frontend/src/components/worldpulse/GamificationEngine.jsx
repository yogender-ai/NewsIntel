import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GAMIFICATION ENGINE — XP, Streaks, Levels, Achievements
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'newsintel.gamification.v1';

const LEVELS = [
  { level: 1, xpNeeded: 0,    title: 'Rookie Analyst',      badge: '🌱' },
  { level: 2, xpNeeded: 100,  title: 'Signal Tracker',      badge: '📡' },
  { level: 3, xpNeeded: 300,  title: 'Intel Operative',     badge: '🔍' },
  { level: 4, xpNeeded: 600,  title: 'Data Strategist',     badge: '📊' },
  { level: 5, xpNeeded: 1000, title: 'Pulse Commander',     badge: '⚡' },
  { level: 6, xpNeeded: 1600, title: 'Neural Architect',    badge: '🧠' },
  { level: 7, xpNeeded: 2400, title: 'Shadow Director',     badge: '🕵️' },
  { level: 8, xpNeeded: 3500, title: 'Quantum Analyst',     badge: '💎' },
  { level: 9, xpNeeded: 5000, title: 'Cipher Master',       badge: '🔮' },
  { level: 10, xpNeeded: 7000, title: 'Omniscient Oracle',  badge: '👁️' },
];

const ACHIEVEMENTS = [
  { id: 'first_login',     title: 'First Contact',        desc: 'Logged in for the first time',      icon: '🚀', xp: 25 },
  { id: 'first_signal',    title: 'Signal Detected',       desc: 'Opened your first signal',          icon: '📡', xp: 15 },
  { id: 'read_5',          title: 'Intel Junkie',          desc: 'Opened 5 signals',                  icon: '📰', xp: 30 },
  { id: 'read_20',         title: 'News Machine',          desc: 'Opened 20 signals',                 icon: '⚙️', xp: 75 },
  { id: 'streak_3',        title: 'On Fire',               desc: '3-day login streak',                icon: '🔥', xp: 50 },
  { id: 'streak_7',        title: 'Unstoppable',           desc: '7-day login streak',                icon: '💪', xp: 150 },
  { id: 'streak_30',       title: 'Legendary Focus',       desc: '30-day login streak',               icon: '👑', xp: 500 },
  { id: 'refresh_5',       title: 'Pulse Addict',          desc: 'Refreshed data 5 times',            icon: '🔄', xp: 20 },
  { id: 'ask_intel',       title: 'Curious Mind',          desc: 'Used Ask NewsIntel',                icon: '❓', xp: 25 },
  { id: 'ask_5',           title: 'Inquisitor',            desc: 'Asked 5 questions',                 icon: '🧪', xp: 50 },
  { id: 'explore_orbit',   title: 'Orbital Explorer',      desc: 'Visited the Orbit view',            icon: '🪐', xp: 20 },
  { id: 'explore_map',     title: 'Cartographer',          desc: 'Visited the Map view',              icon: '🗺️', xp: 20 },
  { id: 'explore_sim',     title: 'Simulation Runner',     desc: 'Visited the Simulator',             icon: '🎯', xp: 20 },
  { id: 'night_owl',       title: 'Night Owl',             desc: 'Checked intel after midnight',      icon: '🦉', xp: 30 },
  { id: 'early_bird',      title: 'Early Bird',            desc: 'Checked intel before 6 AM',         icon: '🐦', xp: 30 },
  { id: 'level_5',         title: 'Rising Star',           desc: 'Reached Level 5',                   icon: '⭐', xp: 100 },
  { id: 'level_10',        title: 'Master Intelligence',   desc: 'Reached Level 10',                  icon: '🏆', xp: 250 },
  { id: 'all_nav',         title: 'Full Spectrum',         desc: 'Visited every page',                icon: '🌐', xp: 100 },
];

const XP_ACTIONS = {
  open_signal: 5,
  refresh_data: 3,
  ask_question: 8,
  visit_page: 2,
  daily_login: 10,
  complete_tour: 15,
  read_story: 7,
};

function getLevel(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpNeeded) current = l;
  }
  return current;
}

function getNextLevel(xp) {
  const current = getLevel(xp);
  const idx = LEVELS.findIndex(l => l.level === current.level);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function defaultState() {
  return {
    xp: 0,
    achievements: [],
    streak: 0,
    lastLogin: null,
    signalsOpened: 0,
    questionsAsked: 0,
    refreshCount: 0,
    pagesVisited: [],
    totalSessions: 0,
  };
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isYesterday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

/* ── Context ── */
const GamificationContext = createContext(null);
export const useGamification = () => useContext(GamificationContext);

/* ── Provider ── */
export function GamificationProvider({ children }) {
  const [state, setState] = useState(() => readState() || defaultState());
  const [notifications, setNotifications] = useState([]);
  const [showLevelUp, setShowLevelUp] = useState(null);
  const [showAchievement, setShowAchievement] = useState(null);
  const [comboCount, setComboCount] = useState(0);
  const [comboTimer, setComboTimer] = useState(null);
  const notifId = useRef(0);
  const prevLevel = useRef(getLevel(state.xp).level);

  // Persist state
  useEffect(() => { writeState(state); }, [state]);

  // Daily login streak
  useEffect(() => {
    if (!isToday(state.lastLogin)) {
      const isConsecutive = isYesterday(state.lastLogin);
      setState(prev => ({
        ...prev,
        lastLogin: new Date().toISOString(),
        streak: isConsecutive ? prev.streak + 1 : 1,
        totalSessions: prev.totalSessions + 1,
      }));
    }
  }, []);

  // Auto-grant time-based achievements
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) grantAchievement('night_owl');
    if (hour >= 4 && hour < 6) grantAchievement('early_bird');
    grantAchievement('first_login');
  }, []);

  // Check streak achievements
  useEffect(() => {
    if (state.streak >= 3) grantAchievement('streak_3');
    if (state.streak >= 7) grantAchievement('streak_7');
    if (state.streak >= 30) grantAchievement('streak_30');
  }, [state.streak]);

  // Check level achievements
  useEffect(() => {
    const lvl = getLevel(state.xp);
    if (lvl.level >= 5) grantAchievement('level_5');
    if (lvl.level >= 10) grantAchievement('level_10');
    
    // Level up detection
    if (lvl.level > prevLevel.current) {
      setShowLevelUp(lvl);
      prevLevel.current = lvl.level;
    }
  }, [state.xp]);

  const addNotification = useCallback((message, type = 'info', icon = '⚡') => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev.slice(-4), { id, message, type, icon, ts: Date.now() }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  }, []);

  const addXP = useCallback((amount, reason) => {
    setState(prev => ({ ...prev, xp: prev.xp + amount }));
    
    // Combo system
    setComboCount(prev => {
      const newCombo = prev + 1;
      if (comboTimer) clearTimeout(comboTimer);
      const timer = setTimeout(() => setComboCount(0), 8000);
      setComboTimer(timer);
      
      if (newCombo >= 3) {
        const bonusXP = Math.floor(amount * 0.5);
        if (bonusXP > 0) {
          setState(p => ({ ...p, xp: p.xp + bonusXP }));
          addNotification(`COMBO x${newCombo}! +${bonusXP} bonus XP`, 'combo', '🔥');
        }
      }
      return newCombo;
    });
    
    addNotification(`+${amount} XP — ${reason}`, 'xp', '⚡');
  }, [comboTimer, addNotification]);

  const grantAchievement = useCallback((achievementId) => {
    setState(prev => {
      if (prev.achievements.includes(achievementId)) return prev;
      const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
      if (!ach) return prev;
      
      setTimeout(() => {
        setShowAchievement(ach);
        addNotification(`Achievement: ${ach.title}! +${ach.xp} XP`, 'achievement', ach.icon);
      }, 300);
      
      return {
        ...prev,
        achievements: [...prev.achievements, achievementId],
        xp: prev.xp + ach.xp,
      };
    });
  }, [addNotification]);

  const trackAction = useCallback((action, meta = {}) => {
    const xp = XP_ACTIONS[action] || 0;
    if (xp) addXP(xp, action.replace(/_/g, ' '));

    setState(prev => {
      const next = { ...prev };
      switch (action) {
        case 'open_signal':
          next.signalsOpened = (prev.signalsOpened || 0) + 1;
          if (next.signalsOpened === 1) setTimeout(() => grantAchievement('first_signal'), 500);
          if (next.signalsOpened >= 5) setTimeout(() => grantAchievement('read_5'), 500);
          if (next.signalsOpened >= 20) setTimeout(() => grantAchievement('read_20'), 500);
          break;
        case 'refresh_data':
          next.refreshCount = (prev.refreshCount || 0) + 1;
          if (next.refreshCount >= 5) setTimeout(() => grantAchievement('refresh_5'), 500);
          break;
        case 'ask_question':
          next.questionsAsked = (prev.questionsAsked || 0) + 1;
          if (next.questionsAsked === 1) setTimeout(() => grantAchievement('ask_intel'), 500);
          if (next.questionsAsked >= 5) setTimeout(() => grantAchievement('ask_5'), 500);
          break;
        case 'visit_page':
          if (meta.page && !prev.pagesVisited.includes(meta.page)) {
            next.pagesVisited = [...prev.pagesVisited, meta.page];
            if (meta.page === 'orbit') setTimeout(() => grantAchievement('explore_orbit'), 500);
            if (meta.page === 'map') setTimeout(() => grantAchievement('explore_map'), 500);
            if (meta.page === 'simulator') setTimeout(() => grantAchievement('explore_sim'), 500);
            if (next.pagesVisited.length >= 6) setTimeout(() => grantAchievement('all_nav'), 800);
          }
          break;
      }
      return next;
    });
  }, [addXP, grantAchievement]);

  const value = useMemo(() => ({
    ...state,
    level: getLevel(state.xp),
    nextLevel: getNextLevel(state.xp),
    xpProgress: (() => {
      const cur = getLevel(state.xp);
      const nxt = getNextLevel(state.xp);
      if (!nxt) return 100;
      return Math.round(((state.xp - cur.xpNeeded) / (nxt.xpNeeded - cur.xpNeeded)) * 100);
    })(),
    notifications,
    showLevelUp,
    showAchievement,
    comboCount,
    allAchievements: ACHIEVEMENTS,
    addXP,
    trackAction,
    grantAchievement,
    addNotification,
    dismissLevelUp: () => setShowLevelUp(null),
    dismissAchievement: () => setShowAchievement(null),
  }), [state, notifications, showLevelUp, showAchievement, comboCount, addXP, trackAction, grantAchievement, addNotification]);

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VISUAL COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* ── XP Bar (Sidebar) ── */
export function XPBar() {
  const g = useGamification();
  if (!g) return null;
  const { level, nextLevel, xp, xpProgress, streak, comboCount } = g;

  return (
    <div className="gam-xp-bar">
      <div className="gam-level-badge">
        <span className="gam-badge-icon">{level.badge}</span>
        <div className="gam-badge-info">
          <span className="gam-level-label">LVL {level.level}</span>
          <span className="gam-level-title">{level.title}</span>
        </div>
        {streak > 1 && (
          <div className="gam-streak-flame">
            <span>🔥</span>
            <b>{streak}</b>
          </div>
        )}
      </div>
      <div className="gam-xp-track">
        <div className="gam-xp-fill" style={{ width: `${xpProgress}%` }}>
          <div className="gam-xp-shimmer" />
        </div>
      </div>
      <div className="gam-xp-info">
        <span>{xp} XP</span>
        {nextLevel && <span>{nextLevel.xpNeeded - xp} XP to {nextLevel.title}</span>}
      </div>
      {comboCount >= 2 && (
        <div className="gam-combo-indicator">
          <span className="gam-combo-fire">🔥</span>
          <span className="gam-combo-text">COMBO x{comboCount}</span>
        </div>
      )}
    </div>
  );
}

/* ── Notification Stack ── */
export function NotificationStack() {
  const g = useGamification();
  if (!g) return null;
  const { notifications } = g;

  return (
    <div className="gam-notif-stack" aria-live="polite">
      {notifications.map((n) => (
        <div key={n.id} className={`gam-notif gam-notif-${n.type}`}>
          <span className="gam-notif-icon">{n.icon}</span>
          <span className="gam-notif-msg">{n.message}</span>
          <div className="gam-notif-progress" />
        </div>
      ))}
    </div>
  );
}

/* ── Level Up Modal ── */
export function LevelUpModal() {
  const g = useGamification();
  if (!g || !g.showLevelUp) return null;
  const lvl = g.showLevelUp;

  return (
    <div className="gam-levelup-overlay" onClick={g.dismissLevelUp}>
      <div className="gam-levelup-card" onClick={e => e.stopPropagation()}>
        <div className="gam-levelup-particles">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="gam-particle" style={{
              '--p-angle': `${(i / 20) * 360}deg`,
              '--p-dist': `${60 + Math.random() * 80}px`,
              '--p-delay': `${Math.random() * 0.5}s`,
              '--p-color': ['#00E5A0', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444'][i % 5],
            }} />
          ))}
        </div>
        <div className="gam-levelup-badge">{lvl.badge}</div>
        <h2>LEVEL UP!</h2>
        <div className="gam-levelup-level">Level {lvl.level}</div>
        <div className="gam-levelup-title">{lvl.title}</div>
        <p>Keep analyzing signals to unlock more achievements</p>
        <button onClick={g.dismissLevelUp}>CONTINUE</button>
      </div>
    </div>
  );
}

/* ── Achievement Popup ── */
export function AchievementPopup() {
  const g = useGamification();
  if (!g || !g.showAchievement) return null;
  const ach = g.showAchievement;

  useEffect(() => {
    const timer = setTimeout(() => g.dismissAchievement(), 5000);
    return () => clearTimeout(timer);
  }, [ach]);

  return (
    <div className="gam-achievement-popup" onClick={g.dismissAchievement}>
      <div className="gam-ach-icon-wrap">
        <div className="gam-ach-ring" />
        <span className="gam-ach-icon">{ach.icon}</span>
      </div>
      <div className="gam-ach-info">
        <span className="gam-ach-label">ACHIEVEMENT UNLOCKED</span>
        <b>{ach.title}</b>
        <span className="gam-ach-desc">{ach.desc}</span>
        <em>+{ach.xp} XP</em>
      </div>
    </div>
  );
}

/* ── Click Burst Effect ── */
export function ClickBurst() {
  const [bursts, setBursts] = useState([]);
  const id = useRef(0);

  useEffect(() => {
    const handler = (e) => {
      // Only burst on interactive elements
      const t = e.target;
      if (!t.closest('button, a, [role="button"], .wp-card, .shift-card-advanced, .qg-stat, .wca-row')) return;
      
      const burstId = ++id.current;
      setBursts(prev => [...prev.slice(-3), { id: burstId, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setBursts(prev => prev.filter(b => b.id !== burstId)), 900);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  return (
    <div className="gam-burst-layer" aria-hidden="true">
      {bursts.map(b => (
        <div key={b.id} className="gam-burst" style={{ left: b.x, top: b.y }}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="gam-burst-dot" style={{
              '--bd-angle': `${(i / 8) * 360}deg`,
              '--bd-dist': `${20 + Math.random() * 25}px`,
              '--bd-color': ['#00E5A0', '#8B5CF6', '#06B6D4', '#F59E0B'][i % 4],
            }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Daily Challenge Card ── */
export function DailyChallenge() {
  const g = useGamification();
  if (!g) return null;

  const challenges = [
    { label: 'Open 3 signals', current: Math.min(g.signalsOpened || 0, 3), target: 3, xp: 15 },
    { label: 'Refresh pulse', current: Math.min(g.refreshCount || 0, 1), target: 1, xp: 5 },
    { label: 'Ask a question', current: Math.min(g.questionsAsked || 0, 1), target: 1, xp: 10 },
  ];

  const totalDone = challenges.filter(c => c.current >= c.target).length;

  return (
    <section className="gam-daily-challenge">
      <div className="gam-dc-header">
        <span>🎯 DAILY MISSIONS</span>
        <em>{totalDone}/{challenges.length}</em>
      </div>
      {challenges.map((c, i) => (
        <div key={i} className={`gam-dc-item ${c.current >= c.target ? 'gam-dc-done' : ''}`}>
          <div className="gam-dc-bar">
            <div className="gam-dc-fill" style={{ width: `${(c.current / c.target) * 100}%` }} />
          </div>
          <div className="gam-dc-info">
            <span>{c.current >= c.target ? '✅' : '○'} {c.label}</span>
            <b>+{c.xp} XP</b>
          </div>
        </div>
      ))}
      {totalDone === challenges.length && (
        <div className="gam-dc-complete">🎉 ALL MISSIONS COMPLETE!</div>
      )}
    </section>
  );
}

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, Compass, FlaskConical, LayoutGrid, LogOut, Menu, MessageSquareText, Sparkles,
  Moon, Settings, Sun, Monitor, X,
} from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/theme-context';

const NAV = [
  { to: '/today', label: 'Today', icon: LayoutGrid, blurb: 'What matters now' },
  { to: '/ask', label: 'Ask', icon: MessageSquareText, blurb: 'Question the news' },
  { to: '/chat', label: 'Assistant', icon: Sparkles, blurb: 'Open AI chat' },
  { to: '/connections', label: 'Connections', icon: Compass, blurb: 'How stories link' },
  { to: '/simulator', label: 'What if', icon: FlaskConical, blurb: 'Test a scenario' },
  { to: '/pipeline', label: 'Pipeline', icon: Activity, blurb: 'How news gets here' },
  { to: '/settings', label: 'Settings', icon: Settings, blurb: 'You and your feed' },
];

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

export default function Shell({ children }) {
  const { account, logout } = useAuth();
  const { theme, cycle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ThemeIcon = THEME_ICON[theme] ?? Monitor;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="shell-top">
        <button
          className="btn btn-ghost shell-menu-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>

        <NavLink to="/today" className="brand">
          News<span>Intel</span>
        </NavLink>

        <div className="shell-top-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon size={16} aria-hidden="true" />
          </button>
          {account && (
            <div className="shell-user">
              <span className="shell-user-name">{account.display_name || account.email}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Sign out">
                <LogOut size={15} aria-hidden="true" />
                <span className="sr-only">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="shell-body">
        <nav className={`shell-nav ${open ? 'is-open' : ''}`} aria-label="Main">
          {NAV.map((item) => {
            // Assigned to a capitalised const rather than destructured: this ESLint
            // config has no react plugin, so JSX usage of a destructured parameter
            // reads as unused.
            const NavIcon = item.icon;
            const { to, label, blurb } = item;
            return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <NavIcon size={17} aria-hidden="true" />
              <span className="nav-text">
                <strong>{label}</strong>
                <small>{blurb}</small>
              </span>
            </NavLink>
            );
          })}
        </nav>

        {open && <button className="shell-scrim" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />}

        <main id="main" className="shell-main">{children}</main>
      </div>
    </div>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth-context';
import { ThemeProvider } from './context/ThemeContext';
import Shell from './components/Shell';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Today from './pages/Today';
import Ask from './pages/Ask';
import Chat from './pages/Chat';
import Connections from './pages/Connections';
import Pipeline from './pages/Pipeline';
import Simulator from './pages/Simulator';
import Settings from './pages/Settings';
import './styles/theme.css';
import './styles/layout.css';

function Booting() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="boot-dot" />
    </div>
  );
}

/* Signed-in pages. An account that hasn't finished onboarding is sent there first,
   because the feed is meaningless before we know what to select for. */
function Private({ children, allowUnonboarded = false }) {
  const { isAuthed, onboarded, loading } = useAuth();
  if (loading) return <Booting />;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!onboarded && !allowUnonboarded) return <Navigate to="/welcome" replace />;
  return <Shell>{children}</Shell>;
}

function AppRoutes() {
  const { loading, isAuthed } = useAuth();
  if (loading) return <Booting />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/welcome"
        element={isAuthed ? <Onboarding /> : <Navigate to="/login" replace />}
      />
      <Route path="/today" element={<Private><Today /></Private>} />
      <Route path="/ask" element={<Private><Ask /></Private>} />
      <Route path="/chat" element={<Private><Chat /></Private>} />
      <Route path="/connections" element={<Private><Connections /></Private>} />
      <Route path="/pipeline" element={<Private><Pipeline /></Private>} />
      <Route path="/simulator" element={<Private><Simulator /></Private>} />
      <Route path="/settings" element={<Private allowUnonboarded><Settings /></Private>} />
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

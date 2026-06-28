// App.jsx — routing, layout, and top-bar navigation
// Design inspired by command-center aesthetic: persistent navbar with tab navigation
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import LastMinuteScreen from './screens/LastMinuteScreen'
import DisruptionScreen from './screens/DisruptionScreen'

const NAV_TABS = [
  { path: '/home',        label: 'Home' },
  { path: '/last-minute', label: 'Crisis Mode' },
  { path: '/disruption',  label: 'Reshuffle' },
]

function NavBar() {
  const { user, logout, authMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user || location.pathname === '/') return null

  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <button
          onClick={() => navigate('/home')}
          className="nav-logo"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label="Aetherion home"
        >
          <span className="nav-logo-icon">◇</span>
          AETH<span>ER</span>ION
        </button>
        <span className="nav-badge">v0.5-beta</span>
        <span className="nav-model-status">
          <span className="status-dot" />
          Gemini 2.5 Flash
        </span>
      </div>

      <div className="nav-tabs">
        {NAV_TABS.map(tab => (
          <button
            key={tab.path}
            className={`nav-tab${location.pathname === tab.path ? ' nav-tab-active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="nav-right">
        <button
          id="nav-user-btn"
          className="nav-user-btn"
          onClick={logout}
          aria-label="Sign out"
          title={user.displayName || 'Sign out'}
        >
          {user.photoURL
            ? <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" />
            : <span className="nav-user-initial">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </span>
          }
        </button>
      </div>
    </nav>
  )
}

function AuthGate({ children }) {
  const { user } = useAuth()
  if (user === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span className="loading-text">Initializing Aetherion...</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <NavBar />
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/home" replace /> : <LoginScreen />}
        />
        <Route path="/home" element={<AuthGate><HomeScreen /></AuthGate>} />
        <Route path="/last-minute" element={<AuthGate><LastMinuteScreen /></AuthGate>} />
        <Route path="/disruption" element={<AuthGate><DisruptionScreen /></AuthGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

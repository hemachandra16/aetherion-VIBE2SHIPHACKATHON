// App.jsx — routing, layout, and top-bar navigation
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import LastMinuteScreen from './screens/LastMinuteScreen'
import DisruptionScreen from './screens/DisruptionScreen'

const NAV_TABS = [
  { path: '/home', label: 'Home' },
  { path: '/last-minute', label: 'Crisis Mode' },
  { path: '/disruption', label: 'Recover' },
]

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  if (!user || location.pathname === '/') return null

  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <button
          onClick={() => navigate('/home')}
          className="nav-logo"
          aria-label="Aetherion home"
        >
          <span className="nav-logo-icon">◇</span>
          <span className="nav-logo-text">{'AETH'}<span className="nav-logo-accent">{'ER'}</span>{'ION'}</span>
        </button>
        <span className="nav-badge">v0.5-beta</span>
        <span className="nav-model-status">
          <span className="status-dot" />
          Gemini 3.5 Flash
        </span>
      </div>

      <div className="nav-tabs">
        {NAV_TABS.map(tab => (
          <button
            key={tab.path}
            className={`nav-tab${location.pathname === tab.path ? ' nav-tab-active' : ''}`}
            onClick={() => navigate(tab.path)}
            aria-current={location.pathname === tab.path ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="nav-right" ref={dropdownRef}>
        <button
          id="nav-user-btn"
          className="nav-user-btn"
          onClick={() => setShowDropdown(!showDropdown)}
          aria-expanded={showDropdown}
          aria-haspopup="true"
          aria-label="User menu"
        >
          {user.photoURL
            ? <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" />
            : <span className="nav-user-initial">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </span>
          }
        </button>
        {showDropdown && (
          <div className="user-dropdown">
            <div className="dropdown-header">
              <div className="dropdown-name">{user.displayName || 'User'}</div>
              <div className="dropdown-email">{user.email}</div>
            </div>
            <div className="dropdown-divider" />
            <button
              className="dropdown-item"
              onClick={() => { setShowDropdown(false); logout() }}
            >
              Sign Out
            </button>
          </div>
        )}
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

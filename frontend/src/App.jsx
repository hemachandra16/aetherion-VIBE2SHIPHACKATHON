// App.jsx — routing and auth gate
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import LastMinuteScreen from './screens/LastMinuteScreen'
import DisruptionScreen from './screens/DisruptionScreen'

function NavBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user || location.pathname === '/') return null

  return (
    <nav className="nav-bar">
      <button
        onClick={() => navigate('/home')}
        className="nav-logo"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        aria-label="Aetherion home"
      >
        AETH<span>ER</span>ION
      </button>
      <button
        id="nav-user-btn"
        className="nav-user-btn"
        onClick={() => navigate('/home')}
        aria-label="Go to home"
        title={user.displayName || 'Account'}
      >
        {user.photoURL
          ? <img src={user.photoURL} alt={user.displayName || 'User'} referrerPolicy="no-referrer" />
          : <span style={{ fontSize: 14, color: 'var(--paper-dim)' }}>
              {(user.displayName || user.email || '?')[0].toUpperCase()}
            </span>
        }
      </button>
    </nav>
  )
}

function AuthGate({ children }) {
  const { user } = useAuth()
  if (user === undefined) {
    // Loading state
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="thinking-dots"><span /><span /><span /></div>
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

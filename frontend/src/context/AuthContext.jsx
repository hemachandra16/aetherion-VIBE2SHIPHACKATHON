// Auth context — wraps Firebase Google Sign-In
// Includes dev bypass for testing when Firebase domain isn't configured
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const AuthContext = createContext(null)

// Dev bypass: if Firebase auth fails with unauthorized-domain,
// allow using a mock user for testing the rest of the app
const DEV_BYPASS_KEY = 'aetherion_dev_bypass'

function getDevUser() {
  try {
    const stored = localStorage.getItem(DEV_BYPASS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = loading
  const [error, setError]     = useState(null)
  const [authMode, setAuthMode] = useState('firebase') // 'firebase' | 'dev'

  useEffect(() => {
    // Check for dev bypass first
    const devUser = getDevUser()
    if (devUser) {
      setUser(devUser)
      setAuthMode('dev')
      return
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
    })
    return unsub
  }, [])

  async function signInWithGoogle() {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
      setAuthMode('firebase')
    } catch (e) {
      console.error('[auth] Google sign-in failed:', e)

      // Check for unauthorized-domain error specifically
      if (e.code === 'auth/unauthorized-domain') {
        setError(
          'Firebase domain not authorized. Click "Continue in dev mode" below to test, ' +
          'or add "localhost" to Firebase Console → Authentication → Settings → Authorized domains.'
        )
      } else {
        setError(e.message || 'Sign-in failed. Please try again.')
      }
    }
  }

  function signInDevMode() {
    const devUser = {
      uid: 'dev-user-' + Date.now(),
      displayName: 'Dev User',
      email: 'dev@aetherion.local',
      photoURL: null,
      _isDev: true,
    }
    localStorage.setItem(DEV_BYPASS_KEY, JSON.stringify(devUser))
    setUser(devUser)
    setAuthMode('dev')
    setError(null)
  }

  async function logout() {
    localStorage.removeItem(DEV_BYPASS_KEY)
    if (authMode === 'firebase') {
      await signOut(auth)
    }
    setUser(null)
    setAuthMode('firebase')
  }

  return (
    <AuthContext.Provider value={{ user, error, authMode, signInWithGoogle, signInDevMode, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

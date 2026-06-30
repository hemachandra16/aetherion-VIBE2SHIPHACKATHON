// Auth context — wraps Firebase Google Sign-In
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = loading
  const [error, setError]     = useState(null)
  const [authMode, setAuthMode] = useState('firebase')

  useEffect(() => {
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

      if (e.code === 'auth/unauthorized-domain') {
        setError(
          'Firebase domain not authorized. Add this domain to Firebase Console → ' +
          'Authentication → Settings → Authorized domains, then try again.'
        )
      } else {
        setError(e.message || 'Sign-in failed. Please try again.')
      }
    }
  }

  async function logout() {
    if (authMode === 'firebase') {
      await signOut(auth)
    }
    setUser(null)
    setAuthMode('firebase')
  }

  return (
    <AuthContext.Provider value={{ user, error, authMode, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

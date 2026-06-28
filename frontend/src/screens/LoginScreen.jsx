// Login / auth screen
import { useAuth } from '../context/AuthContext'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
    <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
    <path d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z" fill="#FF3D00"/>
    <path d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.6C29.6 37 26.9 38 24 38c-6.1 0-10.7-3.1-11.8-7.5l-7 5.4C8.7 42 15.8 46 24 46z" fill="#4CAF50"/>
    <path d="M44.5 20H24v8.5h11.8c-.8 2.3-2.4 4.3-4.4 5.8l6.6 5.6C42 36.4 45 30.8 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
  </svg>
)

export default function LoginScreen() {
  const { signInWithGoogle, signInDevMode, error } = useAuth()

  const isUnauthorizedDomain = error && error.includes('domain not authorized')

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-logo">AETH<span>ER</span>ION</div>
      </div>
      <div className="auth-tagline">
        The AI that doesn't remind you about deadlines — it helps you survive them.
      </div>

      {error && (
        <div className="error-banner" style={{ maxWidth: 360 }}>
          <strong>Sign-in error:</strong> {error}
        </div>
      )}

      <button
        id="google-signin-btn"
        className="google-sign-in-btn"
        onClick={signInWithGoogle}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Dev mode bypass — only shown when Firebase domain error occurs */}
      {isUnauthorizedDomain && (
        <button
          id="dev-mode-btn"
          className="btn btn-ghost"
          onClick={signInDevMode}
          style={{
            marginTop: 8,
            fontSize: 13,
            color: 'var(--sage)',
            border: '1px solid var(--sage-dim, rgba(124,179,66,0.3))',
          }}
        >
          Continue in dev mode
        </button>
      )}

      <div style={{ fontSize: 11, color: 'var(--paper-faint)', maxWidth: 260, lineHeight: 1.5 }}>
        Your data is stored privately in your account. Nothing is shared.
      </div>
    </div>
  )
}

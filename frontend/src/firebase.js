// Firebase configuration — reusing project concrete-arcadia-r7krv
// Values populated from environment variables — never hardcoded in source
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

let app, auth, googleProvider

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k)

if (missingKeys.length > 0) {
  console.error(
    `[Firebase] Missing environment variables: ${missingKeys.join(', ')}. ` +
    'Copy frontend/.env.example to frontend/.env and fill in your Firebase config.'
  )
}

try {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  googleProvider = new GoogleAuthProvider()
} catch (e) {
  console.error('[Firebase] Failed to initialize:', e.message)
}

export { app, auth, googleProvider }

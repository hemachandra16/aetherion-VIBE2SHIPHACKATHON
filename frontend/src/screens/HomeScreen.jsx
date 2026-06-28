// Home screen — panic entry point + today's commitments list
// No hardcoded task names or times — all data from user/state
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function formatTimeAgo(ms) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

export default function HomeScreen() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Commitments come from user input — this list starts empty
  // Users add commitments through Last-Minute Mode sessions
  const [commitments] = useState([])

  const displayName = user?.displayName?.split(' ')[0] || 'there'

  return (
    <div className="screen">
      {/* Greeting */}
      <div>
        <div className="screen-title">Hey, {displayName}.</div>
        <div className="screen-subtitle" style={{ marginTop: 4 }}>
          What's pressing right now?
        </div>
      </div>

      {/* Primary CTA */}
      <button
        id="panic-entry-btn"
        className="panic-btn pulse"
        onClick={() => navigate('/last-minute')}
        aria-label="Enter Last-Minute Mode"
      >
        <div className="kicker">Something's about to slip</div>
        <div className="title">I'm in trouble →</div>
      </button>

      {/* Disruption mode entry */}
      <button
        id="disruption-entry-btn"
        className="commit-row"
        style={{ cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none', background: 'var(--charcoal)' }}
        onClick={() => navigate('/disruption')}
      >
        <div>
          <div className="commit-name">Log a disruption</div>
          <div className="commit-meta">Emergency, illness, unexpected event</div>
        </div>
        <span className="tag tag-critical">Disruption Mode</span>
      </button>

      {/* Today's commitments */}
      {commitments.length > 0 && (
        <div>
          <div className="section-label">Today</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {commitments.map((c, i) => (
              <div key={i} className="commit-row">
                <div>
                  <div className="commit-name">{c.name}</div>
                  <div className="commit-meta">{c.meta}</div>
                </div>
                <span className={`tag tag-${c.status}`}>{c.statusLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {commitments.length === 0 && (
        <div style={{ color: 'var(--paper-faint)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
          Commitments from your sessions will appear here.
        </div>
      )}

      {/* Sign out */}
      <button
        id="sign-out-btn"
        onClick={logout}
        style={{
          marginTop: 'auto',
          background: 'none',
          border: 'none',
          color: 'var(--paper-faint)',
          fontSize: 12,
          cursor: 'pointer',
          padding: '8px 0',
          textAlign: 'center',
        }}
      >
        Sign out
      </button>
    </div>
  )
}

// Home screen — command center dashboard
// Panic CTA + scheduled duties + disruption entry + status bar
// No hardcoded task names or times — all data from user/state
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomeScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [now, setNow] = useState(new Date())

  // Live clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  // Commitments from user sessions — starts empty
  const [commitments] = useState([])

  const displayName = user?.displayName?.split(' ')[0] || 'there'
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="screen home-screen">
      {/* Hero panic banner — full width gradient */}
      <div className="panic-hero" onClick={() => navigate('/last-minute')}>
        <div className="panic-hero-content">
          <div className="panic-kicker">Something is about to slip</div>
          <div className="panic-headline">I'm in trouble <span className="panic-arrow">›</span></div>
          <div className="panic-desc">
            Tap to trigger the high-urgency Last-Minute Life Saver interface. We will
            immediately diagnose your constraint, cut Nice-to-Haves, and set a live action plan.
          </div>
        </div>
        <div className="panic-hero-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
            <text x="32" y="42" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="32" fontWeight="700">!</text>
          </svg>
        </div>
      </div>

      {/* Scheduled duties section */}
      <div className="section-block">
        <div className="section-label">Scheduled Duties</div>
        <div className="duties-list">
          {commitments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-text">
                No scheduled duties yet. Start a crisis session and your commitments will appear here.
              </div>
            </div>
          ) : (
            commitments.map((c, i) => (
              <div key={i} className="duty-card">
                <div className="duty-info">
                  <div className="duty-name">{c.name}</div>
                  <div className="duty-meta">{c.meta}</div>
                </div>
                <span className={`tag tag-${c.status}`}>{c.statusLabel}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Disruption CTA */}
      <div className="disruption-cta" onClick={() => navigate('/disruption')}>
        <div className="disruption-cta-left">
          <div className="disruption-cta-title">Sudden disruption?</div>
          <div className="disruption-cta-desc">
            Emergency came up? We will auto-triage, reshuffle commitments, and draft apology/postpone messages.
          </div>
        </div>
        <button className="disruption-cta-btn">
          Log Disruption Mode
        </button>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="status-left">
          <span className="status-dot-green" />
          <span>{greeting}, {displayName}</span>
        </div>
        <div className="status-right">
          <span className="status-time">{timeStr}</span>
        </div>
      </div>
    </div>
  )
}

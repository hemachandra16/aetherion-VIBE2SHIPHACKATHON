// Disruption Mode screen
// User logs a disruption — agent triages fallout, drafts reschedule messages
import { useState, useRef } from 'react'
import { sendChat } from '../api'

function makeSessionId() {
  return `dis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function DisruptionScreen() {
  const sessionId = useRef(makeSessionId())
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [plan, setPlan]           = useState(null)
  const [draftEmail, setDraftEmail] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [error, setError]         = useState(null)
  const chatBottomRef             = useRef(null)

  function addMessage(role, content) {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random() }])
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    addMessage('user', text)
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    try {
      const result = await sendChat(text, sessionId.current, history)
      if (result.type === 'clarification') {
        addMessage('agent', result.question)
      } else if (result.type === 'plan') {
        setPlan(result.plan)
        addMessage('agent', 'I\'ve triaged the fallout from your disruption and built a recovery plan.')

        // Check if plan includes a draft email step
        const emailStep = result.plan?.steps?.find(
          s => s.title?.toLowerCase().includes('email') || s.title?.toLowerCase().includes('message')
        )
        if (emailStep) {
          setDraftEmail({
            to: result.triage?.subject_or_topic || 'your contact',
            body: emailStep.description || emailStep.title,
          })
        }
      } else if (result.error) {
        setError(result.message)
      }
    } catch (e) {
      setError(`Connection error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="screen" style={{ paddingBottom: 0, height: '100dvh', overflow: 'hidden' }}>
      <div className="disruption-banner">
        Disruption Mode — log what happened and I'll triage the fallout.
      </div>

      {error && (
        <div className="error-banner"><strong>Error:</strong> {error}</div>
      )}

      <div className="chat-area" style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 && (
          <div className="bubble bubble-agent">
            What happened? Describe the disruption — I'll figure out what's now at risk and what can wait.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`bubble bubble-${m.role === 'user' ? 'user' : 'agent'}`}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="bubble bubble-agent">
            <div className="thinking-dots"><span /><span /><span /></div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Reshuffled plan */}
      {plan?.steps && (
        <div style={{ overflowY: 'auto', maxHeight: '35vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="section-label">Reshuffled plan</div>
          {plan.steps.filter(s => !s.cut).map((step, i) => (
            <div key={i} className="commit-row">
              <div>
                <div className="commit-name">{step.title}</div>
                <div className="commit-meta">{step.description}</div>
              </div>
              <span className="tag tag-ok">{step.duration_minutes}m</span>
            </div>
          ))}
        </div>
      )}

      {/* Draft email CTA */}
      {draftEmail && (
        <button
          id="view-draft-email-btn"
          className="btn btn-ghost"
          onClick={() => setShowModal(true)}
          style={{ width: '100%' }}
        >
          Review draft message →
        </button>
      )}

      {/* Confirm-send modal */}
      {showModal && draftEmail && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-kicker">Disruption mode — draft ready</div>
            <div className="modal-title">Review before sending</div>
            <div style={{ fontSize: 13, color: 'var(--paper-dim)', marginBottom: 12 }}>
              To: <strong style={{ color: 'var(--paper)' }}>{draftEmail.to}</strong>
            </div>
            <div className="draft-box">{draftEmail.body}</div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Edit</button>
              <button
                id="confirm-send-btn"
                className="btn btn-primary"
                onClick={() => {
                  alert('In a production build, this would trigger Gmail API send via /api/email/send')
                  setShowModal(false)
                }}
              >
                Send now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-input-row" style={{ paddingBottom: 16 }}>
        <textarea
          id="disruption-chat-input"
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the disruption…"
          rows={1}
          disabled={loading}
        />
        <button
          id="disruption-send-btn"
          className="send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >↑</button>
      </div>
    </div>
  )
}

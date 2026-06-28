// Disruption Mode screen — reshuffle + email drafting
// User logs a disruption — agent triages fallout, drafts reschedule messages
import { useState, useRef, useEffect } from 'react'
import { sendChat, generateEmailDraft } from '../api'

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
  const [draftLoading, setDraftLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [emailEdited, setEmailEdited] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)
  const [error, setError]         = useState(null)
  const chatBottomRef             = useRef(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
        addMessage('agent', 'I\'ve triaged the fallout from your disruption and built a recovery plan. You can also generate an email to notify affected parties.')
      } else if (result.error) {
        const msg = result.message || 'Something went wrong.'
        const isRateLimit = msg.includes('rate limit') || msg.includes('429')
        setError(isRateLimit
          ? 'Gemini API rate limit reached. Please wait a few minutes and try again.'
          : msg.length > 200 ? msg.slice(0, 200) + '...' : msg
        )
      }
    } catch (e) {
      const msg = e.message || ''
      const isRateLimit = msg.includes('rate limit') || msg.includes('429')
      setError(isRateLimit
        ? 'Gemini API rate limit reached. Please wait a few minutes and try again.'
        : `Connection error: ${msg.length > 150 ? msg.slice(0, 150) + '...' : msg}`
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateDraft() {
    if (draftLoading) return
    setDraftLoading(true)
    try {
      // Build context from the conversation and plan
      const context = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('. ')
      const planSummary = plan?.steps
        ?.filter(s => !s.cut)
        ?.map(s => `${s.title} (${s.duration_minutes}m)`)
        ?.join(', ') || ''

      const draft = await generateEmailDraft(
        context,
        '',  // recipient will be inferred by Gemini
        'Disruption event requiring schedule change',
        planSummary,
      )
      setDraftEmail(draft)
      setEmailEdited(draft.body || '')
      setShowModal(true)
    } catch (e) {
      setError(`Failed to generate draft: ${e.message}`)
    } finally {
      setDraftLoading(false)
    }
  }

  function handleCopyEmail() {
    const fullEmail = `Subject: ${draftEmail?.subject || 'Schedule Update'}\n\n${emailEdited}`
    navigator.clipboard.writeText(fullEmail).then(() => {
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="screen" style={{ paddingBottom: 0, height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
      <div className="disruption-banner">
        <strong>Disruption Mode</strong> — log what happened and I'll triage the fallout, reshuffle your plan, and help draft notifications.
      </div>

      {error && (
        <div className="error-banner"><strong>Error:</strong> {error}</div>
      )}

      <div className="chat-area" style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 && (
          <div className="bubble bubble-agent">
            What happened? Describe the disruption — I'll figure out what's now at risk, reshuffle your priorities, and can draft a message to anyone affected.
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
        <div style={{ overflowY: 'auto', maxHeight: '30vh', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="section-label">Reshuffled plan</div>
          {plan.steps.filter(s => !s.cut).map((step, i) => (
            <div key={i} className="duty-card">
              <div className="duty-info">
                <div className="duty-name">{step.title}</div>
                <div className="duty-meta">{step.description}</div>
              </div>
              <span className="tag tag-ok">{step.duration_minutes}m</span>
            </div>
          ))}
        </div>
      )}

      {/* Draft email CTA — only after plan exists */}
      {plan && (
        <button
          id="generate-draft-btn"
          className="btn btn-ghost"
          onClick={handleGenerateDraft}
          disabled={draftLoading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {draftLoading ? (
            <>
              <div className="thinking-dots" style={{ padding: 0 }}><span /><span /><span /></div>
              Generating draft...
            </>
          ) : (
            <>📧 Generate email draft</>
          )}
        </button>
      )}

      {/* Email draft modal */}
      {showModal && draftEmail && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-kicker">AI-generated email draft</div>
            <div className="modal-title">{draftEmail.subject || 'Schedule Update'}</div>

            {draftEmail.suggested_recipients?.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--paper-dim)', marginBottom: 12 }}>
                Suggested recipients: <strong style={{ color: 'var(--paper)' }}>
                  {draftEmail.suggested_recipients.join(', ')}
                </strong>
              </div>
            )}

            <textarea
              className="draft-editor"
              value={emailEdited}
              onChange={e => setEmailEdited(e.target.value)}
              rows={10}
            />

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Close</button>
              <button
                id="copy-draft-btn"
                className="btn btn-primary"
                onClick={handleCopyEmail}
              >
                {emailCopied ? '✓ Copied!' : 'Copy to clipboard'}
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
          placeholder="Describe the disruption..."
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

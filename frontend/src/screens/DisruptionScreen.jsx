// Disruption Mode screen — reshuffle + email drafting
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendChat, getConfidence, generateEmailDraft, sendRealEmail } from '../api'
import BurnBar from '../components/BurnBar'
import ConfidenceMeter from '../components/ConfidenceMeter'
import ReasoningTrace from '../components/ReasoningTrace'
import PlanView from '../components/PlanView'
import { useChatHistory } from '../hooks/useChatHistory'

export default function DisruptionScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const sessionId = useRef(`disruption_${user?.uid || 'default'}`)
  const { history, activeId, setActiveId, getConversation, saveConversation, deleteConversation } = useChatHistory('disruption')

  const [messages, setMessages] = useState([])
  const [plan, setPlan] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [triage, setTriage] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [draftEmail, setDraftEmail] = useState(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [emailEdited, setEmailEdited] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)
  const [error, setError] = useState(null)
  const [activeAgent, setActiveAgent] = useState(null)
  const [completedAgents, setCompletedAgents] = useState([])
  const [showTrace, setShowTrace] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [totalMinutes, setTotalMinutes] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const planStartRef = useRef(null)
  const reasoningIntervalRef = useRef(null)
  const chatBottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (activeId) {
      const conv = getConversation(activeId)
      if (conv) {
        setMessages(conv.messages || [])
        setPlan(conv.plan || null)
        setConfidence(conv.confidence || null)
        setTriage(conv.triage || null)
        return
      }
      setPlan(null)
      setConfidence(null)
      setTriage(null)
      setTotalMinutes(null)
      setTimeRemaining(null)
      planStartRef.current = null
    }
  }, [activeId])

  useEffect(() => {
    if (activeId && messages.length > 0) {
      const t = setTimeout(() => {
        saveConversation(activeId, messages, plan, confidence, triage)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [messages, plan, confidence, triage, activeId])

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    if (!plan) return
    const id = setInterval(async () => {
      try { setConfidence(await getConfidence(sessionId.current)) } catch {}
    }, 60000)
    return () => clearInterval(id)
  }, [plan])

  useEffect(() => {
    if (!timeRemaining || !planStartRef.current) return
    const id = setInterval(() => {
      const elapsed = (Date.now() - planStartRef.current) / 60000
      setTimeRemaining(Math.max(0, totalMinutes - elapsed))
    }, 30000)
    return () => clearInterval(id)
  }, [timeRemaining, totalMinutes])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('oauth') === 'success') {
      addMessage('agent', 'Google account connected! I can now send emails and add calendar events on your behalf.')
      window.history.replaceState({}, document.title, '/disruption')
    } else if (urlParams.get('oauth') === 'error') {
      setError('Failed to connect Google account. Please try again.')
      window.history.replaceState({}, document.title, '/disruption')
    }
  }, [])

  useEffect(() => { return () => { if (reasoningIntervalRef.current) clearInterval(reasoningIntervalRef.current) } }, [])

  function addMessage(role, content) {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random(), ts: Date.now() }])
  }

  function handleNewChat() {
    if (activeId && messages.length > 0) saveConversation(activeId, messages, plan, confidence, triage)
    const newId = `disruption_${Date.now()}`
    setActiveId(newId)
    setMessages([]); setPlan(null); setConfidence(null); setTriage(null)
    setShowTrace(false); setError(null); setTotalMinutes(null); setTimeRemaining(null)
    planStartRef.current = null; setShowHistory(false)
  }

  function handleLoadHistory(id) {
    if (activeId && messages.length > 0) saveConversation(activeId, messages, plan, confidence, triage)
    setActiveId(id); setShowHistory(false)
  }

  function handleDeleteHistory(id, e) {
    e.stopPropagation()
    deleteConversation(id)
    if (activeId === id) { setActiveId(null); setMessages([]); setPlan(null); setConfidence(null); setTriage(null) }
  }

  function autoResize(e) { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }

  function startReasoning() {
    setShowTrace(true); setActiveAgent('triage'); setCompletedAgents([])
    if (reasoningIntervalRef.current) clearInterval(reasoningIntervalRef.current)
    const steps = ['triage', 'planner', 'critic', 'executor']; let i = 0
    const interval = setInterval(() => {
      i++
      if (i < steps.length) { setCompletedAgents(p => [...p, steps[i - 1]]); setActiveAgent(steps[i]) }
      else { setCompletedAgents([...steps]); setActiveAgent(null); clearInterval(interval); reasoningIntervalRef.current = null }
    }, 2000)
    reasoningIntervalRef.current = interval
  }

  function stopReasoning() {
    if (reasoningIntervalRef.current) { clearInterval(reasoningIntervalRef.current); reasoningIntervalRef.current = null }
    setCompletedAgents(['triage', 'planner', 'critic', 'executor']); setActiveAgent(null)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput(''); setError(null)
    if (!activeId) setActiveId(`disruption_${Date.now()}`)
    addMessage('user', text); setLoading(true); startReasoning()
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    try {
      const result = await sendChat(text, sessionId.current, history)
      if (result.type === 'clarification') { addMessage('agent', result.question); setShowTrace(false) }
      else if (result.type === 'plan') {
        if (result.triage?.time_remaining_minutes) {
          const mins = result.triage.time_remaining_minutes; setTotalMinutes(mins); setTimeRemaining(mins)
          planStartRef.current = Date.now(); setTriage(result.triage)
        }
        setPlan(result.plan); setConfidence(result.confidence)
        const ragNote = result.rag_used ? ' I grounded the plan in your uploaded notes.' : ''
        addMessage('agent', `I've triaged the fallout and built a recovery plan.${ragNote} You can also generate an email to notify affected parties.`)
      } else if (result.error) {
        const msg = result.message || 'Something went wrong.'
        const isRateLimit = msg.includes('rate limit') || msg.includes('429')
        setError(isRateLimit ? 'Gemini API rate limit reached. Please wait a few minutes and try again.' : msg.length > 200 ? msg.slice(0, 200) + '...' : msg)
        setShowTrace(false)
      }
    } catch (e) {
      const msg = e.message || ''; const isRateLimit = msg.includes('rate limit') || msg.includes('429')
      setError(isRateLimit ? 'Gemini API rate limit reached. Please wait a few minutes and try again.' : 'Could not reach the backend. Check your connection and try again.')
      setShowTrace(false)
    } finally { setLoading(false); stopReasoning() }
  }

  async function handleGenerateDraft() {
    if (draftLoading) return; setDraftLoading(true)
    try {
      const context = messages.filter(m => m.role === 'user').map(m => m.content).join('. ')
      const planSummary = plan?.steps?.filter(s => !s.cut).map(s => `${s.title} (${s.duration_minutes}m)`).join(', ') || ''
      const draft = await generateEmailDraft(context, '', 'Disruption event requiring schedule change', planSummary)
      setDraftEmail(draft); setEmailEdited(draft.body || ''); setEmailTo(draft.suggested_recipients?.[0] || '')
      setShowModal(true); setEmailSent(false)
    } catch (e) { setError(`Failed to generate draft: ${e.message}`) } finally { setDraftLoading(false) }
  }

  function handleCopyEmail() {
    navigator.clipboard.writeText(`Subject: ${draftEmail?.subject || 'Schedule Update'}\n\n${emailEdited}`).then(() => {
      setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000)
    })
  }

  async function handleSendEmail() {
    if (!emailTo) { setError('Please provide a recipient email.'); return }
    setEmailSending(true)
    try {
      await sendRealEmail(emailTo, draftEmail?.subject || 'Schedule Update', emailEdited)
      setEmailSent(true); setTimeout(() => setShowModal(false), 2000)
    } catch (e) {
      setError(`Failed to send email: ${e.message}`)
      if (e.message.includes('authenticate') || e.message.includes('credentials'))
        window.location.href = window.location.origin + '/api/oauth/login?session_id=' + sessionId.current
    } finally { setEmailSending(false) }
  }

  function handleStepComplete(result) {
    if (result.confidence) setConfidence(result.confidence)
    if (result.plan) setPlan(prev => ({ ...prev, steps: result.plan }))
  }

  function handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  function formatTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

  function formatHistoryDate(ts) {
    const d = new Date(ts); const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    const y = new Date(now); y.setDate(y.getDate() - 1)
    if (d.toDateString() === y.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="screen screen-chat">
      {timeRemaining !== null && totalMinutes && <BurnBar timeRemainingMinutes={timeRemaining} totalMinutes={totalMinutes} />}

      <div className="disruption-banner">
        <strong>Disruption Mode</strong> — log what happened and I'll triage the fallout, reshuffle your plan, and help draft notifications.
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span><strong>Error:</strong> {error}</span>
          <button onClick={() => setError(null)} className="error-dismiss" aria-label="Dismiss error">✕</button>
        </div>
      )}

      <div className="chat-toolbar">
        <button onClick={() => navigate('/home')} className="btn-back" aria-label="Back to home">← Home</button>
        <div className="chat-toolbar-right">
          <button onClick={() => setShowHistory(!showHistory)} className="btn-history">📋 History {history.length > 0 && `(${history.length})`}</button>
          <button onClick={handleNewChat} className="btn-new-chat" disabled={loading}>New Chat</button>
        </div>
      </div>

      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <span className="history-title">Chat History</span>
            <button onClick={() => setShowHistory(false)} className="history-close">✕</button>
          </div>
          {history.length === 0 ? (
            <div className="history-empty">No previous conversations</div>
          ) : (
            <div className="history-list">
              {history.map(conv => (
                <div key={conv.id} className={`history-item ${activeId === conv.id ? 'history-item-active' : ''}`} onClick={() => handleLoadHistory(conv.id)}>
                  <div className="history-item-title">{conv.title}</div>
                  <div className="history-item-meta"><span>{formatHistoryDate(conv.updatedAt || conv.createdAt)}</span><span>{conv.messages?.length || 0} messages</span></div>
                  <button className="history-item-delete" onClick={(e) => handleDeleteHistory(conv.id, e)} aria-label="Delete conversation">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chat-area">
        {messages.length === 0 && (
          <div className="bubble bubble-agent">What happened? Describe the disruption — I'll figure out what's now at risk, reshuffle your priorities, and can draft a message to anyone affected.</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`bubble bubble-${m.role === 'user' ? 'user' : 'agent'}`}>
            {m.ts && <div className="bubble-time">{formatTime(m.ts)}</div>}
            <div>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="bubble bubble-agent thinking-bubble" role="status" aria-label="Agent is thinking">
            <div className="thinking-dots"><span /><span /><span /></div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      <ReasoningTrace visible={showTrace} activeAgent={activeAgent} completedAgents={completedAgents} />

      {plan && <div className="plan-panel"><PlanView plan={plan} sessionId={sessionId.current} onStepComplete={handleStepComplete} disabled={loading} /></div>}

      {confidence && <ConfidenceMeter score={confidence.score} label={confidence.label} trend={confidence.trend} completed={confidence.completed} total={confidence.total} />}

      {plan && (
        <button id="generate-draft-btn" className="btn btn-ghost" onClick={handleGenerateDraft} disabled={draftLoading}>
          {draftLoading ? <span className="draft-loading"><span className="thinking-dots" style={{ padding: 0 }}><span /><span /><span /></span> Generating draft...</span> : '📧 Generate email draft'}
        </button>
      )}

      {showModal && draftEmail && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-kicker">AI-generated email draft</div>
            <div className="modal-title">{draftEmail.subject || 'Schedule Update'}</div>
            {draftEmail.suggested_recipients?.length > 0 && <div className="modal-hint">Suggested recipients: <strong>{draftEmail.suggested_recipients.join(', ')}</strong></div>}
            <div className="modal-field"><input type="email" placeholder="recipient@college.edu" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="modal-input" required /></div>
            <textarea className="draft-editor" value={emailEdited} onChange={e => setEmailEdited(e.target.value)} rows={10} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Close</button>
              <button className="btn btn-ghost" onClick={handleCopyEmail}>{emailCopied ? '✓ Copied' : 'Copy'}</button>
              <button id="send-real-email-btn" className="btn btn-primary" onClick={handleSendEmail} disabled={emailSending || emailSent}>{emailSending ? 'Sending...' : emailSent ? '✓ Sent!' : 'Send Email'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-input-row">
        <textarea ref={textareaRef} id="disruption-chat-input" className="chat-input" value={input} onChange={e => setInput(e.target.value)} onInput={autoResize} onKeyDown={handleKeyDown} placeholder="Describe the disruption..." rows={1} maxLength={2000} disabled={loading} aria-label="Chat input" />
        <div className="char-count">{input.length > 0 && `${input.length}/2000`}</div>
        <button id="disruption-send-btn" className="send-btn" onClick={handleSend} disabled={loading || !input.trim()} aria-label="Send message" title="Send message (Enter)">↑</button>
      </div>
    </div>
  )
}

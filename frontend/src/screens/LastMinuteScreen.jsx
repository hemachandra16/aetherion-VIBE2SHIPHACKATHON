// Last-Minute Mode screen — the headline feature
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendChat, getConfidence } from '../api'
import BurnBar from '../components/BurnBar'
import ConfidenceMeter from '../components/ConfidenceMeter'
import ReasoningTrace from '../components/ReasoningTrace'
import PlanView from '../components/PlanView'
import FileUpload from '../components/FileUpload'
import { useChatHistory } from '../hooks/useChatHistory'

function ThinkingBubble() {
  return (
    <div className="bubble bubble-agent thinking-bubble" role="status" aria-label="Agent is thinking">
      <div className="thinking-dots"><span /><span /><span /></div>
    </div>
  )
}

export default function LastMinuteScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const sessionId = useRef(`crisis_${user?.uid || 'default'}`)
  const { history, activeId, setActiveId, getConversation, saveConversation, deleteConversation } = useChatHistory('crisis', user?.uid)

  const [messages, setMessages] = useState([])
  const [plan, setPlan] = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [triage, setTriage] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState(null)
  const [completedAgents, setCompletedAgents] = useState([])
  const [showTrace, setShowTrace] = useState(false)
  const [ragUploaded, setRagUploaded] = useState(false)
  const [error, setError] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const [totalMinutes, setTotalMinutes] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const planStartRef = useRef(null)
  const chatBottomRef = useRef(null)
  const reasoningIntervalRef = useRef(null)
  const textareaRef = useRef(null)

  // Load active conversation or start fresh
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
      // New conversation — don't reset messages, just set empty state
      setPlan(null)
      setConfidence(null)
      setTriage(null)
      setTotalMinutes(null)
      setTimeRemaining(null)
      planStartRef.current = null
    }
  }, [activeId])

  // Save conversation when messages change (debounced)
  useEffect(() => {
    if (activeId && messages.length > 0) {
      const t = setTimeout(() => {
        saveConversation(activeId, messages, plan, confidence, triage)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [messages, plan, confidence, triage, activeId])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
    return () => { if (reasoningIntervalRef.current) clearInterval(reasoningIntervalRef.current) }
  }, [])

  function addMessage(role, content) {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random(), ts: Date.now() }])
  }

  function handleNewChat() {
    if (activeId && messages.length > 0) {
      saveConversation(activeId, messages, plan, confidence, triage)
    }
    const newId = `crisis_${Date.now()}`
    setActiveId(newId)
    setMessages([])
    setPlan(null)
    setConfidence(null)
    setTriage(null)
    setShowTrace(false)
    setError(null)
    setTotalMinutes(null)
    setTimeRemaining(null)
    planStartRef.current = null
    setShowHistory(false)
  }

  function handleLoadHistory(id) {
    if (activeId && messages.length > 0) {
      saveConversation(activeId, messages, plan, confidence, triage)
    }
    setActiveId(id)
    setShowHistory(false)
  }

  function handleDeleteHistory(id, e) {
    e.stopPropagation()
    deleteConversation(id)
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
      setPlan(null)
      setConfidence(null)
      setTriage(null)
    }
  }

  function autoResize(e) {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function startReasoning() {
    setShowTrace(true)
    setActiveAgent('triage')
    setCompletedAgents([])
    if (reasoningIntervalRef.current) clearInterval(reasoningIntervalRef.current)
    const steps = ['triage', 'planner', 'critic', 'executor']
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i < steps.length) {
        setCompletedAgents(prev => [...prev, steps[i - 1]])
        setActiveAgent(steps[i])
      } else {
        setCompletedAgents([...steps])
        setActiveAgent(null)
        clearInterval(interval)
        reasoningIntervalRef.current = null
      }
    }, 2000)
    reasoningIntervalRef.current = interval
  }

  function stopReasoning() {
    if (reasoningIntervalRef.current) {
      clearInterval(reasoningIntervalRef.current)
      reasoningIntervalRef.current = null
    }
    setCompletedAgents(['triage', 'planner', 'critic', 'executor'])
    setActiveAgent(null)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)

    if (!activeId) {
      const newId = `crisis_${Date.now()}`
      setActiveId(newId)
    }

    addMessage('user', text)
    setLoading(true)
    startReasoning()

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    try {
      const result = await sendChat(text, sessionId.current, history)
      if (result.type === 'clarification') {
        addMessage('agent', result.question)
        setShowTrace(false)
      } else if (result.type === 'plan') {
        if (result.triage?.time_remaining_minutes) {
          const mins = result.triage.time_remaining_minutes
          setTotalMinutes(mins)
          setTimeRemaining(mins)
          planStartRef.current = Date.now()
          setTriage(result.triage)
        }
        setPlan(result.plan)
        setConfidence(result.confidence)
        const ragNote = result.rag_used ? ' I grounded the plan in your uploaded notes.' : ''
        const revisedNote = result.was_revised ? ' The Critic agent revised it to fit your time budget.' : ''
        addMessage('agent', `Plan ready.${ragNote}${revisedNote}${result.critique_notes ? ' ' + result.critique_notes : ''}`)
      } else if (result.error) {
        const msg = result.message || 'Something went wrong.'
        const isRateLimit = msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
        setError(isRateLimit
          ? 'Gemini API rate limit reached. The free tier allows 20 requests/day. Please wait a few minutes and try again.'
          : msg.length > 200 ? msg.slice(0, 200) + '...' : msg)
        addMessage('agent', isRateLimit
          ? 'I\'ve hit the API rate limit. Please wait a couple of minutes and try again.'
          : 'I hit an error building your plan. Please try again in a moment.')
        setShowTrace(false)
      }
    } catch (e) {
      const msg = e.message || ''
      const isRateLimit = msg.includes('rate limit') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
      setError(isRateLimit
        ? 'Gemini API rate limit reached. Please wait a few minutes and try again.'
        : 'Could not reach the backend. Check your connection and try again.')
      addMessage('agent', isRateLimit
        ? 'I\'ve hit the API rate limit. Please wait a couple of minutes and try again.'
        : 'Could not reach the backend. Check your connection and try again.')
      setShowTrace(false)
    } finally {
      setLoading(false)
      stopReasoning()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleStepComplete(result) {
    if (result.confidence) setConfidence(result.confidence)
    if (result.plan) setPlan(prev => ({ ...prev, steps: result.plan }))
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatHistoryDate(ts) {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="screen screen-chat">
      {timeRemaining !== null && totalMinutes && (
        <BurnBar timeRemainingMinutes={timeRemaining} totalMinutes={totalMinutes} />
      )}

      {error && (
        <div className="error-banner" role="alert">
          <span><strong>Error:</strong> {error}</span>
          <button onClick={() => setError(null)} className="error-dismiss" aria-label="Dismiss error">✕</button>
        </div>
      )}

      <div className="chat-toolbar">
        <button onClick={() => navigate('/home')} className="btn-back" aria-label="Back to home">← Home</button>
        <div className="chat-toolbar-right">
          <button onClick={() => setShowHistory(!showHistory)} className="btn-history">
            📋 History {history.length > 0 && `(${history.length})`}
          </button>
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
                <div
                  key={conv.id}
                  className={`history-item ${activeId === conv.id ? 'history-item-active' : ''}`}
                  onClick={() => handleLoadHistory(conv.id)}
                >
                  <div className="history-item-title">{conv.title}</div>
                  <div className="history-item-meta">
                    <span>{formatHistoryDate(conv.updatedAt || conv.createdAt)}</span>
                    <span>{conv.messages?.length || 0} messages</span>
                  </div>
                  <button
                    className="history-item-delete"
                    onClick={(e) => handleDeleteHistory(conv.id, e)}
                    aria-label="Delete conversation"
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chat-area">
        {messages.length === 0 && (
          <div className="bubble bubble-agent">
            Tell me what's happening — what's the deadline and what needs to get done?
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`bubble bubble-${m.role === 'user' ? 'user' : 'agent'}`}>
            {m.ts && <div className="bubble-time">{formatTime(m.ts)}</div>}
            <div>{m.content}</div>
          </div>
        ))}
        {loading && <ThinkingBubble />}
        <div ref={chatBottomRef} />
      </div>

      <ReasoningTrace visible={showTrace} activeAgent={activeAgent} completedAgents={completedAgents} />

      {plan && (
        <div className="plan-panel">
          <PlanView plan={plan} sessionId={sessionId.current} onStepComplete={handleStepComplete} disabled={loading} />
        </div>
      )}

      {confidence && (
        <ConfidenceMeter score={confidence.score} label={confidence.label} trend={confidence.trend} completed={confidence.completed} total={confidence.total} />
      )}

      <FileUpload sessionId={sessionId.current} onUploadComplete={() => setRagUploaded(true)} />

      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          id="last-minute-chat-input"
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          placeholder="Describe your situation..."
          rows={1}
          maxLength={2000}
          disabled={loading}
          aria-label="Chat input"
        />
        <div className="char-count">{input.length > 0 && `${input.length}/2000`}</div>
        <button id="last-minute-send-btn" className="send-btn" onClick={handleSend} disabled={loading || !input.trim()} aria-label="Send message" title="Send message (Enter)">↑</button>
      </div>
    </div>
  )
}

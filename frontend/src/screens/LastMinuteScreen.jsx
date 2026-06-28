// Last-Minute Mode screen — the headline feature
// All plan/confidence/chat data from backend. Nothing hardcoded.
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendChat, getConfidence } from '../api'
import BurnBar from '../components/BurnBar'
import ConfidenceMeter from '../components/ConfidenceMeter'
import ReasoningTrace from '../components/ReasoningTrace'
import PlanView from '../components/PlanView'
import FileUpload from '../components/FileUpload'

function ThinkingBubble() {
  return (
    <div className="bubble bubble-agent" style={{ padding: '10px 14px' }}>
      <div className="thinking-dots">
        <span /><span /><span />
      </div>
    </div>
  )
}

// Unique session ID per page load
function makeSessionId() {
  return `lm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function LastMinuteScreen() {
  const { user } = useAuth()
  const sessionId = useRef(makeSessionId())

  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [plan, setPlan]                   = useState(null)
  const [confidence, setConfidence]       = useState(null)
  const [triage, setTriage]               = useState(null)
  const [activeAgent, setActiveAgent]     = useState(null)
  const [completedAgents, setCompletedAgents] = useState([])
  const [showTrace, setShowTrace]         = useState(false)
  const [ragUploaded, setRagUploaded]     = useState(false)
  const [error, setError]                 = useState(null)

  // Burn bar: track real deadline time
  const [totalMinutes, setTotalMinutes]   = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const planStartRef = useRef(null)

  const chatBottomRef = useRef(null)

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Confidence polling — every 60s once a plan exists
  useEffect(() => {
    if (!plan) return
    const id = setInterval(async () => {
      try {
        const c = await getConfidence(sessionId.current)
        setConfidence(c)
      } catch {}
    }, 60000)
    return () => clearInterval(id)
  }, [plan])

  // Burn bar countdown — ticks every 30s
  useEffect(() => {
    if (!timeRemaining || !planStartRef.current) return
    const id = setInterval(() => {
      const elapsedMin = (Date.now() - planStartRef.current) / 60000
      setTimeRemaining(prev => Math.max(0, prev - 0.5))
    }, 30000)
    return () => clearInterval(id)
  }, [timeRemaining])

  function addMessage(role, content) {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random() }])
  }

  // Simulate reasoning trace progression during API call
  function startReasoning() {
    setShowTrace(true)
    setActiveAgent('triage')
    setCompletedAgents([])
    // Triage → Planner → Critic → Executor stepping
    const steps = ['triage', 'planner', 'critic', 'executor']
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i < steps.length) {
        setCompletedAgents(prev => [...prev, steps[i - 1]])
        setActiveAgent(steps[i])
      } else {
        setCompletedAgents(steps)
        setActiveAgent(null)
        clearInterval(interval)
      }
    }, 1800)
    return () => clearInterval(interval)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    addMessage('user', text)
    setLoading(true)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const stopReasoning = startReasoning()

    try {
      const result = await sendChat(text, sessionId.current, history)

      if (result.type === 'clarification') {
        addMessage('agent', result.question)
        setShowTrace(false)
      } else if (result.type === 'plan') {
        // Store triage for burn bar
        if (result.triage?.time_remaining_minutes) {
          const mins = result.triage.time_remaining_minutes
          setTotalMinutes(mins)
          setTimeRemaining(mins)
          planStartRef.current = Date.now()
          setTriage(result.triage)
        }
        setPlan(result.plan)
        setConfidence(result.confidence)

        // Agent message summarizing what happened
        const ragNote = result.rag_used ? ' I grounded the plan in your uploaded notes.' : ''
        const revisedNote = result.was_revised ? ' The Critic agent revised it to fit your time budget.' : ''
        addMessage(
          'agent',
          `Plan ready.${ragNote}${revisedNote}${result.critique_notes ? ' ' + result.critique_notes : ''}`
        )
        setShowTrace(false)
      } else if (result.error) {
        setError(result.message || 'Something went wrong with the agent pipeline.')
        addMessage('agent', 'I hit an error building your plan. See the error above for details.')
        setShowTrace(false)
      }
    } catch (e) {
      setError(`Connection error: ${e.message}`)
      addMessage('agent', 'Could not reach the backend. Check your connection and try again.')
      setShowTrace(false)
    } finally {
      setLoading(false)
      stopReasoning()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleStepComplete(result) {
    if (result.confidence) setConfidence(result.confidence)
    if (result.plan)       setPlan(prev => ({ ...prev, steps: result.plan }))
  }

  return (
    <div className="screen" style={{ paddingBottom: 0, height: '100dvh', overflow: 'hidden' }}>
      {/* Burn bar — only when we have real timing from triage */}
      {timeRemaining !== null && totalMinutes && (
        <BurnBar timeRemainingMinutes={timeRemaining} totalMinutes={totalMinutes} />
      )}

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Chat area */}
      <div className="chat-area" style={{ flex: 1, overflowY: 'auto' }}>
        {messages.length === 0 && (
          <div className="bubble bubble-agent">
            Tell me what's happening — what's the deadline and what needs to get done?
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`bubble bubble-${m.role === 'user' ? 'user' : 'agent'}`}
          >
            {m.content}
          </div>
        ))}
        {loading && <ThinkingBubble />}
        <div ref={chatBottomRef} />
      </div>

      {/* Reasoning trace */}
      <ReasoningTrace
        visible={showTrace}
        activeAgent={activeAgent}
        completedAgents={completedAgents}
      />

      {/* Plan — shown once available */}
      {plan && (
        <div style={{ overflowY: 'auto', maxHeight: '40vh' }}>
          <PlanView
            plan={plan}
            sessionId={sessionId.current}
            onStepComplete={handleStepComplete}
            disabled={loading}
          />
        </div>
      )}

      {/* Confidence meter */}
      {confidence && (
        <ConfidenceMeter
          score={confidence.score}
          label={confidence.label}
          trend={confidence.trend}
          completed={confidence.completed}
          total={confidence.total}
        />
      )}

      {/* File upload — always available for RAG grounding */}
      <FileUpload
        sessionId={sessionId.current}
        onUploadComplete={r => setRagUploaded(true)}
      />

      {/* Chat input */}
      <div className="chat-input-row" style={{ paddingBottom: 16 }}>
        <textarea
          id="last-minute-chat-input"
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your situation…"
          rows={1}
          disabled={loading}
          aria-label="Chat input"
        />
        <button
          id="last-minute-send-btn"
          className="send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  )
}

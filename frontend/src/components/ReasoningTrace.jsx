// ReasoningTrace — visible multi-agent pipeline state
// Shows Triage → Planner → Critic → Executor progress
// State driven by pipeline response, not hardcoded steps
const AGENTS = [
  { id: 'triage',   label: 'Triage — classifying urgency' },
  { id: 'planner',  label: 'Planner — building time-boxed plan' },
  { id: 'critic',   label: 'Critic — checking feasibility' },
  { id: 'executor', label: 'Executor — approving plan' },
]

export default function ReasoningTrace({ activeAgent, completedAgents = [], visible }) {
  if (!visible) return null

  return (
    <div className="reasoning-trace">
      <div className="reasoning-trace-header">
        <span style={{ color: 'var(--amber)', fontSize: 10 }}>●</span>
        <span>Agent reasoning in progress</span>
      </div>
      {AGENTS.map((agent) => {
        const isDone   = completedAgents.includes(agent.id)
        const isActive = activeAgent === agent.id && !isDone
        return (
          <div key={agent.id} className="reasoning-step">
            <div className={`rs-icon${isActive ? ' active' : isDone ? ' done' : ''}`}>
              {isDone ? '✓' : isActive ? '…' : '·'}
            </div>
            <span className={`rs-label${isActive ? ' active' : isDone ? ' done' : ''}`}>
              {agent.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

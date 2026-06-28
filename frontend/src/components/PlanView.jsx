// PlanView — renders the plan steps from Planner/Critic output
// All step titles, durations, descriptions come from Gemini — never hardcoded
import { completeStep } from '../api'

export default function PlanView({ plan, sessionId, onStepComplete, disabled }) {
  if (!plan || !plan.steps) return null

  const steps     = plan.steps || []
  // Only show steps as "cut" if they have an explicit `cut: true` flag
  // set by the Critic — NOT just because they have cut_if_behind: true
  // (cut_if_behind is a suggestion for the Critic, not a display state)
  const cutCount  = steps.filter(s => s.cut === true).length

  async function handleStepClick(step, index) {
    if (step.completed || step.cut === true || disabled) return
    try {
      const result = await completeStep(sessionId, index)
      if (onStepComplete) onStepComplete(result)
    } catch (e) {
      console.error('[PlanView] completeStep error:', e)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {plan.plan_title && (
        <div className="section-label">{plan.plan_title}</div>
      )}

      {steps.map((step, i) => {
        // Only treat as cut if explicitly cut by Critic (cut: true)
        const isCut  = step.cut === true
        const isDone = step.completed

        return (
          <div
            key={i}
            id={`plan-step-${i}`}
            className={`plan-step${isDone ? ' plan-step-done' : ''}${isCut ? ' plan-step-cut' : ''}`}
            onClick={() => handleStepClick(step, i)}
            role={isCut ? 'presentation' : 'button'}
            aria-label={isCut ? undefined : `Mark step ${i + 1} complete: ${step.title}`}
            tabIndex={isCut || isDone ? -1 : 0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleStepClick(step, i) }}
          >
            <div className={`step-dur${isCut ? ' step-dur-cut' : ''}`}>
              {isCut ? '—' : `${step.duration_minutes}m`}
            </div>
            <div className="step-content">
              <div className="step-title">{step.title}</div>
              {step.description && (
                <div className="step-sub">{step.description}</div>
              )}
              {step.rag_grounded && (
                <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 3 }}>
                  From your uploaded notes
                </div>
              )}
              {step.cut_if_behind && !isCut && !isDone && (
                <div style={{ fontSize: 10, color: 'var(--paper-faint)', marginTop: 2 }}>
                  Can be skipped if running behind
                </div>
              )}
            </div>
            <div className="step-check">
              {isDone ? '✓' : ''}
            </div>
          </div>
        )
      })}

      {cutCount > 0 && (
        <div className="cut-note">
          Critic agent cut {cutCount} step{cutCount > 1 ? 's' : ''} to fit your time budget
        </div>
      )}

      {plan.planner_notes && (
        <div style={{ fontSize: 12, color: 'var(--paper-faint)', padding: '6px 2px', lineHeight: 1.5 }}>
          {plan.planner_notes}
        </div>
      )}
    </div>
  )
}

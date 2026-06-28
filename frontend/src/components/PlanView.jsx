// PlanView — renders the plan steps from Planner/Critic output
// All step titles, durations, descriptions come from Gemini — never hardcoded
import { completeStep } from '../api'

export default function PlanView({ plan, sessionId, onStepComplete, disabled }) {
  if (!plan || !plan.steps) return null

  const steps     = plan.steps || []
  const cutCount  = steps.filter(s => s.cut || s.cut_if_behind).length
  const activeSteps = steps.filter(s => !s.cut)

  async function handleStepClick(step, index) {
    if (step.completed || step.cut || disabled) return
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
        const isCut  = step.cut || (step.cut_if_behind && !step.completed)
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

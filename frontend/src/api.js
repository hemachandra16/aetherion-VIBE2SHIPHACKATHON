// API client — all backend calls go through here
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || data.detail || `HTTP ${res.status}`)
  }
  return data
}

export async function sendChat(message, sessionId, conversationHistory) {
  return apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      session_id: sessionId,
      conversation_history: conversationHistory,
    }),
  })
}

export async function uploadFile(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  form.append('session_id', sessionId)
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

export async function completeStep(sessionId, stepIndex) {
  return apiFetch('/api/step/complete', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, step_index: stepIndex }),
  })
}

export async function getConfidence(sessionId) {
  return apiFetch(`/api/confidence/${sessionId}`)
}

export async function checkHealth() {
  return apiFetch('/api/health')
}

// ── Commitments (Calendar) ──────────────────────────────
export async function getCommitments(sessionId) {
  return apiFetch(`/api/commitments/${sessionId}`)
}

export async function addCommitment(sessionId, name, dueAt, category = 'task') {
  return apiFetch('/api/commitments', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, name, due_at: dueAt, category }),
  })
}

// ── Email Draft (Gmail) ──────────────────────────────────
export async function generateEmailDraft(context, recipient = '', situation = '', planSummary = '') {
  return apiFetch('/api/email/draft', {
    method: 'POST',
    body: JSON.stringify({ context, recipient, situation, plan_summary: planSummary }),
  })
}

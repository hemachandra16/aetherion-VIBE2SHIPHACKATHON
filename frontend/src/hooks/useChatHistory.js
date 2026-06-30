import { useState, useCallback } from 'react'

const HISTORY_KEY_PREFIX = 'aetherion_history_'

export function useChatHistory(mode, uid) {
  const historyKey = `${HISTORY_KEY_PREFIX}${mode}_${uid || 'anon'}`

  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(historyKey)) || [] } catch { return [] }
  })

  const [activeId, setActiveId] = useState(null)

  const saveHistory = useCallback((list) => {
    setHistory(list)
    localStorage.setItem(historyKey, JSON.stringify(list))
  }, [historyKey])

  function getConversation(id) {
    return history.find(c => c.id === id)
  }

  function saveConversation(id, messages, plan, confidence, triage) {
    if (!id || messages.length === 0) return
    const title = generateTitle(messages)
    const updated = history.map(c => c.id === id ? { ...c, messages, plan, confidence, triage, title, updatedAt: Date.now() } : c)
    const exists = history.some(c => c.id === id)
    if (!exists) {
      updated.unshift({ id, messages, plan, confidence, triage, title, createdAt: Date.now(), updatedAt: Date.now() })
    }
    saveHistory(updated.slice(0, 50))
  }

  function deleteConversation(id) {
    const updated = history.filter(c => c.id !== id)
    saveHistory(updated)
  }

  function generateTitle(messages) {
    const firstUser = messages.find(m => m.role === 'user')
    if (!firstUser) return 'New conversation'
    const text = firstUser.content
    return text.length > 60 ? text.substring(0, 60) + '...' : text
  }

  return {
    history,
    activeId,
    setActiveId,
    getConversation,
    saveConversation,
    deleteConversation,
  }
}

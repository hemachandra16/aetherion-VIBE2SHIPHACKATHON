import { useState, useRef, useEffect } from 'react'

export default function VoiceButton({ sessionId }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  
  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const processorRef = useRef(null)

  // Disconnect function
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setIsRecording(false)
    setIsConnected(false)
  }

  const toggleRecording = async () => {
    if (isRecording) {
      disconnect()
      return
    }

    try {
      // 1. Connect WebSocket
  const wsUrl = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace('http', 'ws') + '/api/voice/stream?session_id=' + (sessionId || 'default')
    : 'ws://localhost:8000/api/voice/stream?session_id=' + (sessionId || 'default')
    
  const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => setIsConnected(true)
      ws.onclose = () => disconnect()
      ws.onerror = (e) => {
        console.error('Voice WS Error', e)
        disconnect()
      }

      // 2. Play incoming audio
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
      let nextStartTime = audioContextRef.current.currentTime

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data)
            window.dispatchEvent(new CustomEvent('aetherion_ws_message', { detail: data }))
          } catch(e) {}
          return
        }
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer()
          // Gemini returns 24kHz PCM by default, we decode or play it
          // Simplified: assume we get raw PCM, we need to wrap it or audio element
          // For now, we will decode it properly if it's wav, or use an audio buffer
          try {
            if (!audioContextRef.current) return
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
            const source = audioContextRef.current.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContextRef.current.destination)
            
            const playTime = Math.max(audioContextRef.current.currentTime, nextStartTime)
            source.start(playTime)
            nextStartTime = playTime + audioBuffer.duration
          } catch(e) {
             console.error("Audio decode error", e)
          }
        }
      }

      // 3. Record microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0)
          // Convert Float32 to Int16 PCM
          const pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          ws.send(pcmData.buffer)
        }
      }

      setIsRecording(true)

    } catch (err) {
      console.error("Mic access denied or error:", err)
      disconnect()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect()
  }, [])

  return (
    <button 
      onClick={toggleRecording}
      className={`voice-btn ${isRecording ? 'pulse-recording' : ''}`}
      title={isRecording ? 'Stop Voice' : 'Start Voice Chat'}
      style={{
        background: isRecording ? 'var(--ember)' : 'var(--sage)',
        color: '#000',
        border: 'none',
        borderRadius: '50%',
        width: 48,
        height: 48,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isRecording ? '0 0 15px var(--ember)' : 'none',
        transition: 'all 0.3s ease'
      }}
    >
      {isRecording ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="6" width="12" height="12"></rect>
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" x2="12" y1="19" y2="22"></line>
        </svg>
      )}
    </button>
  )
}

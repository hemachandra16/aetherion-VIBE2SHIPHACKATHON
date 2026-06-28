// FileUpload — uploads a file for RAG indexing
// Calls /api/upload, shows chunk count from real server response
import { useState, useRef } from 'react'
import { uploadFile } from '../api'

export default function FileUpload({ sessionId, onUploadComplete }) {
  const [status, setStatus]     = useState('idle') // idle | uploading | success | error
  const [message, setMessage]   = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    const allowed = ['application/pdf', 'text/plain', 'text/markdown']
    if (!allowed.includes(file.type) && !file.name.endsWith('.md')) {
      setStatus('error')
      setMessage('Only PDF, TXT, or MD files are supported.')
      return
    }

    setStatus('uploading')
    setMessage(`Uploading ${file.name}…`)
    try {
      const result = await uploadFile(file, sessionId)
      setStatus('success')
      setMessage(`Indexed ${result.chunk_count} chunks from "${result.filename}"`)
      if (onUploadComplete) onUploadComplete(result)
    } catch (e) {
      setStatus('error')
      setMessage(`Upload failed: ${e.message}`)
      console.error('[FileUpload] error:', e)
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const isSuccess = status === 'success'
  const isError   = status === 'error'

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        id="file-upload-input"
        accept=".pdf,.txt,.md"
        onChange={onInputChange}
        style={{ display: 'none' }}
        aria-label="Upload notes or syllabus file"
      />
      <div
        className={`upload-area${isSuccess ? ' upload-success' : ''}${dragOver ? ' drag-over' : ''}`}
        onClick={() => status !== 'uploading' && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload notes or syllabus"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <span className="upload-icon">
          {isSuccess ? '✓' : isError ? '⚠' : status === 'uploading' ? '…' : '↑'}
        </span>
        <div className="upload-label">
          {status === 'idle' && <><strong>Upload notes or syllabus</strong> — PDF, TXT or MD</>}
          {status === 'uploading' && message}
          {isSuccess && <strong>{message}</strong>}
          {isError && <span style={{ color: 'var(--ember)' }}>{message}</span>}
        </div>
      </div>
    </div>
  )
}

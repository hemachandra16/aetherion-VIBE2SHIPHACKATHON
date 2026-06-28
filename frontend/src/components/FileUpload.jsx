// FileUpload — uploads files for RAG indexing
// Calls /api/upload, shows chunk count from real server response
// Supports multiple file uploads per session (up to 5), with 10MB limit
import { useState, useRef } from 'react'
import { uploadFile } from '../api'

const MAX_FILE_SIZE_MB = 10
const MAX_FILES = 5

export default function FileUpload({ sessionId, onUploadComplete }) {
  const [status, setStatus]     = useState('idle') // idle | uploading | success | error
  const [message, setMessage]   = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([]) // { filename, chunk_count }
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return

    // Client-side file type check
    const allowed = ['application/pdf', 'text/plain', 'text/markdown']
    const allowedExt = ['.pdf', '.txt', '.md']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
      setStatus('error')
      setMessage('Only PDF, TXT, or MD files are supported.')
      return
    }

    // Client-side file size check
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setStatus('error')
      setMessage(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: ${MAX_FILE_SIZE_MB} MB.`)
      return
    }

    // Client-side file count check
    if (uploadedFiles.length >= MAX_FILES) {
      setStatus('error')
      setMessage(`Maximum ${MAX_FILES} files per session.`)
      return
    }

    setStatus('uploading')
    setMessage(`Uploading ${file.name}...`)
    try {
      const result = await uploadFile(file, sessionId)
      setStatus('success')
      setMessage(`Indexed ${result.chunk_count} chunks from "${result.filename}"`)

      // Update uploaded files list from server response
      if (result.uploaded_files) {
        setUploadedFiles(result.uploaded_files)
      } else {
        // Fallback: add to local list
        setUploadedFiles(prev => [...prev, {
          filename: result.filename,
          chunk_count: result.chunk_count,
        }])
      }

      if (onUploadComplete) onUploadComplete(result)
    } catch (e) {
      setStatus('error')
      setMessage(`Upload failed: ${e.message}`)
      console.error('[FileUpload] error:', e)
    }
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
    // Reset input so the same file can be re-uploaded if needed
    if (inputRef.current) inputRef.current.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const isSuccess = status === 'success'
  const isError   = status === 'error'
  const remaining = MAX_FILES - uploadedFiles.length

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
        onClick={() => status !== 'uploading' && remaining > 0 && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload notes or syllabus"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <span className="upload-icon">
          {isSuccess ? '✓' : isError ? '⚠' : status === 'uploading' ? '...' : '↑'}
        </span>
        <div className="upload-label">
          {status === 'idle' && remaining > 0 && (
            <>
              <strong>Upload notes or syllabus</strong> — PDF, TXT or MD (max {MAX_FILE_SIZE_MB}MB)
            </>
          )}
          {status === 'idle' && remaining <= 0 && (
            <span style={{ color: 'var(--paper-faint)' }}>File limit reached ({MAX_FILES}/{MAX_FILES})</span>
          )}
          {status === 'uploading' && message}
          {isSuccess && <strong>{message}</strong>}
          {isError && <span style={{ color: 'var(--ember)' }}>{message}</span>}
        </div>
      </div>

      {/* Show uploaded file list */}
      {uploadedFiles.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          padding: '6px 8px', fontSize: 11, color: 'var(--paper-dim)',
        }}>
          {uploadedFiles.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--sage)' }}>{f.filename}</span>
              <span>{f.chunk_count} chunks</span>
            </div>
          ))}
          <div style={{ color: 'var(--paper-faint)', marginTop: 2 }}>
            {remaining > 0 ? `${remaining} file${remaining > 1 ? 's' : ''} remaining` : 'File limit reached'}
          </div>
        </div>
      )}
    </div>
  )
}

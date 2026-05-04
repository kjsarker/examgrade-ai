'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { DifficultyMode } from '@/types'
import { formatBytes } from '@/lib/utils'

interface UploadedFile {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
  uploadId?: string
  studentName?: string
  errorMessage?: string
}

export default function UploadPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<DifficultyMode>('medium')
  const [questionPaper, setQuestionPaper] = useState<UploadedFile | null>(null)
  const [sampleAnswer, setSampleAnswer] = useState<UploadedFile | null>(null)
  const [studentScripts, setStudentScripts] = useState<UploadedFile[]>([])
  const [isGrading, setIsGrading] = useState(false)
  const [error, setError] = useState('')
  const [successJobId, setSuccessJobId] = useState<string | null>(null)
  const [gradingProgress, setGradingProgress] = useState<{ done: number; total: number } | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  const uploadFile = async (file: File, uploadType: string, studentName?: string): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploadType', uploadType)
    if (studentName) formData.append('studentName', studentName)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
    return (await res.json()).upload.id
  }

  const handleQuestionDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    const entry: UploadedFile = { id: Date.now().toString(), file: files[0], status: 'uploading' }
    setQuestionPaper(entry)
    try {
      const uploadId = await uploadFile(files[0], 'question_paper')
      setQuestionPaper({ ...entry, status: 'done', uploadId })
    } catch (err) {
      setQuestionPaper({ ...entry, status: 'error', errorMessage: err instanceof Error ? err.message : 'Upload failed' })
    }
  }, [])

  const handleAnswerDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    const entry: UploadedFile = { id: Date.now().toString(), file: files[0], status: 'uploading' }
    setSampleAnswer(entry)
    try {
      const uploadId = await uploadFile(files[0], 'sample_answer')
      setSampleAnswer({ ...entry, status: 'done', uploadId })
    } catch (err) {
      setSampleAnswer({ ...entry, status: 'error', errorMessage: err instanceof Error ? err.message : 'Upload failed' })
    }
  }, [])

  const handleScriptsDrop = useCallback(async (files: File[]) => {
    const newEntries: UploadedFile[] = files.map((f) => ({
      id: Date.now().toString() + Math.random(),
      file: f,
      status: 'uploading' as const,
      studentName: f.name.replace(/\.[^.]+$/, ''),
    }))
    setStudentScripts((prev) => [...prev, ...newEntries])
    for (const entry of newEntries) {
      try {
        const uploadId = await uploadFile(entry.file, 'student_script', entry.studentName)
        setStudentScripts((prev) => prev.map((s) => s.id === entry.id ? { ...s, status: 'done', uploadId } : s))
      } catch {
        setStudentScripts((prev) => prev.map((s) => s.id === entry.id ? { ...s, status: 'error' } : s))
      }
    }
  }, [])

  const updateStudentName = (id: string, name: string) =>
    setStudentScripts((prev) => prev.map((s) => s.id === id ? { ...s, studentName: name } : s))

  const removeScript = (id: string) =>
    setStudentScripts((prev) => prev.filter((s) => s.id !== id))

  const handleStartGrading = async () => {
    if (!questionPaper?.uploadId || !sampleAnswer?.uploadId) {
      setError('Please upload both the question paper and sample answer.')
      return
    }
    const readyScripts = studentScripts.filter((s) => s.status === 'done' && s.uploadId)
    if (readyScripts.length === 0) {
      setError('Please upload at least one student script.')
      return
    }
    setIsGrading(true)
    setError('')
    setGradingProgress(null)
    try {
      const res = await fetch('/api/grading/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Grading Job — ${new Date().toLocaleDateString()}`,
          difficultyMode: difficulty,
          questionPaperId: questionPaper.uploadId,
          sampleAnswerId: sampleAnswer.uploadId,
          studentScriptIds: readyScripts.map((s) => s.uploadId!),
        }),
      })
      const data = await res.json()
      if (res.status === 403) {
        setShowUpgradePrompt(true)
        setIsGrading(false)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Grading failed')

      // Poll progress until complete
      const jobId = data.jobId
      const total = readyScripts.length
      setGradingProgress({ done: 0, total })
      await new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          try {
            const pr = await fetch(`/api/grading/progress?jobId=${jobId}`)
            const pdata = await pr.json()
            const done = (pdata.processed_papers || 0) + (pdata.failed_papers || 0)
            setGradingProgress({ done, total })
            if (pdata.status === 'completed' || pdata.status === 'failed') {
              clearInterval(interval)
              resolve()
            }
          } catch { /* keep polling */ }
        }, 2000)
      })

      setSuccessJobId(jobId)
      setIsGrading(false)
      setGradingProgress(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed')
      setIsGrading(false)
      setGradingProgress(null)
    }
  }

  const statusIcon = (s: string) => s === 'uploading' ? '⏳' : s === 'done' ? '✓' : '✗'

  const DropZone = ({ onDrop, label, multiple = false, file, onRemove, files }: {
    onDrop: (f: File[]) => void
    label: string
    multiple?: boolean
    file?: UploadedFile | null
    onRemove?: () => void
    files?: UploadedFile[]
  }) => {
    const accept = {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'application/vnd.oasis.opendocument.presentation': ['.odp'],
    }
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, multiple })
    return (
      <div>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${isDragActive ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
          <input {...getInputProps()} />
          <p className="text-sm text-gray-500">
            {isDragActive ? 'Drop here…' : <><span className="text-gray-900 font-medium">Click to upload</span> or drag & drop</>}
          </p>
          <p className="text-xs text-gray-400 mt-1">{label}</p>
        </div>
        {file && (
          <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${file.status === 'done' ? 'bg-green-50 text-green-700' : file.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
            <span>{statusIcon(file.status)}</span>
            <div className="flex-1 min-w-0">
              <span className="truncate block">{file.file.name}</span>
              {file.status === 'error' && file.errorMessage && (
                <span className="text-red-400 block truncate">{file.errorMessage}</span>
              )}
            </div>
            <span className="text-gray-400 shrink-0">{formatBytes(file.file.size)}</span>
            {onRemove && (
              <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="text-gray-400 hover:text-red-500 ml-1 shrink-0">✕</button>
            )}
          </div>
        )}
        {files && files.length > 0 && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {files.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                <span className={s.status === 'done' ? 'text-green-500' : s.status === 'error' ? 'text-red-500' : 'text-gray-400'}>{statusIcon(s.status)}</span>
                <input
                  value={s.studentName || ''}
                  onChange={(e) => updateStudentName(s.id, e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-gray-700 min-w-0"
                  placeholder="Student name"
                />
                <span className="text-gray-400 shrink-0">{formatBytes(s.file.size)}</span>
                <button onClick={() => removeScript(s.id)} className="text-gray-400 hover:text-red-500 ml-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const difficultyOptions = [
    { value: 'easy' as DifficultyMode, label: 'Easy', desc: 'Lenient grading' },
    { value: 'medium' as DifficultyMode, label: 'Medium', desc: 'Balanced grading' },
    { value: 'hard' as DifficultyMode, label: 'Hard', desc: 'Strict grading' },
  ]

  const readyCount = studentScripts.filter((s) => s.status === 'done').length

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">New Grading Job</h1>
        <p className="text-sm text-gray-500 mt-1">Upload exam materials and start grading</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Job title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="e.g. CS101 Midterm — May 2026"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Grading mode</label>
          <div className="grid grid-cols-3 gap-2">
            {difficultyOptions.map((opt) => (
              <button key={opt.value} onClick={() => setDifficulty(opt.value)}
                className={`p-3 rounded-xl border text-left transition-colors ${difficulty === opt.value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 hover:border-gray-400'}`}>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className={`text-xs mt-0.5 ${difficulty === opt.value ? 'text-gray-400' : 'text-gray-400'}`}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Question paper</label>
          <DropZone onDrop={handleQuestionDrop} label="PDF, Word, Excel, PowerPoint, image, or text" file={questionPaper} onRemove={() => setQuestionPaper(null)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sample answer / marking rubric</label>
          <DropZone onDrop={handleAnswerDrop} label="PDF, Word, Excel, PowerPoint, image, or text" file={sampleAnswer} onRemove={() => setSampleAnswer(null)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Student answer scripts
            {readyCount > 0 && <span className="ml-2 text-xs font-normal text-gray-400">{readyCount} ready</span>}
          </label>
          <DropZone onDrop={handleScriptsDrop} label="PDF, Word, Excel, PowerPoint, image, text — multiple files" multiple files={studentScripts} />
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleStartGrading}
          disabled={isGrading || !questionPaper?.uploadId || !sampleAnswer?.uploadId || readyCount === 0}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isGrading
            ? gradingProgress
              ? `Grading ${gradingProgress.done} of ${gradingProgress.total} papers…`
              : 'Starting…'
            : `Start Grading${readyCount > 0 ? ` (${readyCount} papers)` : ''}`}
        </button>

        {isGrading && gradingProgress && (
          <div className="space-y-1.5">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-gray-900 rounded-full transition-all duration-500"
                style={{ width: `${gradingProgress.total > 0 ? (gradingProgress.done / gradingProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center">
              {gradingProgress.done} / {gradingProgress.total} papers graded — do not close this tab
            </p>
          </div>
        )}
      </div>

      {/* Success confirmation dialog */}
      {successJobId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Grading Complete!</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              All papers have been graded automatically. A full report with scores and feedback has been sent to your email.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => router.push(`/dashboard/jobs/${successJobId}`)}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                View Job
              </button>
              <button
                onClick={() => router.push('/dashboard/jobs')}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                All Jobs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade prompt dialog */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">⚡</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Free Plan Limit Reached</h2>
            <p className="text-sm text-gray-500">
              You have used all 50 free papers included in your trial. Upgrade to Pro or Premium to grade more papers.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => router.push('/dashboard/settings')}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Upgrade Plan
              </button>
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

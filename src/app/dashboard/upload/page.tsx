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
    } catch { setQuestionPaper({ ...entry, status: 'error' }) }
  }, [])

  const handleAnswerDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    const entry: UploadedFile = { id: Date.now().toString(), file: files[0], status: 'uploading' }
    setSampleAnswer(entry)
    try {
      const uploadId = await uploadFile(files[0], 'sample_answer')
      setSampleAnswer({ ...entry, status: 'done', uploadId })
    } catch { setSampleAnswer({ ...entry, status: 'error' }) }
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
      if (!res.ok) throw new Error(data.error || 'Grading failed')
      router.push(`/dashboard/jobs/${data.jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed')
      setIsGrading(false)
    }
  }

  const statusIcon = (s: string) => s === 'uploading' ? '⏳' : s === 'done' ? '✓' : '✗'

  const DropZone = ({ onDrop, label, multiple = false, file, files }: {
    onDrop: (f: File[]) => void
    label: string
    multiple?: boolean
    file?: UploadedFile | null
    files?: UploadedFile[]
  }) => {
    const accept = { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png'], 'text/plain': ['.txt'] }
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
            <span className="truncate">{file.file.name}</span>
            <span className="ml-auto text-gray-400">{formatBytes(file.file.size)}</span>
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
        <p className="text-sm text-gray-500 mt-1">Upload exam materials and start AI grading</p>
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
          <DropZone onDrop={handleQuestionDrop} label="PDF, image, or text file" file={questionPaper} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sample answer / marking rubric</label>
          <DropZone onDrop={handleAnswerDrop} label="PDF, image, or text file" file={sampleAnswer} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Student answer scripts
            {readyCount > 0 && <span className="ml-2 text-xs font-normal text-gray-400">{readyCount} ready</span>}
          </label>
          <DropZone onDrop={handleScriptsDrop} label="Multiple files supported — PDF, image, or text" multiple files={studentScripts} />
        </div>
      </div>

      <button
        onClick={handleStartGrading}
        disabled={isGrading || !questionPaper?.uploadId || !sampleAnswer?.uploadId || readyCount === 0}
        className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isGrading ? 'Grading in progress… this may take a few minutes' : `Start Grading${readyCount > 0 ? ` (${readyCount} papers)` : ''}`}
      </button>
    </div>
  )
}

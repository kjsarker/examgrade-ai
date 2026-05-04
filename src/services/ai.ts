import OpenAI from 'openai'
import { AIGradingResponse, DifficultyMode } from '@/types'
import { buildGradingPrompt } from './prompts'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _client
}

type ContentPart = OpenAI.Chat.ChatCompletionContentPart

// Build content parts for a document: text or file reference for scanned PDFs
function docParts(label: string, text: string, fileId?: string): ContentPart[] {
  if (fileId) {
    return [
      { type: 'text', text: `${label}:` },
      { type: 'file', file: { file_id: fileId } } as unknown as ContentPart,
    ]
  }
  return [{ type: 'text', text: `${label}:\n${text}` }]
}

export async function gradeStudentPaper(params: {
  questionPaper: string
  questionPaperFileId?: string
  sampleAnswer: string
  sampleAnswerFileId?: string
  studentScript: string
  studentScriptFileId?: string
  studentName: string
  studentId?: string
  difficultyMode: DifficultyMode
  customPromptOverride?: string
  retries?: number
}): Promise<AIGradingResponse> {
  const {
    questionPaper, questionPaperFileId,
    sampleAnswer, sampleAnswerFileId,
    studentScript, studentScriptFileId,
    studentName, studentId, difficultyMode, customPromptOverride,
    retries = 3,
  } = params

  const systemPrompt = buildGradingPrompt(difficultyMode, customPromptOverride)
  const hasFiles = !!(questionPaperFileId || sampleAnswerFileId || studentScriptFileId)

  const userContent: ContentPart[] = [
    { type: 'text', text: `Student: ${studentName}${studentId ? ` (ID: ${studentId})` : ''}` },
    ...docParts('QUESTION PAPER', questionPaper, questionPaperFileId),
    ...docParts('SAMPLE ANSWER / MARKING RUBRIC', sampleAnswer, sampleAnswerFileId),
    ...docParts('STUDENT SUBMISSION', studentScript, studentScriptFileId),
  ]

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: hasFiles
              ? userContent
              : userContent.map((p) => (p as { text: string }).text).join('\n'),
          },
        ],
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      })

      const text = response.choices[0]?.message?.content || ''
      const result = JSON.parse(text) as AIGradingResponse

      if (
        typeof result.total_score !== 'number' ||
        typeof result.max_score !== 'number' ||
        !Array.isArray(result.question_wise_breakdown)
      ) {
        throw new Error('Invalid grading response structure from AI')
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Grading attempt ${attempt} failed:`, lastError.message)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error('All grading attempts failed')
}

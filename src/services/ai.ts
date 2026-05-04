import OpenAI from 'openai'
import { AIGradingResponse, DifficultyMode } from '@/types'
import { buildGradingPrompt } from './prompts'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _client
}

const PDF_B64_RE = /^__PDF_BASE64__([\s\S]+)__END_PDF_BASE64__$/

function isPdfBase64(s: string) {
  return PDF_B64_RE.test(s.trim())
}

function extractBase64(s: string) {
  return s.trim().match(PDF_B64_RE)?.[1] ?? ''
}

// Build a message part: plain text or inline PDF file for GPT-4o vision
function contentPart(label: string, value: string): OpenAI.Chat.ChatCompletionContentPart[] {
  if (isPdfBase64(value)) {
    return [
      { type: 'text', text: `${label}:` } as OpenAI.Chat.ChatCompletionContentPart,
      {
        type: 'file',
        file: {
          filename: `${label.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          file_data: `data:application/pdf;base64,${extractBase64(value)}`,
        },
      } as unknown as OpenAI.Chat.ChatCompletionContentPart,
    ]
  }
  return [{ type: 'text', text: `${label}:\n${value}` }]
}

export async function gradeStudentPaper(params: {
  questionPaper: string
  sampleAnswer: string
  studentScript: string
  studentName: string
  studentId?: string
  difficultyMode: DifficultyMode
  customPromptOverride?: string
  retries?: number
}): Promise<AIGradingResponse> {
  const {
    questionPaper, sampleAnswer, studentScript,
    studentName, studentId, difficultyMode, customPromptOverride,
    retries = 3,
  } = params

  const systemPrompt = buildGradingPrompt(difficultyMode, customPromptOverride)

  const hasVision = [questionPaper, sampleAnswer, studentScript].some(isPdfBase64)

  // Build user message content
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = hasVision
    ? [
        { type: 'text', text: `Student: ${studentName}${studentId ? ` (ID: ${studentId})` : ''}` },
        ...contentPart('QUESTION PAPER', questionPaper),
        ...contentPart('SAMPLE ANSWER / MARKING RUBRIC', sampleAnswer),
        ...contentPart('STUDENT SUBMISSION', studentScript),
      ]
    : [
        {
          type: 'text',
          text: [
            `Student: ${studentName}${studentId ? ` (ID: ${studentId})` : ''}`,
            `\nQUESTION PAPER:\n${questionPaper}`,
            `\nSAMPLE ANSWER / MARKING RUBRIC:\n${sampleAnswer}`,
            `\nSTUDENT SUBMISSION:\n${studentScript}`,
          ].join('\n'),
        },
      ]

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: hasVision ? userContent : (userContent[0] as OpenAI.Chat.ChatCompletionContentPartText).text },
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

import Anthropic from '@anthropic-ai/sdk'
import { AIGradingResponse, DifficultyMode } from '@/types'
import { buildGradingPrompt, buildGradingUserMessage } from './prompts'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
    questionPaper,
    sampleAnswer,
    studentScript,
    studentName,
    studentId,
    difficultyMode,
    customPromptOverride,
    retries = 3,
  } = params

  const systemPrompt = buildGradingPrompt(difficultyMode, customPromptOverride)
  const userMessage = buildGradingUserMessage(
    questionPaper,
    sampleAnswer,
    studentScript,
    studentName,
    studentId
  )

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const content = message.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      const rawText = content.text.trim()
      // Strip markdown code blocks if present
      const jsonText = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      const result = JSON.parse(jsonText) as AIGradingResponse

      // Validate required fields
      if (
        typeof result.total_score !== 'number' ||
        typeof result.max_score !== 'number' ||
        !Array.isArray(result.question_wise_breakdown)
      ) {
        throw new Error('Invalid grading response structure from Claude')
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Grading attempt ${attempt} failed:`, lastError.message)

      if (attempt < retries) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
  }

  throw lastError || new Error('All grading attempts failed')
}

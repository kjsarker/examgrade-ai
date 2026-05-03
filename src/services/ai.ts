import OpenAI from 'openai'
import { AIGradingResponse, DifficultyMode } from '@/types'
import { buildGradingPrompt, buildGradingUserMessage } from './prompts'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY!,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  })
  return _client
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
  const userMessage = buildGradingUserMessage(questionPaper, sampleAnswer, studentScript, studentName, studentId)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: 'minimaxai/minimax-m2.7',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 8192,
      })

      const text = response.choices[0]?.message?.content || ''
      // Extract JSON from the response (model may wrap it in markdown)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/)
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text
      const result = JSON.parse(jsonText) as AIGradingResponse

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

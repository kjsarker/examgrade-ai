import { AIGradingResponse, DifficultyMode } from '@/types'
import { buildGradingPrompt, buildGradingUserMessage } from './prompts'

export type AIProvider = 'openai' | 'anthropic' | 'gemini'

export const AI_PROVIDERS: Record<AIProvider, { name: string; models: string[]; defaultModel: string }> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    name: 'Anthropic Claude',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-opus-4-5',
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-1.5-pro',
  },
}

async function gradeWithOpenAI(params: GradeParams): Promise<AIGradingResponse> {
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const systemPrompt = buildGradingPrompt(params.difficultyMode, params.customPromptOverride)
  const userMessage = buildGradingUserMessage(
    params.questionPaper, params.sampleAnswer,
    params.studentScript, params.studentName, params.studentId
  )

  const response = await client.chat.completions.create({
    model: params.model || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  })

  const text = response.choices[0]?.message?.content || ''
  return JSON.parse(text) as AIGradingResponse
}

async function gradeWithAnthropic(params: GradeParams): Promise<AIGradingResponse> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = buildGradingPrompt(params.difficultyMode, params.customPromptOverride)
  const userMessage = buildGradingUserMessage(
    params.questionPaper, params.sampleAnswer,
    params.studentScript, params.studentName, params.studentId
  )

  const message = await client.messages.create({
    model: params.model || 'claude-opus-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type')
  const raw = content.text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(raw) as AIGradingResponse
}

async function gradeWithGemini(params: GradeParams): Promise<AIGradingResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

  const modelName = params.model || 'gemini-1.5-pro'
  const model = genAI.getGenerativeModel({ model: modelName })

  const systemPrompt = buildGradingPrompt(params.difficultyMode, params.customPromptOverride)
  const userMessage = buildGradingUserMessage(
    params.questionPaper, params.sampleAnswer,
    params.studentScript, params.studentName, params.studentId
  )

  const result = await model.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 },
  })

  const text = result.response.text()
  return JSON.parse(text) as AIGradingResponse
}

interface GradeParams {
  questionPaper: string
  sampleAnswer: string
  studentScript: string
  studentName: string
  studentId?: string
  difficultyMode: DifficultyMode
  customPromptOverride?: string
  provider?: AIProvider
  model?: string
  retries?: number
}

export async function gradeStudentPaper(params: GradeParams): Promise<AIGradingResponse> {
  const provider = params.provider || getDefaultProvider()
  const retries = params.retries ?? 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let result: AIGradingResponse

      if (provider === 'openai') {
        result = await gradeWithOpenAI(params)
      } else if (provider === 'anthropic') {
        result = await gradeWithAnthropic(params)
      } else if (provider === 'gemini') {
        result = await gradeWithGemini(params)
      } else {
        throw new Error(`Unknown provider: ${provider}`)
      }

      if (typeof result.total_score !== 'number' || typeof result.max_score !== 'number' || !Array.isArray(result.question_wise_breakdown)) {
        throw new Error('Invalid grading response structure from AI')
      }

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[${provider}] Grading attempt ${attempt} failed:`, lastError.message)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }

  throw lastError || new Error('All grading attempts failed')
}

function getDefaultProvider(): AIProvider {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'placeholder') return 'openai'
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder-anthropic-key') return 'anthropic'
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder') return 'gemini'
  return 'openai'
}

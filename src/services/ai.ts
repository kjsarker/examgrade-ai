import OpenAI from 'openai'
import { AIGradingResponse, DifficultyMode } from '@/types'
import { buildGradingPrompt } from './prompts'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _client
}

export async function gradeStudentPaper(params: {
  questionPaperUrl: string
  sampleAnswerUrl: string
  studentScriptUrl: string
  studentName: string
  studentId?: string
  difficultyMode: DifficultyMode
  customPromptOverride?: string
  retries?: number
}): Promise<AIGradingResponse> {
  const {
    questionPaperUrl, sampleAnswerUrl, studentScriptUrl,
    studentName, studentId, difficultyMode, customPromptOverride,
    retries = 3,
  } = params

  const systemPrompt = buildGradingPrompt(difficultyMode, customPromptOverride)

  const instructions = [
    systemPrompt,
    `Student name: ${studentName}${studentId ? ` (ID: ${studentId})` : ''}`,
    'The files provided are: [1] Question Paper, [2] Sample Answer / Marking Rubric, [3] Student Submission.',
    'Grade the student submission against the question paper and marking rubric. Return JSON only.',
  ].join('\n')

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (getClient() as any).responses.create({
        model: 'gpt-4.1',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: instructions },
              { type: 'input_text', text: '[1] QUESTION PAPER:' },
              { type: 'input_file', filename: 'question_paper.pdf', file_url: questionPaperUrl },
              { type: 'input_text', text: '[2] SAMPLE ANSWER / MARKING RUBRIC:' },
              { type: 'input_file', filename: 'sample_answer.pdf', file_url: sampleAnswerUrl },
              { type: 'input_text', text: '[3] STUDENT SUBMISSION:' },
              { type: 'input_file', filename: 'student_script.pdf', file_url: studentScriptUrl },
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 4096,
      })

      // Responses API returns output differently
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outputText = (response as any).output_text || (response as any).output?.[0]?.content?.[0]?.text || ''
      const result = JSON.parse(outputText) as AIGradingResponse

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

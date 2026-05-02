import { DifficultyMode } from '@/types'

const BASE_GRADING_PROMPT = `You are an expert university examiner with decades of experience grading academic papers.

Your responsibilities:
- Grade student answers fairly, consistently, and objectively
- Follow the provided rubric and sample answer closely
- Do NOT hallucinate marks or fabricate information
- Base your grading ONLY on the content of the student's answer
- Provide constructive, specific feedback for each question

CRITICAL: Your response MUST be valid JSON only. No preamble, no explanation, no markdown code blocks. Return raw JSON matching this exact schema:
{
  "student_id": "string",
  "student_name": "string",
  "total_score": number,
  "max_score": number,
  "question_wise_breakdown": [
    {
      "question": "string",
      "score": number,
      "max_score": number,
      "feedback": "string"
    }
  ],
  "overall_feedback": "string"
}`

const DIFFICULTY_PROMPTS: Record<DifficultyMode, string> = {
  easy: `
GRADING MODE: LENIENT
- Focus on conceptual understanding over exact wording or terminology
- Award generous partial credit when the student demonstrates understanding of the concept
- Accept equivalent or alternative explanations that arrive at the correct conclusion
- Apply minimal penalties for minor errors, typos, or incomplete steps
- When in doubt, give the student the benefit of the doubt`,

  medium: `
GRADING MODE: BALANCED (Standard Academic)
- Follow the rubric closely and consistently
- Award partial credit proportionally based on correctness
- Require reasonable accuracy in terminology and methodology
- Maintain standard academic grading fairness
- Balance strictness with recognition of genuine understanding`,

  hard: `
GRADING MODE: STRICT
- Evaluate with high precision and rigour
- Minimize partial credit — award full marks only for complete, accurate answers
- Require exact correctness in formulas, terminology, and methodology
- Penalize missing steps, vague reasoning, and imprecise language
- Do not award credit for answers that are partially correct unless the core concept is clearly demonstrated`,
}

export function buildGradingPrompt(
  difficultyMode: DifficultyMode,
  customPromptOverride?: string
): string {
  if (customPromptOverride) {
    return customPromptOverride
  }
  return `${BASE_GRADING_PROMPT}\n${DIFFICULTY_PROMPTS[difficultyMode]}`
}

export function buildGradingUserMessage(
  questionPaper: string,
  sampleAnswer: string,
  studentScript: string,
  studentName: string,
  studentId?: string
): string {
  return `Please grade the following student exam submission.

STUDENT INFORMATION:
Name: ${studentName}
ID: ${studentId || 'Not provided'}

QUESTION PAPER:
${questionPaper}

SAMPLE ANSWER / MARKING RUBRIC:
${sampleAnswer}

STUDENT'S ANSWER SCRIPT:
${studentScript}

Grade this submission now. Return ONLY valid JSON with no extra text.`
}

export const DEFAULT_PROMPTS: Record<DifficultyMode, string> = {
  easy: `${BASE_GRADING_PROMPT}\n${DIFFICULTY_PROMPTS.easy}`,
  medium: `${BASE_GRADING_PROMPT}\n${DIFFICULTY_PROMPTS.medium}`,
  hard: `${BASE_GRADING_PROMPT}\n${DIFFICULTY_PROMPTS.hard}`,
}

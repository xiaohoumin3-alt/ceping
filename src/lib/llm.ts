// LLM 动态解读：调用 CloudBase 云函数（混元大模型），基于用户具体答案生成个性化文案
// 硬编码模板仅作为 LLM 失败时的兜底（v2 JSON 中的静态文案）
import quizData from '../quiz.json'
import { supabase } from './supabase'

const LLM_ENDPOINT = 'https://cloud1-d4gw10duaac5d8b50-1466205870.ap-shanghai.app.tcloudbase.com/llm-interpret'

export interface LLMResult {
  profile: string; strengths: string; blindSpots: string; advice: string; quote: string
  generated: boolean
}

export async function generateInterpretation(
  answers: string[],
  dims: { order: number; insight: number; boundary: number },
  resultKey: string, resultName: string, resultPerson: string, fateLine: string, nearTie: boolean,
): Promise<LLMResult> {
  // 静态兜底
  const fallback = quizData.results.find(r => r.key === resultKey)
  const fb: LLMResult = fallback
    ? { profile: fallback.profile, strengths: fallback.strengths, blindSpots: fallback.blindSpots, advice: fallback.advice, quote: fallback.quote, generated: false }
    : { profile: '', strengths: '', blindSpots: '', advice: '', quote: '', generated: false }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 60000)
    const res = await fetch(LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers,
        dims,
        resultKey, resultName, resultPerson, fateLine, nearTie,
        questions: quizData.questions,
      }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return fb
    const data = await res.json() as Partial<LLMResult> & { error?: string }
    if (data.error || !data.profile) return fb
    return {
      profile: data.profile!, strengths: data.strengths ?? fb.strengths,
      blindSpots: data.blindSpots ?? fb.blindSpots, advice: data.advice ?? fb.advice,
      quote: data.quote ?? fb.quote, generated: true,
    }
  } catch {
    return fb
  }
}

// 保留 supabase 引用避免 tree-shake 抱怨（answers 记录仍在 App 中写）
void supabase

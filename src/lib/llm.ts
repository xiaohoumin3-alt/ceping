// LLM 全动态测评：人物原型+全部文案由大模型推理生成（无固定池）
// 结果页在 LLM 返回前显示"推衍中"仪式动画，失败允许重试
import quizData from '../quiz.json'

const LLM_ENDPOINT = 'https://cloud1-d4gw10duaac5d8b50-1466205870.ap-shanghai.app.tcloudbase.com/llm-interpret'

export interface LLMResult {
  person: string; title: string; fateLine: string
  profile: string; strengths: string; blindSpots: string; advice: string; quote: string
  dims?: { order: number; insight: number; boundary: number }
  generated: boolean
}

export async function generateResult(answers: string[]): Promise<LLMResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 90000)
  try {
    const res = await fetch(LLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers,
        questions: quizData.questions.map(q => ({ text: q.text, options: q.options.map(o => ({ k: o.k, t: o.t })) })),
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as Partial<LLMResult> & { error?: string }
    if (data.error || !data.person || !data.profile) throw new Error(data.error ?? 'incomplete')
    return {
      person: data.person, title: data.title ?? '命运原型', fateLine: data.fateLine ?? '',
      profile: data.profile!, strengths: data.strengths ?? '', blindSpots: data.blindSpots ?? '',
      advice: data.advice ?? '', quote: data.quote ?? '', dims: data.dims, generated: true,
    }
  } finally {
    clearTimeout(timer)
  }
}

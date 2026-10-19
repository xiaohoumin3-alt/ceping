// 测评全流程 LLM 化：题目动态生成 + 人物/文案动态推理（无任何硬编码题库/结果池）
const LLM_ENDPOINT = 'https://cloud1-d4gw10duaac5d8b50-1466205870.ap-shanghai.app.tcloudbase.com/llm-interpret'

export interface DynQuestion { text: string; options: { k: string; t: string }[] }
export interface LLMResult {
  person: string; title: string; fateLine: string
  profile: string; strengths: string; blindSpots: string; advice: string; quote: string
  dims?: { order: number; insight: number; boundary: number }
  generated: boolean
}

async function post(body: unknown, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(LLM_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally { clearTimeout(timer) }
}

/** 动态生成 15 道题（云函数内部带重试；此处再兜底重试一次） */
export async function generateQuiz(): Promise<DynQuestion[]> {
  for (let i = 0; i < 2; i++) {
    const d = await post({ action: 'generate_quiz' }, 120000)
    if (Array.isArray(d.questions) && d.questions.length === 15) {
      // 规整：确保 4 选项且 k 为 A-D
      return d.questions.map((q: DynQuestion) => ({
        text: String(q.text ?? ''),
        options: (q.options ?? []).slice(0, 4).map((o: { k: string; t: string }, j: number) => ({
          k: 'ABCD'[j] ?? o.k, t: String(o.t ?? ''),
        })),
      }))
    }
  }
  throw new Error('quiz generation failed')
}

/** 基于用户对动态题的选择，LLM 推理人物原型+全文案 */
export async function generateResult(answers: string[], questions: DynQuestion[]): Promise<LLMResult> {
  const d = await post({ answers, questions }, 120000)
  if (d.error || !d.person || !d.profile) throw new Error(d.error ?? 'incomplete')
  return {
    person: d.person, title: d.title ?? '命运原型', fateLine: d.fateLine ?? '',
    profile: d.profile, strengths: d.strengths ?? '', blindSpots: d.blindSpots ?? '',
    advice: d.advice ?? '', quote: d.quote ?? '', dims: d.dims, generated: true,
  }
}

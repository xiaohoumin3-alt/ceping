// 评分引擎：与 02-g2-content/score.py 保持同一契约（R2 冻结）
// nearTie = 平方距离差 < 0.02；等距按 results 数组固定次序；容差 1e-9
import quizData from '../quiz.json'

export interface Option { k: 'A' | 'B' | 'C' | 'D'; t: string; score: number }
export interface Question { id: number; dim: 'order' | 'insight' | 'boundary'; text: string; options: Option[] }
export interface QuizResult {
  key: string; name: string; person: string; fateLine: string
  profile: string; strengths: string; blindSpots: string
  advice: string; quote: string; shareTitle: string
}
export const QUIZ = quizData
export const QUESTIONS = quizData.questions as unknown as Question[]

interface Scored { order: number; insight: number; boundary: number }

export function computeScores(answers: string[]): Scored {
  const sc: Scored = { order: 0, insight: 0, boundary: 0 }
  answers.forEach((a, i) => {
    const opt = QUESTIONS[i].options.find(o => o.k === a)
    if (opt) sc[QUESTIONS[i].dim] += opt.score
  })
  return sc
}

export function decide(sc: Scored): { result: QuizResult; nearTie: boolean } {
  const centers = quizData.resultMapping.centers as Record<string, { center: number[] }>
  const x = [sc.order / 15, sc.insight / 15, sc.boundary / 15]
  const dists = Object.fromEntries(
    Object.entries(centers).map(([k, v]) => [k, v.center.reduce((s, p, i) => s + (x[i] - p) ** 2, 0)])
  )
  const orderRank = Object.fromEntries(quizData.results.map((r: QuizResult, i: number) => [r.key, i]))
  const bestKey = Object.keys(dists).reduce((a, b) => {
    const da = Math.round(dists[a] * 1e9) / 1e9
    const db = Math.round(dists[b] * 1e9) / 1e9
    if (da !== db) return da < db ? a : b
    return orderRank[a] < orderRank[b] ? a : b
  })
  const sorted = Object.values(dists).sort((a, b) => a - b)
  const nearTie = sorted[1] - sorted[0] < 0.02
  const result = quizData.results.find(r => r.key === bestKey) as QuizResult
  return { result, nearTie }
}

export function evaluate(answers: string[]) {
  return decide(computeScores(answers))
}

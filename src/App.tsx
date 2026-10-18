import { useState } from 'react'
import './App.css'
import { QUESTIONS, QUIZ, evaluate, computeScores } from './lib/quiz'
import type { QuizResult } from './lib/quiz'
import { supabase } from './lib/supabase'
import { drawPoster, savePoster } from './lib/poster'

type Stage = 'gate' | 'quiz' | 'result'

export default function App() {
  const [stage, setStage] = useState<Stage>('gate')
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(''))
  const [result, setResult] = useState<QuizResult | null>(null)
  const [nearTie, setNearTie] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // 密码核验（服务端原子扣次数）
  async function handleEnter() {
    const c = code.trim().toLowerCase()
    if (!c) return
    setBusy(true); setCodeErr('')
    const { data, error } = await supabase.rpc('verify_and_consume', { p_code: c })
    setBusy(false)
    if (error) { setCodeErr('网络异常，请重试'); return }
    if (data === -1) { setCodeErr('密码无效，请检查后重试'); return }
    if (data === 0) { setCodeErr('该密码的测试次数已用完'); return }
    setCode(c)
    setStage('quiz')
  }

  function choose(k: string) {
    const next = [...answers]; next[idx] = k
    setAnswers(next)
    if (idx < QUESTIONS.length - 1) setTimeout(() => setIdx(idx + 1), 150)
  }

  async function finish() {
    setBusy(true)
    const { result, nearTie } = evaluate(answers)
    setResult(result); setNearTie(nearTie)
    // 记录答题（失败不阻断结果展示）
    try {
      await supabase.from('answers').insert({ code, answers: answers.join(''), result_key: result.key })
    } catch { /* 静默 */ }
    setBusy(false)
    setStage('result')
  }

  async function handleSave() {
    if (!result) return
    const sc = computeScores(answers)
    const blob = await drawPoster(result, { order: sc.order, insight: sc.insight, boundary: sc.boundary }, nearTie)
    const how = await savePoster(blob)
    if (how === 'downloaded') alert('已开始下载。手机端若未直接进相册，请长按图片或到浏览器下载目录保存。')
  }

  async function handleCopyLink() {
    const url = `${location.origin}${location.pathname}#result=${result?.key ?? ''}`
    try { await navigator.clipboard.writeText(url) } catch { /* 降级 */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function restart() {
    setAnswers(Array(QUESTIONS.length).fill('')); setIdx(0)
    setResult(null); setStage('quiz')
  }

  if (stage === 'gate') {
    return (
      <div className="gate">
        <h1 className="title">{QUIZ.meta.title}</h1>
        <p className="subtitle">{QUIZ.meta.subtitle}</p>
        <input
          className="code-input" type="text" placeholder="请输入测评密码"
          value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
        />
        {codeErr && <p className="err">{codeErr}</p>}
        <button className="btn primary" disabled={busy} onClick={handleEnter}>
          {busy ? '验证中…' : '开始测评'}
        </button>
        <p className="fine">每个密码可使用 3 次 · {QUIZ.meta.questionCount} 道题 · 约 3 分钟</p>
        <p className="fine">{QUIZ.meta.disclaimer}</p>
      </div>
    )
  }

  if (stage === 'quiz') {
    const q = QUESTIONS[idx]
    const answered = answers.filter(Boolean).length
    return (
      <div className="quiz">
        <div className="progress"><div style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} /></div>
        <p className="qnum">{idx + 1} / {QUESTIONS.length}</p>
        <h2 className="qtext">{q.text}</h2>
        <div className="options">
          {q.options.map(o => (
            <button
              key={o.k}
              className={`option ${answers[idx] === o.k ? 'selected' : ''}`}
              onClick={() => choose(o.k)}
            >{o.k}. {o.t}</button>
          ))}
        </div>
        <div className="quiz-nav">
          <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>上一题</button>
          {idx === QUESTIONS.length - 1
            ? <button className="btn primary" disabled={answers.some(a => !a) || busy} onClick={finish}>
                {busy ? '生成中…' : '查看结果'}
              </button>
            : <button className="btn primary" disabled={!answers[idx]} onClick={() => setIdx(idx + 1)}>下一题</button>}
        </div>
      </div>
    )
  }

  // result
  const r = result!
  return (
    <div className="result">
      <p className="r-person">{r.person}</p>
      <h1 className="r-name">{r.name}</h1>
      <p className="r-fate">{r.fateLine}</p>
      <div className="r-block"><h3>你是谁</h3><p>{r.profile}</p></div>
      <div className="r-block"><h3>你的天赋</h3><p>{r.strengths}</p></div>
      <div className="r-block"><h3>你的盲区</h3><p>{r.blindSpots}</p></div>
      <div className="r-block"><h3>给你的话</h3><p>{r.advice}</p></div>
      {nearTie && <p className="r-mixed">※ 混合型倾向：你的画像接近两种原型的交界</p>}
      <div className="r-actions">
        <button className="btn primary" onClick={handleSave}>保存结果海报</button>
        <button className="btn" onClick={handleCopyLink}>{copied ? '已复制 ✓' : '复制结果链接'}</button>
        <button className="btn" onClick={restart}>再测一次</button>
      </div>
      <div className="praise">
        <p>🎉 好评有礼：给店铺留下好评后，联系客服发送好评截图，即可获得 1 元返现！</p>
      </div>
      <p className="fine">{QUIZ.meta.disclaimer}</p>
    </div>
  )
}

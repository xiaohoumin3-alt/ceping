import { useState } from 'react'
import './App.css'
import { QUESTIONS, QUIZ, evaluate, computeScores } from './lib/quiz'
import type { QuizResult } from './lib/quiz'
import { supabase } from './lib/supabase'
import { drawPoster, savePoster } from './lib/poster'

type Stage = 'gate' | 'quiz' | 'result'

const DIM_NAMES: Record<string, string> = {
  order: '秩序抱负', insight: '局势洞察', boundary: '进退取舍',
}

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

  async function handleEnter() {
    const c = code.trim()
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
        <p className="gate-eyebrow">命 书 一 卷 · 照 见 古 今</p>
        <h1 className="gate-title">古人<em>命运</em>镜像测试</h1>
        <p className="gate-sub">十五问，照出你是哪位历史人物的命运原型</p>
        <p className="gate-ornament">❖ ❖ ❖</p>
        <div className="gate-form">
          <input
            className="code-input" type="text" placeholder="请输入测评密码"
            value={code} onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEnter()}
          />
          {codeErr && <p className="err">{codeErr}</p>}
          <button className="btn primary" style={{ marginTop: 22 }} disabled={busy || !code.trim()} onClick={handleEnter}>
            {busy ? '推 衍 中 …' : '启 卷'}
          </button>
        </div>
        <div className="gate-meta">
          <span>一码三用</span><span>十五问</span><span>约三分钟</span>
        </div>
        <p className="fine">{QUIZ.meta.disclaimer}</p>
        <div className="gate-seal">命理自鉴</div>
      </div>
    )
  }

  if (stage === 'quiz') {
    const q = QUESTIONS[idx]
    const answered = answers.filter(Boolean).length
    return (
      <div className="quiz">
        <div className="quiz-head">
          <p className="quiz-count"><b>{String(idx + 1).padStart(2, '0')}</b> ／ {QUESTIONS.length}</p>
          <span className="quiz-dimtag">{DIM_NAMES[q.dim]}</span>
        </div>
        <div className="progress"><div style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} /></div>
        <h2 className="qtext">{q.text}</h2>
        <div className="options">
          {q.options.map(o => (
            <button
              key={o.k}
              className={`option ${answers[idx] === o.k ? 'selected' : ''}`}
              onClick={() => choose(o.k)}
            ><span className="k">{o.k}</span>{o.t}</button>
          ))}
        </div>
        <div className="quiz-nav">
          <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>上一题</button>
          {idx === QUESTIONS.length - 1
            ? <button className="btn primary" disabled={answers.some(a => !a) || busy} onClick={finish}>
                {busy ? '推 衍 中 …' : '揭 晓'}
              </button>
            : <button className="btn primary" disabled={!answers[idx]} onClick={() => setIdx(idx + 1)}>下一题</button>}
        </div>
      </div>
    )
  }

  const r = result!
  const sc = computeScores(answers)
  return (
    <div className="result">
      <p className="r-eyebrow">镜 中 人 已 现</p>
      <div className="r-person-wrap">
        <h1 className="r-person">{r.person}</h1>
        <span className="r-seal">命运印证</span>
      </div>
      <p className="r-name">{r.name.split('·')[1]?.trim()}</p>
      <div className="gold-rule" />
      <p className="r-fate">{r.fateLine}</p>

      <div className="r-dims">
        <div className="r-dim"><p className="v">{sc.order}<small> /15</small></p><p className="n">秩序抱负</p></div>
        <div className="r-dim"><p className="v">{sc.insight}<small> /15</small></p><p className="n">局势洞察</p></div>
        <div className="r-dim"><p className="v">{sc.boundary}<small> /15</small></p><p className="n">进退取舍</p></div>
      </div>

      <div className="r-block"><h3>镜 中 人</h3><p>{r.profile}</p></div>
      <div className="r-block"><h3>天 赋</h3><p>{r.strengths}</p></div>
      <div className="r-block"><h3>盲 区</h3><p>{r.blindSpots}</p></div>
      <div className="r-block"><h3>赠 言</h3><p>{r.advice}</p></div>

      <p className="r-quote">{r.quote}</p>
      {nearTie && <p className="r-mixed">※ 混合型倾向：你的画像接近两种原型的交界</p>}

      <div className="r-actions">
        <button className="btn primary" onClick={handleSave}>收 藏 命 书</button>
        <button className="btn" onClick={handleCopyLink}>{copied ? '已 复 制 ✓' : '分 享 镜 像'}</button>
        <button className="btn" onClick={restart}>再 照 一 次</button>
      </div>
      <div className="praise">
        给店铺留下好评后，联系客服发送好评截图，即可获得 1 元返现。感谢你与镜中人的相遇。
      </div>
      <p className="fine">{QUIZ.meta.disclaimer}</p>
    </div>
  )
}

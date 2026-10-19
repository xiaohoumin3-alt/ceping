import { useState } from 'react'
import './App.css'
import { QUIZ } from './lib/quiz'
import { supabase } from './lib/supabase'
import { drawPoster, savePoster } from './lib/poster'
import { generateQuiz, generateResult } from './lib/llm'
import type { DynQuestion, LLMResult } from './lib/llm'
import { drawRadar, MatchBars, Timeline, VersusCard } from './components/viz'
import { useEffect, useRef } from 'react'

type Stage = 'gate' | 'loading-quiz' | 'quiz' | 'divining' | 'result'

const DIM_TAGS = ['世事', '人心', '取舍', '进退', '局中', '变局', '抉择', '人情', '自我', '时机', '分寸', '困局', '锋芒', '退路', '终局']

export default function App() {
  const [stage, setStage] = useState<Stage>('gate')
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [questions, setQuestions] = useState<DynQuestion[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [llm, setLlm] = useState<LLMResult | null>(null)
  const [llmErr, setLlmErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const radarRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (llm?.dims && radarRef.current) drawRadar(radarRef.current, llm.dims)
  }, [llm, stage])

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
    startQuiz()
  }

  async function startQuiz() {
    setStage('loading-quiz'); setLlmErr('')
    try {
      const qs = await generateQuiz()
      setQuestions(qs)
      setAnswers(Array(qs.length).fill(''))
      setIdx(0)
      setStage('quiz')
    } catch {
      setLlmErr('出题受阻，请再试一次。')
      setStage('result') // 复用错误视图
    }
  }

  function choose(k: string) {
    const next = [...answers]; next[idx] = k
    setAnswers(next)
    if (idx < (questions?.length ?? 15) - 1) setTimeout(() => setIdx(idx + 1), 150)
  }

  async function finish() {
    if (!questions) return
    setStage('divining')
    setLlm(null)
    try {
      const r = await generateResult(answers, questions)
      setLlm(r)
      setStage('result')
    } catch (e) {
      setLlmErr(String((e as Error).message ?? e) + '（推衍受阻，可重试）')
      setStage('result')
    }
    try {
      await supabase.from('answers').insert({ code, answers: answers.join(''), result_key: 'llm:' + answers.join('') })
    } catch { /* 静默 */ }
  }

  async function handleSave() {
    if (!llm) return
    const blob = await drawPoster(
      {
        key: 'llm', name: llm.title, person: llm.person, fateLine: llm.fateLine,
        profile: llm.profile, strengths: llm.strengths, blindSpots: llm.blindSpots,
        advice: llm.advice, quote: llm.quote, shareTitle: llm.title,
      },
      llm.dims ?? { order: 0, insight: 0, boundary: 0 }, false,
    )
    const how = await savePoster(blob)
    if (how === 'downloaded') alert('已开始下载。手机端若未直接进相册，请长按图片或到浏览器下载目录保存。')
  }

  async function handleCopyLink() {
    try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}`) } catch { /* 降级 */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function restart() {
    setQuestions(null); setAnswers([]); setIdx(0)
    setLlm(null); setLlmErr(''); setStage('quiz')
    startQuiz()
  }

  async function retryLlm() {
    if (!llm && llmErr.includes('推衍')) { setStage('divining'); return finish() }
    startQuiz()
  }

  if (stage === 'gate') {
    return (
      <div className="gate">
        <p className="gate-eyebrow">命 书 一 卷 · 照 见 古 今</p>
        <h1 className="gate-title">三国<em>命运</em>镜像测试</h1>
        <p className="gate-sub">十五问，照出你是三国里的哪位人物</p>
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
          <span>一码三用</span><span>十五问</span><span>每卷皆新</span>
        </div>
        <p className="fine">{QUIZ.meta.disclaimer}</p>
        <div className="gate-seal">命理自鉴</div>
      </div>
    )
  }

  if (stage === 'loading-quiz') {
    return (
      <div className="divining">
        <p className="gate-eyebrow">研 墨 起 卷</p>
        <div className="divining-orb"><span>出</span><span>题</span><span>中</span></div>
        <p className="divining-text">正在为你拟一套全新的三国十五问……</p>
        <p className="fine">大模型命题 · 每次测评的题目都不相同 · 约需十余秒</p>
      </div>
    )
  }

  if (stage === 'quiz' && questions) {
    const q = questions[idx]
    const answered = answers.filter(Boolean).length
    return (
      <div className="quiz">
        <div className="quiz-head">
          <p className="quiz-count"><b>{String(idx + 1).padStart(2, '0')}</b> ／ {questions.length}</p>
          <span className="quiz-dimtag">{DIM_TAGS[idx % DIM_TAGS.length]}</span>
        </div>
        <div className="progress"><div style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
        <h2 className="qtext">{q.text}</h2>
        <div className="options">
          {q.options.map((o, j) => (
            <button
              key={j}
              className={`option ${answers[idx] === o.k ? 'selected' : ''}`}
              onClick={() => choose(o.k)}
            ><span className="k">{o.k}</span>{o.t}</button>
          ))}
        </div>
        <div className="quiz-nav">
          <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>上一题</button>
          {idx === questions.length - 1
            ? <button className="btn primary" disabled={answers.some(a => !a) || busy} onClick={finish}>揭 晓</button>
            : <button className="btn primary" disabled={!answers[idx]} onClick={() => setIdx(idx + 1)}>下一题</button>}
        </div>
      </div>
    )
  }

  if (stage === 'divining') {
    return (
      <div className="divining">
        <p className="gate-eyebrow">焚 香 推 衍</p>
        <div className="divining-orb"><span>推</span><span>衍</span><span>中</span></div>
        <p className="divining-text">命盘已成，镜中人正在浮现……</p>
        <p className="fine">大模型正在通读你的十五个选择，为你推演命运原型 · 约需十余秒</p>
      </div>
    )
  }

  if (llmErr) {
    return (
      <div className="result">
        <p className="gate-eyebrow">推 衍 受 阻</p>
        <p className="divining-text" style={{ marginTop: 24 }}>镜中光影涣散，请再试一次。</p>
        <p className="fine">{llmErr}</p>
        <div className="r-actions" style={{ marginTop: 30 }}>
          <button className="btn primary" onClick={retryLlm}>再 次 推 衍</button>
        </div>
      </div>
    )
  }

  const r = llm!
  return (
    <div className="result">
      <p className="r-eyebrow">镜 中 人 已 现</p>
      <div className="r-person-wrap">
        <h1 className="r-person">{r.person}</h1>
        <span className="r-seal">命运印证</span>
      </div>
      <p className="r-name">{r.title}</p>
      <div className="gold-rule" />
      <p className="r-fate">{r.fateLine}</p>

      {r.dims && (
        <div className="radar-wrap">
          <canvas ref={radarRef} width={280} height={230} />
        </div>
      )}

      <div className="r-block"><h3>镜 中 人<span className="llm-hint ok"> · 专属推演</span></h3><p>{r.profile}</p></div>
      <div className="r-block"><h3>天 赋</h3><p>{r.strengths}</p></div>
      <div className="r-block"><h3>盲 区</h3><p>{r.blindSpots}</p></div>
      <div className="r-block"><h3>赠 言</h3><p>{r.advice}</p></div>

      {r.topMatches && r.topMatches.length > 0 && (
        <div className="r-block viz-block">
          <h3>群 像 相 似 度</h3>
          <MatchBars matches={r.topMatches} me={r.person} />
        </div>
      )}

      {r.timeline && r.timeline.length > 0 && (
        <div className="r-block viz-block">
          <h3>他 的 人 生 三 幕</h3>
          <Timeline items={r.timeline} />
        </div>
      )}

      {r.versus && (
        <div className="r-block viz-block">
          <h3>千 古 对 照</h3>
          <VersusCard v={r.versus} me={r.person} />
        </div>
      )}

      <p className="r-quote">{r.quote}</p>

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

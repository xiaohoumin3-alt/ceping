import { useState, useEffect, useRef } from 'react'
import { createOrder, pollUnlock } from '../lib/pay'
import { drawQR } from '../lib/qrlite'
import { supabase } from '../lib/supabase'
import type { Lang } from '../lib/i18n'

interface Props {
  onPaid: () => void
  lang: Lang
  answerId: number | null
}

/** 付费墙：中文=¥9.9 微信扫码；英文=launch waitlist（邮件收集） */
export default function Paywall({ onPaid, lang, answerId }: Props) {
  const [phase, setPhase] = useState<'idle' | 'creating' | 'qrcode' | 'error' | 'joined'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [email, setEmail] = useState('')
  const qrRef = useRef<HTMLCanvasElement>(null)
  const stopPoll = useRef<(() => void) | null>(null)

  useEffect(() => () => stopPoll.current?.(), [])

  async function startPay() {
    setPhase('creating'); setErrMsg('')
    try {
      if (!answerId) throw new Error('missing answer')
      const r = await createOrder(answerId, 990)
      if (r.error || !r.code_url) throw new Error(r.error ?? '下单失败')
      setPhase('qrcode')
      requestAnimationFrame(() => {
        if (qrRef.current) drawQR(qrRef.current, r.code_url!, 260)
      })
      stopPoll.current = pollUnlock(r.out_trade_no!, () => onPaid(), m => {
        setPhase('error'); setErrMsg(m)
      })
    } catch (e) {
      setPhase('error'); setErrMsg((e as Error).message)
    }
  }

  // ===== 英文：waitlist（暂无海外支付通道）=====
  if (lang === 'en') {
    return (
      <div className="paywall">
        <div className="pw-ornament">❖ THE FULL SCROLL ❖</div>
        <p className="pw-lead">The figure has appeared — but their story, gifts, blind spots and parting counsel remain sealed within the scroll.</p>
        <ul className="pw-list">
          <li>Full narrative reading</li>
          <li>Gifts · Blind spots · Parting counsel</li>
          <li>Kindred matches · Life in three acts · Rival contrast</li>
          <li>Fate poster — save &amp; share</li>
        </ul>
        {phase === 'joined' ? (
          <p className="free-hint">You are on the list ✓ We'll email you the moment it opens.</p>
        ) : (
          <>
            <input
              className="code-input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              style={{ textAlign: 'left' }}
            />
            <button
              className="btn primary pw-btn" style={{ marginTop: 14 }}
              disabled={!email.includes('@')} onClick={joinWaitlist}
            >NOTIFY ME AT LAUNCH</button>
          </>
        )}
        <p className="fine">Launching soon · $2.99 · No spam, one email only</p>
      </div>
    )
  }

  async function joinWaitlist() {
    try {
      await supabase.from('waitlist').insert({ email: email.trim(), source: 'ceping_en' })
      setPhase('joined')
    } catch { setPhase('joined') } // 即使失败也不阻断体验
  }

  // ===== 中文：微信支付 =====
  if (phase === 'idle' || phase === 'creating') {
    return (
      <div className="paywall">
        <div className="pw-ornament">❖ 完 整 命 书 ❖</div>
        <p className="pw-lead">镜中人已现，但他的来历、天赋、盲区与赠言，还封在命书之内。</p>
        <ul className="pw-list">
          <li>镜 中 人 · 专属推演全文</li>
          <li>天 赋 · 盲 区 · 赠 言</li>
          <li>群像相似度 · 人生三幕 · 千古对照</li>
          <li>命书海报 · 可存可分享</li>
        </ul>
        <button className="btn primary pw-btn" disabled={phase === 'creating'} onClick={startPay}>
          {phase === 'creating' ? '启 印 中 …' : '¥9.9 · 开 启 完 整 命 书'}
        </button>
        <p className="fine">微信扫码支付 · 付款后自动揭开 · 非娱乐占卜承诺，仅供自鉴</p>
      </div>
    )
  }

  if (phase === 'qrcode') {
    return (
      <div className="paywall">
        <p className="pw-lead">请用微信扫码 · 付款后本页自动揭开命书</p>
        <canvas ref={qrRef} className="pw-qr" />
        <p className="fine">等待支付中…（约 3 分钟内有效，超时可重试）</p>
      </div>
    )
  }

  return (
    <div className="paywall">
      <p className="err">{errMsg}</p>
      <button className="btn" onClick={startPay}>重 试</button>
    </div>
  )
}

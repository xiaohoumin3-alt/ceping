import { useState, useEffect, useRef } from 'react'
import { createOrder, pollUnlock } from '../lib/pay'
import { drawQR } from '../lib/qrlite'

interface Props {
  onPaid: () => void
}

/** 付费墙：¥9.9 解锁完整命书。流程：点按钮 → 出二维码 → 轮询 → onPaid */
export default function Paywall({ onPaid }: Props) {
  const [phase, setPhase] = useState<'idle' | 'creating' | 'qrcode' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const qrRef = useRef<HTMLCanvasElement>(null)
  const stopPoll = useRef<(() => void) | null>(null)

  useEffect(() => () => stopPoll.current?.(), [])

  async function startPay() {
    setPhase('creating'); setErrMsg('')
    try {
      // answer_id 由父组件在插入 answers 后通过 window.__lastAnswerId 传递
      const answerId = (window as any).__lastAnswerId
      const r = await createOrder(answerId, 990)
      if (r.error || !r.code_url) throw new Error(r.error ?? '下单失败')
      setPhase('qrcode')
      // 等渲染后画码
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

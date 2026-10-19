// 支付 API 客户端：创建订单 / 轮询解锁
const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export interface CreateOrderResp {
  order_id?: string
  out_trade_no?: string
  code_url?: string   // 微信 Native 支付链接（生成二维码）
  amount_fen?: number
  already_paid?: boolean
  error?: string
}

export async function createOrder(answerId: number, amountFen = 990): Promise<CreateOrderResp> {
  const res = await fetch(`${EDGE_BASE}/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer_id: answerId, amount_fen: amountFen }),
  })
  return res.json()
}

export async function checkUnlock(outTradeNo: string): Promise<{ status: string; answer_id?: number }> {
  const res = await fetch(`${EDGE_BASE}/check-unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ out_trade_no: outTradeNo }),
  })
  if (res.status === 404) return { status: 'not_found' }
  return res.json()
}

/** 轮询直到 paid / 超时（3 分钟，2.5s 间隔） */
export function pollUnlock(
  outTradeNo: string,
  onPaid: () => void,
  onFail?: (msg: string) => void,
): () => void {
  const deadline = Date.now() + 3 * 60 * 1000
  let stopped = false
  const tick = async () => {
    while (!stopped && Date.now() < deadline) {
      try {
        const r = await checkUnlock(outTradeNo)
        if (r.status === 'paid') { onPaid(); return }
      } catch { /* 网络抖动继续轮询 */ }
      await new Promise(f => setTimeout(f, 2500))
    }
    if (!stopped && onFail) onFail('等待支付超时，如已付款请刷新页面重试')
  }
  tick()
  return () => { stopped = true }
}

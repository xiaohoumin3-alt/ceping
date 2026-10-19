// 结果页可视化组件：雷达图 / 相似度条 / 人生时间轴 / 对照卡 —— Canvas+CSS 实现

/** 五维雷达图（Canvas，玄墨金风格）· 参考 Big Five 五维框架 */
export const DIM_META = [
  { key: 'vision', name: '格局抱负' },
  { key: 'insight', name: '洞察判断' },
  { key: 'grit', name: '坚韧执行' },
  { key: 'warmth', name: '温情义气' },
  { key: 'composure', name: '沉稳定力' },
] as const

export function drawRadar(canvas: HTMLCanvasElement, dims: Record<string, number>) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 30
  ctx.clearRect(0, 0, W, H)

  const labels = DIM_META.map(d => d.name)
  const vals = DIM_META.map(d => Math.min(Math.max(dims[d.key] ?? 0, 0), 15) / 15)
  const N = 5
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N

  // 网格（3 层多边形）
  for (let ring = 1; ring <= 3; ring++) {
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const a = angle(i % N)
      const r = (R * ring) / 3
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(201,169,97,0.22)'; ctx.lineWidth = 1; ctx.stroke()
  }
  // 轴线
  for (let i = 0; i < N; i++) {
    const a = angle(i)
    ctx.beginPath()
    ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a))
    ctx.strokeStyle = 'rgba(201,169,97,0.28)'; ctx.stroke()
  }
  // 数据面
  ctx.beginPath()
  vals.forEach((v, i) => {
    const a = angle(i), r = R * Math.max(v, 0.04)
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.closePath()
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
  grad.addColorStop(0, 'rgba(230,201,138,0.5)'); grad.addColorStop(1, 'rgba(201,169,97,0.18)')
  ctx.fillStyle = grad; ctx.fill()
  ctx.strokeStyle = '#e6c98a'; ctx.lineWidth = 2; ctx.stroke()
  // 顶点
  vals.forEach((v, i) => {
    const a = angle(i), r = R * Math.max(v, 0.04)
    ctx.beginPath()
    ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 3.5, 0, 7)
    ctx.fillStyle = '#f5e6c8'; ctx.fill()
  })
  // 标签+数值
  ctx.font = '12px "Noto Serif SC", serif'; ctx.fillStyle = '#a89f88'
  ctx.textAlign = 'center'
  labels.forEach((lb, i) => {
    const a = angle(i)
    const lx = cx + (R + 20) * Math.cos(a), ly = cy + (R + 20) * Math.sin(a)
    ctx.fillText(lb, lx, ly - 2)
    ctx.fillStyle = '#e6c98a'; ctx.font = 'bold 13px "Noto Serif SC", serif'
    ctx.fillText(String(Math.round(vals[i] * 15)), lx, ly + 14)
    ctx.font = '12px "Noto Serif SC", serif'; ctx.fillStyle = '#a89f88'
  })
}

interface Match { name: string; pct: number; tag: string }

/** 相似度条列表 */
export function MatchBars({ matches, me }: { matches: Match[]; me: string }) {
  return (
    <div className="match-bars">
      {matches.map((m, i) => (
        <div key={i} className="match-group">
          <div className={`match-row ${m.name === me ? 'me' : ''}`}>
          <span className="match-name">{m.name}{m.name === me && <em>· 就是你</em>}</span>
          <div className="match-track">
            <div className="match-fill" style={{ width: `${m.pct}%` }}>
              {i === 0 && <span className="match-pct">{m.pct}%</span>}
            </div>
          </div>
          {i !== 0 && <span className="match-pct2">{m.pct}%</span>}
          </div>
          <p className="match-tag">{m.tag}</p>
        </div>
      ))}
    </div>
  )
}

interface TimelineItem { age: string; event: string; mirror: string }

/** 人生三幕时间轴 */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="timeline">
      {items.map((it, i) => (
        <div className="tl-item" key={i}>
          <div className="tl-node"><span>{i + 1}</span></div>
          {i < items.length - 1 && <div className="tl-line" />}
          <div className="tl-body">
            <p className="tl-age">{it.age}</p>
            <p className="tl-event">{it.event}</p>
            <p className="tl-mirror">{it.mirror}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface Versus { foe: string; foeTitle: string; diff: string }

/** 千古对照卡 */
export function VersusCard({ v, me }: { v: Versus; me: string }) {
  return (
    <div className="versus">
      <div className="versus-col">
        <p className="versus-name">{me}</p>
        <p className="versus-role">你的原型</p>
      </div>
      <div className="versus-mid">对<br />照</div>
      <div className="versus-col">
        <p className="versus-name foe">{v.foe}</p>
        <p className="versus-role">{v.foeTitle}</p>
      </div>
      <p className="versus-diff">{v.diff}</p>
    </div>
  )
}

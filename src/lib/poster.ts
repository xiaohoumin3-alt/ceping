// Canvas 2D 海报绘制 → PNG ·「古籍命书」版
import type { QuizResult } from './quiz'

const W = 750, H = 1334

export function drawPoster(result: QuizResult, dimScores: Record<string, number>, _nearTie?: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('canvas unavailable')); return }

    // 玄墨底 + 顶部金晕
    ctx.fillStyle = '#0e0f12'; ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W/2, -100, 50, W/2, -100, 900)
    glow.addColorStop(0, 'rgba(201,169,97,0.14)'); glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

    // 边框（细金线 + 内衬线）
    ctx.strokeStyle = 'rgba(201,169,97,0.55)'; ctx.lineWidth = 2
    ctx.strokeRect(36, 36, W-72, H-72)
    ctx.strokeStyle = 'rgba(201,169,97,0.2)'; ctx.lineWidth = 1
    ctx.strokeRect(48, 48, W-96, H-96)

    ctx.textAlign = 'center'

    // 眉题
    ctx.fillStyle = 'rgba(201,169,97,0.85)'; ctx.font = '22px "Noto Serif SC", serif'
    ctx.fillText('三 国 命 书 · 照 见 兴 亡', W/2, 116)
    // 饰线
    ctx.strokeStyle = 'rgba(201,169,97,0.3)'
    ctx.beginPath(); ctx.moveTo(W/2-140, 140); ctx.lineTo(W/2+140, 140); ctx.stroke()

    // 人物名（大字）
    ctx.fillStyle = '#e8ddc4'; ctx.font = '900 92px "Noto Serif SC", "Songti SC", serif'
    ctx.fillText(result.person, W/2, 268)
    ctx.fillStyle = '#c9a961'; ctx.font = '34px "Noto Serif SC", serif'
    ctx.fillText(result.name.split('·')[1]?.trim() ?? '', W/2, 330)

    // 命运弧线
    ctx.fillStyle = 'rgba(232,221,196,0.75)'; ctx.font = '26px "Noto Serif SC", serif'
    wrapText(ctx, result.fateLine, W/2, 396, 560, 42)

    // 维度分（五行小条）
    const DIM5 = [['格局抱负','vision'],['洞察判断','insight'],['坚韧执行','grit'],['温情义气','warmth'],['沉稳定力','composure']] as const
    let dy = 500
    DIM5.forEach(([n, k]) => {
      const v = Math.min(Math.max((dimScores as Record<string, number>)[k] ?? 0, 0), 15)
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(168,159,136,0.9)'; ctx.font = '22px "Noto Serif SC", serif'
      ctx.fillText(n, 140, dy)
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(300, dy - 18, 300, 22)
      ctx.fillStyle = '#c9a86a'; ctx.fillRect(300, dy - 18, 300 * (v / 15), 22)
      ctx.fillStyle = '#e6c98a'; ctx.font = '20px "Noto Serif SC", serif'
      ctx.fillText(String(v), 620, dy)
      dy += 44
    })
    ctx.textAlign = 'center'

    // 分隔双线
    ctx.strokeStyle = 'rgba(201,169,97,0.25)'
    ctx.beginPath(); ctx.moveTo(120, 600); ctx.lineTo(W-120, 600); ctx.stroke()

    // 镜中人
    let y = 664
    ctx.font = '24px "Noto Serif SC", serif'
    y = drawBlock(ctx, '镜 中 人', result.profile, y)
    y = drawBlock(ctx, '天 赋', result.strengths, y)
    y = drawBlock(ctx, '盲 区', result.blindSpots, y)
    y = drawBlock(ctx, '赠 言', result.advice, y)

    // 金句
    if (y < 1120) {
      ctx.fillStyle = 'rgba(168,159,136,0.9)'; ctx.font = '24px "Noto Serif SC", serif'
      y = wrapText(ctx, `"${result.quote}"`, W/2, y + 40, 580, 38) + 10
    }

    // 朱砂印章（右下）
    drawSeal(ctx, W - 130, H - 200)

    // 底部信息
    ctx.fillStyle = 'rgba(168,159,136,0.55)'; ctx.font = '20px "Noto Serif SC", serif'
    ctx.fillText('娱乐性自评 · 非心理诊断', W/2, H - 108)
    ctx.fillText('三国命运镜像测试', W/2, H - 76)

    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png')
  })
}

function drawBlock(ctx: CanvasRenderingContext2D, label: string, text: string, y: number): number {
  ctx.fillStyle = '#c9a961'; ctx.font = '24px "Noto Serif SC", serif'
  ctx.fillText(label, W/2, y)
  ctx.fillStyle = 'rgba(232,221,196,0.92)'; ctx.font = '25px "Noto Serif SC", serif'
  const end = wrapText(ctx, text, W/2, y + 42, 590, 40)
  return end + 34
}

function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y); ctx.rotate(4 * Math.PI / 180)
  ctx.strokeStyle = 'rgba(195,64,47,0.85)'; ctx.lineWidth = 3
  ctx.strokeRect(-26, -26, 52, 52)
  ctx.fillStyle = 'rgba(195,64,47,0.85)'; ctx.font = '700 17px "Noto Serif SC", serif'
  ctx.fillText('命运', 0, -6); ctx.fillText('印证', 0, 16)
  ctx.restore()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, startY: number, maxW: number, lineH: number): number {
  const chars = Array.from(text)
  let line = '', y = startY
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, cx, y); line = ch; y += lineH
    } else line += ch
  }
  if (line) { ctx.fillText(line, cx, y); y += lineH }
  return y
}

/** 保存/分享海报：优先 Web Share，否则下载 */
export async function savePoster(blob: Blob, filename = 'fate-poster.png') {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '我的命运原型' }); return 'shared' } catch { /* 用户取消 */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

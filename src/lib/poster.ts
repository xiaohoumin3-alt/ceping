// Canvas 2D 海报绘制 → PNG（替代 html2canvas，规避 iOS Safari 兼容坑）
import type { QuizResult } from './quiz'
import { QUIZ } from './quiz'

const W = 750, H = 1334

export function drawPoster(result: QuizResult, dimScores: Record<string, number>, nearTie: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) { reject(new Error('canvas unavailable')); return }

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#1a1f3a'); bg.addColorStop(1, '#2d1f4a')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    // 标题
    ctx.fillStyle = '#d4c5a9'; ctx.font = '34px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('古 人 命 运 镜 像 测 试', W / 2, 120)

    // 人物名
    ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 96px serif'
    ctx.fillText(result.person, W / 2, 300)
    ctx.fillStyle = '#c9a86a'; ctx.font = '40px sans-serif'
    ctx.fillText(result.name.split('·')[1]?.trim() ?? '', W / 2, 370)

    // 命运弧线
    ctx.fillStyle = '#e8dcc0'; ctx.font = '30px sans-serif'
    wrapText(ctx, result.fateLine, W / 2, 450, 600, 44)

    // 维度分数条
    const dims = [
      ['秩序抱负', dimScores.order], ['局势洞察', dimScores.insight], ['进退取舍', dimScores.boundary],
    ] as const
    let y = 580
    ctx.textAlign = 'left'
    for (const [name, val] of dims) {
      ctx.fillStyle = '#d4c5a9'; ctx.font = '28px sans-serif'
      ctx.fillText(name, 110, y)
      // 条
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(260, y - 22, 340, 28)
      ctx.fillStyle = '#c9a86a'; ctx.fillRect(260, y - 22, 340 * (val / 15), 28)
      ctx.fillStyle = '#f5e6c8'; ctx.font = '26px sans-serif'
      ctx.fillText(`${val}/15`, 630, y)
      y += 80
    }

    // 金句
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(245,230,200,0.9)'; ctx.font = '28px sans-serif'
    wrapText(ctx, `"${result.quote}"`, W / 2, y + 60, 600, 42)

    if (nearTie) {
      ctx.fillStyle = 'rgba(212,197,169,0.7)'; ctx.font = '24px sans-serif'
      ctx.fillText('※ 混合型倾向：接近两种原型的交界', W / 2, y + 180)
    }

    // 免责声明
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '20px sans-serif'
    ctx.fillText('娱乐性自评 · 非心理诊断', W / 2, H - 130)
    ctx.fillText(QUIZ.meta.title, W / 2, H - 90)

    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png')
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, startY: number, maxW: number, lineH: number) {
  const chars = Array.from(text)
  let line = '', y = startY
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW) {
      ctx.fillText(line, cx, y); line = ch; y += lineH
    } else line += ch
  }
  if (line) ctx.fillText(line, cx, y)
}

/** 保存/分享海报：优先 Web Share，否则下载，最后弹指引长按保存 */
export async function savePoster(blob: Blob, filename = 'fate-poster.png') {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '我的命运原型' }); return 'shared' } catch { /* 用户取消或失败 */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

// 轻量二维码渲染：无依赖，用 canvas 画模块矩阵
// 采用极简 QR 生成（byte mode, ECC L, version 自适应 1-10）——够付 9.9 元的 weixin://wxpay 链接
// 实现基于 qrcode-generator 核心算法精简版（MIT, Kazuhiko Arase）
type BitBuffer = { buffer: number[]; put: (n: number, l: number) => void; length: number }

const EXP: number[] = []
const LOG: number[] = []
for (let i = 0; i < 8; i++) EXP[i] = 1 << i
for (let i = 8; i < 256; i++) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8]
for (let i = 0; i < 255; i++) LOG[EXP[i]] = i

const RS_BLOCK = [
  // version 1-10, ECC L: [count, total, data]
  [[1, 26, 19]], [[1, 44, 34]], [[1, 70, 55]], [[1, 100, 80]], [[2, 50, 32]],
  [[2, 64, 46]], [[2, 84, 60]], [[2, 98, 74]], [[2, 121, 86]], [[2, 146, 108]],
]

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]
}

export function drawQR(canvas: HTMLCanvasElement, text: string, size = 260) {
  const matrix = makeMatrix(text)
  const n = matrix.length
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cell = size / (n + 8)
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#1a1a1a'
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (matrix[r][c]) ctx.fillRect(4 * cell + c * cell, 4 * cell + r * cell, cell, cell)
}

function makeMatrix(text: string): number[][] {
  const bytes = new TextEncoder().encode(text)
  // 选最小可容版本（ECC L 容量：v1:17 v2:32 v3:53 v4:78 v5:106 v6:134 v7:172 v8:196 v9:242 v10:288 字节）
  const caps = [17, 32, 53, 78, 106, 134, 172, 196, 242, 288]
  let ver = caps.findIndex(c => bytes.length <= c) + 1
  if (ver === 0 || bytes.length > caps[9]) throw new Error('too long for lite QR')

  const buf: BitBuffer = { buffer: [], put(n: number, l: number) { for (let i = l - 1; i >= 0; i--) this.buffer.push((n >>> i) & 1) }, length: 0 }
  buf.put(4, 4) // mode: byte
  const lenBits = ver < 10 ? 8 : 16
  buf.put(bytes.length, lenBits)
  for (const b of bytes) buf.put(b, 8)

  const totalData = RS_BLOCK[ver - 1][0][2]
  const capBits = totalData * 8
  if (buf.buffer.length > capBits - 4) throw new Error('overflow')
  buf.put(0, Math.min(4, capBits - buf.buffer.length)) // terminator
  while (buf.buffer.length % 8 !== 0) buf.buffer.push(0)
  const dataBytes: number[] = []
  for (let i = 0; i < buf.buffer.length; i += 8)
    dataBytes.push(parseInt(buf.buffer.slice(i, i + 8).join(''), 2))
  const pad = [0xec, 0x11]
  for (let i = 0; dataBytes.length < totalData; i++) dataBytes.push(pad[i % 2])

  // RS 纠错（ECC L 对应各版本 ec codewords）
  const ecPerBlock = RS_BLOCK[ver - 1][0][1] - RS_BLOCK[ver - 1][0][2]
  const ec = rsEncode(dataBytes, ecPerBlock)

  const n = ver * 4 + 17
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
  const reserved: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false))

  function finder(r: number, c: number) {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue
      const dark = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6)) || (i >= 2 && i <= 4 && j >= 2 && j <= 4)
      m[rr][cc] = dark ? 1 : 0; reserved[rr][cc] = true
    }
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0)

  // timing
  for (let i = 8; i < n - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; reserved[6][i] = true; reserved[i][6] = true }
  // alignment
  if (ver >= 2) {
    const pos = alignmentPos(ver)
    for (const r of pos) for (const c of pos) {
      if (reserved[r]?.[c]) continue
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
        m[r + i][c + j] = (Math.abs(i) === 2 || Math.abs(j) === 2 || (i === 0 && j === 0)) ? 1 : 0
    }
  }
  // format info 占位
  for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true }
  for (let i = 0; i < 8; i++) { reserved[8][n - 1 - i] = true; reserved[n - 1 - i][8] = true }

  // 数据放置
  const all = [...dataBytes, ...ec]
  const bits: number[] = []
  for (const b of all) for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1)
  let bit = 0
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let up = true, r = 0; r < n; up = !up, r++) {
      const rr = up ? r : n - 1 - r
      for (let c of [col, col - 1]) {
        if (!reserved[rr][c] && bit < bits.length) m[rr][c] = bits[bit++]
      }
    }
  }

  // format info（ECC L, mask 0）: 简化——按 mask0 硬编码 format 比特
  const FORMAT = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0]
  const fmtBits = (arr: number[], f: (i: number) => [number, number]) => arr.forEach((v, i) => { const [r, c] = f(i); m[r][c] = v })
  fmtBits(FORMAT.slice(0, 8), i => i < 6 ? [8, i] : [8, i + 1] as [number, number])
  fmtBits(FORMAT.slice(7), i => i < 6 ? [n - 1 - i, 8] : [n - 8 + i - 5, 8] as [number, number])
  fmtBits(FORMAT.slice(0, 7), i => [8, n - 1 - i] as [number, number])
  fmtBits(FORMAT.slice(7), i => [8, n - 8 + i - 6 + 1] as [number, number])

  // mask 0：r+c 偶数取反
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (!reserved[r][c] && (r + c) % 2 === 0) m[r][c] ^= 1

  return m
}

function alignmentPos(ver: number): number[] {
  const table: Record<number, number[]> = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }
  return table[ver]
}

function rsEncode(data: number[], ecLen: number): number[] {
  // 生成多项式
  let gen = [1]
  for (let i = 0; i < ecLen; i++) {
    const next: number[] = Array(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) { next[j] ^= gfMul(gen[j], EXP[i]); next[j + 1] ^= gen[j] }
    gen = next
  }
  gen.reverse()
  const res = Array(ecLen).fill(0)
  for (const b of data) {
    const factor = b ^ res[0]
    res.shift(); res.push(0)
    for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j], factor)
  }
  return res
}

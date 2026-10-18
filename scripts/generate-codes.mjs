#!/usr/bin/env node
// 管理脚本：批量生成测评密码并导出 CSV（用于自动发货工具导入）
// 用法: node scripts/generate-codes.mjs <数量> [前缀]
// 依赖 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 环境变量（service role，勿进前端）
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const [count = 100, prefix = 'fm'] = process.argv.slice(2)
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('需要 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量'); process.exit(1) }

const sb = createClient(url, key)

// 高熵随机码: 前缀 + 10位 base32 无易混淆字符
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
function genCode() {
  const bytes = randomBytes(10)
  let s = ''
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length]
  return `${prefix}${s}`
}

const codes = []
const seen = new Set()
while (codes.length < Number(count)) {
  const c = genCode()
  if (seen.has(c)) continue
  seen.add(c); codes.push(c)
}

const { error } = await sb.from('codes').insert(codes.map(c => ({ code: c, remaining: 3 })))
if (error) { console.error('写入失败:', error.message); process.exit(1) }

const csv = 'code\n' + codes.join('\n')
writeFileSync(`codes-${Date.now()}.csv`, csv)
console.log(`已生成 ${codes.length} 个密码（每码3次）并导出 CSV`)
console.log('前5个预览:', codes.slice(0, 5).join(', '))

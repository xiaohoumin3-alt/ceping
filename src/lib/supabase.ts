// Supabase 客户端配置
// 环境变量来自 .env（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anonKey)

/** 表结构（见 supabase/schema.sql）：
 *  codes(code text pk, remaining int, created_at timestamptz)
 *  answers(id bigint pk, code text, answers text, result_key text, created_at)
 */

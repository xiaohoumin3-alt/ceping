// 云函数：LLM 全动态测评——人物原型由大模型从用户具体选择中推理得出（无固定池、无映射算法）
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: 'cloud1-d4gw10duaac5d8b50' });

exports.main = async (event) => {
  let payload = event
  if (event && typeof event.body === 'string') {
    try { payload = JSON.parse(event.body) } catch { payload = {} }
  } else if (event && event.body && typeof event.body === 'object') {
    payload = event.body
  }
  const { answers, questions } = payload
  if (!answers || !questions) return { error: 'missing params' }

  const qa = questions.map((q, i) =>
    `${i + 1}. ${q.text}\n   选项：${q.options.map(o => `${o.k}.${o.t}`).join('｜')}\n   用户选了：${answers[i]}（${q.options.find(o => o.k === answers[i])?.t ?? ''}）`
  ).join('\n')

  const prompt = `你是一位贯通中国历史的「命运原型」解读师。用户完成了一个情境测评，下面是全部 15 道题、所有选项及用户的具体选择。

${qa}

你的任务：
一、从中国历史人物中（任何朝代、任何领域——帝王/将相/文人/墨客/侠士/僧道/匠人皆可），为用户推理出一位「命运原型」。规则：
- 必须基于用户选择中反复出现的行为模式推理（如何面对混乱、如何处理人情、如何取舍），在解读中直接引用至少3个具体选择作为证据
- 人物必须是真实历史人物（文学虚构人物如林黛玉不可用；花木兰这类有广泛历史叙事基础的传说人物可用）
- 避免网络热门烂大街组合（李白/苏轼/嬴政若不贴切则选更贴合的冷门人物，贴切才用）
- 人物的命运弧线要能与用户画像形成呼应

二、输出严格 JSON（无 markdown 代码块）：
{
  "person": "人物姓名（2-4字，如：谢安）",
  "title": "原型名号（6-10字，如：淝水对弈·从容布局者）",
  "fateLine": "命运弧线，一句15-25字，诗化语言",
  "profile": "镜中人画像，120-160字。以用户的选择为证据链推理，必须直接引用至少3个具体选择。",
  "strengths": "天赋，50-80字。",
  "blindSpots": "盲区，50-80字，具体场景点破，不羞辱但有刺痛感。",
  "advice": "赠言，50-80字，一条可执行建议，呼应人物命运转折点。",
  "quote": "趣味金句，15-30字，仿该人物口吻的现代吐槽，幽默。",
  "dims": {"order": 数字0-15的秩序抱负评估, "insight": 数字, "boundary": 数字}
}`

  try {
    const model = app.ai().createModel('hunyuan-exp')
    const res = await model.generateText({
      model: 'hunyuan-2.0-instruct-20251111',
      messages: [
        { role: 'system', content: '你是资深中文测评文案师与历史学者，输出严格 JSON，无多余文字。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
    })
    const raw = res?.choices?.[0]?.message?.content ?? res?.text ?? ''
    console.log('RAW:', JSON.stringify(res).slice(0, 400))
    if (!raw) return { error: 'empty llm content', res: JSON.stringify(res).slice(0, 300) }
    let jsonStr = raw.replace(/```json?|```/g, '').trim()
    const s = jsonStr.indexOf('{'), e2 = jsonStr.lastIndexOf('}')
    if (s >= 0) jsonStr = jsonStr.slice(s, e2 > s ? e2 + 1 : undefined)
    // 截断修复：补齐未闭合的字符串与括号
    function tryParse(t) { try { return JSON.parse(t) } catch { return null } }
    let parsed = tryParse(jsonStr)
    if (!parsed) {
      let fixed = jsonStr
      const inStr = (fixed.match(/"/g) || []).length % 2 === 1
      if (inStr) fixed += '"'
      const opens = { '{': 0, '[': 0 }
      let instr = false, esc = false
      for (const ch of fixed) {
        if (esc) { esc = false; continue }
        if (ch === '\\') { esc = true; continue }
        if (ch === '"') instr = !instr
        if (!instr) { if (ch === '{') opens['{']++; if (ch === '[') opens['[']++ }
      }
      // 去掉最后一个未完成的键值对（若以逗号或冒号结尾）
      fixed = fixed.replace(/,\s*$/, '').replace(/:\s*$/, ': null')
      for (let i = 0; i < opens['[']; i++) fixed += ']'
      for (let i = 0; i < opens['{']; i++) fixed += '}'
      parsed = tryParse(fixed)
      if (!parsed) return { error: 'llm output unparseable', raw: jsonStr.slice(0, 800) }
    }
    return { ...parsed, generated: true }
  } catch (e) {
    return { error: String(e.message || e) }
  }
}

// 云函数：测评全流程 LLM 化
//   action=generate_quiz：每次动态生成 15 道全新情境题（无题库）
//   action=interpret：基于用户对动态题的选择，推理人物原型+全文案
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: 'cloud1-d4gw10duaac5d8b50' });

function callLLM(system, user, temperature) {
  const model = app.ai().createModel('hunyuan-exp')
  return model.generateText({
    model: 'hunyuan-2.0-instruct-20251111',
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature,
  }).then(res => res?.choices?.[0]?.message?.content ?? res?.text ?? '')
}

function extractJSON(raw) {
  let jsonStr = raw.replace(/```json?|```/g, '').trim()
  const s = jsonStr.indexOf('['), e = jsonStr.lastIndexOf(']')
  if (jsonStr.indexOf('{') >= 0 && (s < 0 || jsonStr.indexOf('{') < s)) {
    const s2 = jsonStr.indexOf('{'), e2 = jsonStr.lastIndexOf('}')
    if (s2 >= 0) jsonStr = jsonStr.slice(s2, e2 > s2 ? e2 + 1 : undefined)
  } else if (s >= 0) {
    jsonStr = jsonStr.slice(s, e > s ? e + 1 : undefined)
  }
  function tryParse(t) { try { return JSON.parse(t) } catch { return null } }
  let parsed = tryParse(jsonStr)
  if (!parsed) {
    let fixed = jsonStr
    if ((fixed.match(/"/g) || []).length % 2 === 1) fixed += '"'
    fixed = fixed.replace(/,\\s*$/, '').replace(/:\\s*$/, ': null')
    const opens = { '{': 0, '[': 0 }
    let instr = false, esc = false
    for (const ch of fixed) {
      if (esc) { esc = false; continue }
      if (ch === '\\\\') { esc = true; continue }
      if (ch === '"') instr = !instr
      if (!instr) { if (ch === '{') opens['{']++; if (ch === '[') opens['[']++ }
    }
    for (let i = 0; i < opens['[']; i++) fixed += ']'
    for (let i = 0; i < opens['{']; i++) fixed += '}'
    parsed = tryParse(fixed)
  }
  return parsed
}

exports.main = async (event) => {
  let payload = event
  if (event && typeof event.body === 'string') {
    try { payload = JSON.parse(event.body) } catch { payload = {} }
  } else if (event && event.body && typeof event.body === 'object') {
    payload = event.body
  }
  const action = payload.action || 'interpret'

  try {
    if (action === 'generate_quiz') {
      // 每次动态生成 15 道题：随机指定主题方向，保证不同用户/同一用户不同次拿到不同题
      const themes = ['职场处境', '家庭与亲缘', '朋友与人情往来', '金钱与利益', '爱情与亲密关系', '陌生人社交', '网络与线上生活', '消费与生活方式', '突发意外处境', '长期人生抉择']
      const picked = []
      while (picked.length < 3) {
        const t = themes[Math.floor(Math.random() * themes.length)]
        if (!picked.includes(t)) picked.push(t)
      }
      const seed = Date.now() + Math.floor(Math.random() * 1e6)
      let raw = ''
      for (let attempt = 0; attempt < 3 && !raw; attempt++) {
        try {
          raw = await callLLM(
            '你是资深中文测评出题人，输出严格 JSON 数组，无多余文字。',
        `为「古人命运镜像测试」出一套 15 道情境选择题。要求：
- 其中约 9 道围绕这三个主题领域：${picked.join('、')}（各至少 2 道）；其余 6 道自由选择日常生活领域
- 每道题：一个中国当代真实生活情境（具体到场景细节，不抽象），4 个选项（都是普通人会有的真实反应，无道德标准答案，无搞笑选项）
- 15 道题覆盖不同心理面向：面对混乱/规则、读懂人心/局势、利益/情面/自我的取舍、冒险与安稳、坚持与放弃
- 相邻题不考同一个面向；题目间情境不重复
- 随机种子 ${seed}，请据此让本题组与常见题组明显不同
输出 JSON 数组（不要 markdown 代码块）：
[{"text":"题目文本30-60字","options":[{"k":"A","t":"选项18-30字"},{"k":"B","t":"..."},{"k":"C","t":"..."},{"k":"D","t":"..."}]}, ... 恰好15项]`,
            1.0,
          )
        } catch { /* 重试 */ }
        if (!raw) await new Promise(r => setTimeout(r, 800))
      }
      const quiz = extractJSON(raw)
      if (!Array.isArray(quiz) || quiz.length < 15) {
        return { error: 'quiz generation incomplete', got: Array.isArray(quiz) ? quiz.length : String(raw).slice(0, 200) }
      }
      return { questions: quiz.slice(0, 15), generated: true }
    }

    // action=interpret
    const { answers, questions } = payload
    if (!answers || !questions) return { error: 'missing params' }
    const qa = questions.map((q, i) =>
      `${i + 1}. ${q.text}\n   选项：${q.options.map(o => `${o.k}.${o.t}`).join('｜')}\n   用户选了：${answers[i]}（${q.options.find(o => o.k === answers[i])?.t ?? ''}）`
    ).join('\n')

    const prompt = `你是一位贯通中国历史的「命运原型」解读师。用户完成了一个情境测评，下面是全部 15 道题、所有选项及用户的具体选择。

${qa}

你的任务：
一、从中国历史人物中（任何朝代、任何领域——帝王/将相/文人/墨客/侠士/僧道/匠人皆可），为用户推理出一位「命运原型」。规则：
- 必须基于用户选择中反复出现的行为模式推理，在解读中直接引用至少3个具体选择作为证据
- 人物必须是真实历史人物（文学虚构人物不可用；花木兰这类有广泛历史叙事基础的传说人物可用）
- 避免烂大街组合（李白/苏轼/嬴政若不贴切则选更贴合的冷门人物，贴切才用）
- 人物的命运弧线要能与用户画像形成呼应

二、输出严格 JSON（无 markdown 代码块）：
{
  "person": "人物姓名（2-4字）",
  "title": "原型名号（6-10字，如：淝水对弈·从容布局者）",
  "fateLine": "命运弧线，一句15-25字，诗化语言",
  "profile": "镜中人画像，120-160字。以用户的选择为证据链推理，必须直接引用至少3个具体选择。",
  "strengths": "天赋，50-80字。",
  "blindSpots": "盲区，50-80字，具体场景点破，不羞辱但有刺痛感。",
  "advice": "赠言，50-80字，一条可执行建议，呼应人物命运转折点。",
  "quote": "趣味金句，15-30字，仿该人物口吻的现代吐槽，幽默。",
  "dims": {"order": 数字0-15, "insight": 数字, "boundary": 数字}
}`

    const raw = await callLLM('你是资深中文测评文案师与历史学者，输出严格 JSON，无多余文字。', prompt, 0.9)
    const parsed = extractJSON(raw)
    if (!parsed || !parsed.person) return { error: 'llm output unparseable', raw: String(raw).slice(0, 500) }
    return { ...parsed, generated: true }
  } catch (e) {
    return { error: String(e.message || e) }
  }
}

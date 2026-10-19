// 云函数：LLM 动态生成个性化测评解读
// 输入: { answers: "ABCDE...", dims: {order,insight,boundary}, resultKey, resultName, resultPerson, fateLine, nearTie }
// 输出: { profile, strengths, blindSpots, advice, quote }  —— 全部由 LLM 依据用户具体答案生成
const tcb = require('@cloudbase/node-sdk');
const app = tcb.init({ env: 'cloud1-d4gw10duaac5d8b50' });

exports.main = async (event) => {
  // HTTP 网关会把原始请求包在 event.body 里
  let payload = event
  if (event && typeof event.body === 'string') {
    try { payload = JSON.parse(event.body) } catch { payload = {} }
  } else if (event && event.body && typeof event.body === 'object') {
    payload = event.body
  }
  const { answers, dims, resultKey, resultName, resultPerson, fateLine, nearTie, questions } = payload
  if (!answers || !resultKey) return { error: 'missing params' }

  const model = app.ai().createModel('hunyuan-exp')

  const prompt = `你是一位精通中国历史人物命运叙事的测评解读师。用户的测评结果已由算法确定，你的任务是基于用户的**具体选择**撰写专属解读，不得套用模板腔。

【测评】古人命运镜像测试（15题情境选择）
【算法判定】用户是「${resultName}」（人物：${resultPerson}），命运弧线："${fateLine}"
${nearTie ? '【注意】用户画像接近两种原型的交界，解读中要点出这种混合气质。' : ''}

【用户的三维得分】（每维满分15）
- 秩序抱负：${dims.order}
- 局势洞察：${dims.insight}
- 进退取舍：${dims.boundary}

【用户的15道题选择】（题目+所选选项）：
${(questions || []).map((q, i) => `${i + 1}. ${q.text}\n   选了：${q.options.find(o => o.k === (answers[i] || 'A'))?.t ?? answers[i]}`).join('\n')}

请输出严格的 JSON（不要 markdown 代码块），四个字段：
{
  "profile": "镜中人画像，120-180字。必须直接引用用户至少2个具体选择（如'当熟人借钱时你选了…'），点出他哪个维度最高哪个最低并解释这意味着什么。禁止'你是一个…的人'开头。",
  "strengths": "天赋，60-100字。基于得分最高的维度，结合具体题目行为佐证。",
  "blindSpots": "盲区，60-100字。基于得分最低的维度，用具体的日常场景点破，不羞辱但要有刺痛感。",
  "advice": "赠言，60-100字。给一条可执行的具体动作建议（要有数字或明确做法），与历史人物的命运故事呼应。",
  "quote": "趣味金句，20-40字。仿 historical 人物口吻的一句现代吐槽或自白，带幽默感。"
}`

  try {
    const res = await model.generateText({
      model: 'hunyuan-2.0-instruct-20251111',
      messages: [
        { role: 'system', content: '你是资深中文测评文案师，输出严格 JSON，无多余文字。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    })
    const text = res?.choices?.[0]?.message?.content ?? res?.text ?? JSON.stringify(res).slice(0, 500)
    console.log('RAW:', JSON.stringify(res).slice(0, 300))
    const jsonStr = text.replace(/```json?|```/g, '').trim()
    const parsed = JSON.parse(jsonStr.slice(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1))
    return { ...parsed, generated: true }
  } catch (e) {
    return { error: String(e.message || e) }
  }
}

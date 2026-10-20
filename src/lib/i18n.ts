// 双语文案表：lang 由 URL ?lang=en 或浏览器语言决定
export type Lang = 'zh' | 'en'

export function detectLang(): Lang {
  const url = new URL(location.href)
  if (url.searchParams.get('lang') === 'en') return 'en'
  if (url.searchParams.get('lang') === 'zh') return 'zh'
  return navigator.language.startsWith('zh') ? 'zh' : 'en'
}

const STR = {
  zh: {
    eyebrow: '命 书 一 卷 · 照 见 古 今',
    titleA: '三国', titleEm: '命运', titleB: '镜像测试',
    sub: '十五问，照出你是三国里的哪位人物',
    ornament: '❖ ❖ ❖',
    codePh: '请输入测评密码',
    enter: '启 卷',
    entering: '推 衍 中 …',
    meta: ['一码三用', '十五问', '每卷皆新'],
    loadingQuiz: '正在为你拟一套全新的三国十五问……',
    loadingQuizFine: '大模型命题 · 每次测评的题目都不相同 · 约需十余秒',
    quizEyebrowLoading: '研 墨 起 卷',
    orb: ['出', '题', '中'],
    diviningEyebrow: '焚 香 推 衍',
    diviningText: '命盘已成，镜中人正在浮现……',
    diviningFine: '大模型正在通读你的十五个选择，为你推演命运原型 · 约需十余秒',
    orbDivining: ['推', '衍', '中'],
    resultEyebrow: '镜 中 人 已 现',
    seal: '命运印证',
    freeHint: '▲ 你的五维命盘已免费揭开 · 完整命书待启',
    quizCount: (i: number, n: number) => `${String(i + 1).padStart(2, '0')} ／ ${n}`,
    prev: '上一题', next: '下一题', finish: '揭 晓',
    errQuiz: '出题受阻，请再试一次。',
    errDivine: '镜中光影涣散，请再试一次。',
    retry: '再 次 推 衍',
    // Paywall
    pwOrnament: '❖ 完 整 命 书 ❖',
    pwLead: '镜中人已现，但他的来历、天赋、盲区与赠言，还封在命书之内。',
    pwList: ['镜 中 人 · 专属推演全文', '天 赋 · 盲 区 · 赠 言', '群像相似度 · 人生三幕 · 千古对照', '命书海报 · 可存可分享'],
    pwBtn: '¥9.9 · 开 启 完 整 命 书',
    pwCreating: '启 印 中 …',
    pwFine: '微信扫码支付 · 付款后自动揭开 · 非娱乐占卜承诺，仅供自鉴',
    pwScan: '请用微信扫码 · 付款后本页自动揭开命书',
    pwWaiting: '等待支付中…（约 3 分钟内有效，超时可重试）',
    pwTimeout: '等待支付超时，如已付款请刷新页面重试',
    retryPay: '重 试',
  },
  en: {
    eyebrow: 'ONE SCROLL OF FATE · MIRROR OF AGES',
    titleA: 'Three Kingdoms', titleEm: 'Destiny', titleB: 'Mirror Test',
    sub: '15 questions reveal which Three Kingdoms figure you are',
    ornament: '❖ ❖ ❖',
    codePh: 'Enter your access code',
    enter: 'BEGIN',
    entering: 'DIVINING…',
    meta: ['1 code · 3 uses', '15 questions', 'new every time'],
    loadingQuiz: 'Composing a brand-new set of 15 questions for you…',
    loadingQuizFine: 'AI-generated · different every time · takes ~15 seconds',
    quizEyebrowLoading: 'GRINDING THE INK',
    orb: ['L', 'O', 'A', 'D'],
    diviningEyebrow: 'READING YOUR FATE',
    diviningText: 'Your chart is drawn — the figure in the mirror is emerging…',
    diviningFine: 'The AI is reading your 15 choices to divine your destiny archetype · ~15 seconds',
    orbDivining: ['R', 'E', 'A', 'D'],
    resultEyebrow: 'THE FIGURE APPEARS',
    seal: 'DESTINY VERIFIED',
    freeHint: '▲ Your five-dimension chart is free · the full scroll awaits',
    quizCount: (i: number, n: number) => `${i + 1} / ${n}`,
    prev: 'Back', next: 'Next', finish: 'REVEAL',
    errQuiz: 'Question generation hiccuped. Please try again.',
    errDivine: 'The mirror blurred. Please try again.',
    retry: 'TRY AGAIN',
    // Paywall
    pwOrnament: '❖ THE FULL SCROLL ❖',
    pwLead: 'The figure has appeared — but their story, gifts, blind spots and parting counsel remain sealed within the scroll.',
    pwList: ['Full narrative reading', 'Gifts · Blind spots · Parting counsel', 'Kindred matches · Life in three acts · Rival contrast', 'Fate poster — save & share'],
    pwLaunching: true as const,
    pwEmailPh: 'you@example.com',
    pwJoin: 'NOTIFY ME AT LAUNCH',
    pwJoined: 'You are on the list ✓',
    pwJoinLead: 'The full scroll is coming soon. Leave your email and be first to unlock it.',
    pwScan: '',
    pwWaiting: '',
    pwTimeout: '',
    retryPay: '',
    pwBtn: '', pwCreating: '', pwFine: '',
  },
} as const

export const T = STR

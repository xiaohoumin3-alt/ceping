# 测评付费闭环 — 部署与联调手册

> T-20261020-002 交付物。代码已完成并通过构建/单测，部署需要 L1 提供 4 组凭证。

## 已完成的代码

| 文件 | 作用 |
|---|---|
| `supabase/schema-v2-payments.sql` | orders 表 + RLS + is_unlocked RPC（在 SQL Editor 执行一次） |
| `supabase/functions/create-order/index.ts` | 下单 + 微信 Native v3 签名请求 |
| `supabase/functions/wxpay-callback/index.ts` | 支付回调验签 + AES-GCM 解密 + 幂等发货（created→paid） |
| `supabase/functions/check-unlock/index.ts` | 结果页轮询订单状态 |
| `src/lib/pay.ts` | 前端支付客户端（下单/轮询） |
| `src/lib/qrlite.ts` | 无依赖二维码渲染（已单测：finder/timing/确定性通过） |
| `src/components/Paywall.tsx` | 付费墙组件（¥9.9，微信扫码） |
| `src/App.tsx` | 结果页切分：免费=人物+称号+命线+五维雷达；付费=全部深度内容+海报 |

免费/付费切分原则：先给核心结论（钩子），深度内容付费——避开市场痛点「答完题才锁报告」。

## L1 需要提供的凭证（一次性）

1. **微信支付商户号 mchid** + **关联 appid**（公众号或开放平台应用，需开通 Native 支付产品）
2. **APIv3 密钥**（商户平台 → 账户中心 → API 安全）
3. **商户私钥** `apiclient_key.pem` 全文 + **证书序列号**
4. **微信平台公钥**（或平台证书，用于回调验签）
5. **Supabase Access Token**（用于部署 Edge Functions；Dashboard → Account → Access Tokens）

## 部署步骤（拿到凭证后执行）

```bash
# 1. Supabase SQL Editor 执行 schema-v2-payments.sql
# 2. Edge Functions 部署
supabase login  # 粘贴 access token
cd ~/ceping/03-g3-app
supabase link --project-ref gxqilfbuhiphprkshhcn
supabase functions deploy create-order wxpay-callback check-unlock
# 3. Secrets 配置（Dashboard → Edge Functions → Secrets）
#    WXPAY_MCHID / WXPAY_APPID / WXPAY_SERIAL_NO / WXPAY_PRIVATE_KEY(\n转义) /
#    WXPAY_MCH_API_V3_KEY / WXPAY_PLATFORM_PUBKEY
# 4. 前端构建 + 部署 GitHub Pages（dist → 仓库 gh-pages）
npm run build
```

## 联调验证清单（按序）

1. ✅ `npm run build` 通过
2. ✅ QR 矩阵单测（finder/timing/确定性）
3. ☐ 测试单：扫真实二维码付 ¥9.9 → orders 状态 created→paid → 结果页 3 秒内自动揭开全文
4. ☐ 幂等：同一订单重复回调只发货一次
5. ☐ 赠码通道回归：旧 codes 仍可进（verify_and_consume 不受影响）
6. ☐ 手机全流程（微信内打开 → 扫码 → 付款 → 自动解锁）

## 合规注记（章程红线）

- 付费文案已含「非娱乐占卜承诺，仅供自鉴」；报告页保留 QUIZ.meta.disclaimer
- 不做临床诊断表述、不承诺准确率

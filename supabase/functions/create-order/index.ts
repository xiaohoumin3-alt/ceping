// create-order：创建测评付费订单，返回微信 Native 支付二维码链接
// 环境变量（Supabase Dashboard → Edge Functions → Secrets 配置）：
//   WXPAY_MCHID / WXPAY_APPID(公众号或小程序appid) / WXPAY_MCH_API_V3_KEY / WXPAY_SERIAL_NO
//   WXPAY_PRIVATE_KEY (apiclient_key.pem PEM 全文, \n 转义)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (Edge 运行时自带)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash, createSign, randomUUID } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-order-no",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { answer_id, amount_fen = 990 } = await req.json();
    if (!answer_id) return json({ error: "answer_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 幂等：该 answer 已有 paid 订单直接返回已解锁
    const { data: existing } = await supabase
      .from("orders").select("status, wx_out_trade_no").eq("answer_id", answer_id);
    if (existing?.some((o: any) => o.status === "paid")) {
      return json({ already_paid: true });
    }

    const outTradeNo = `CP${Date.now()}${randomUUID().slice(0, 8)}`;
    const { data: order, error } = await supabase
      .from("orders")
      .insert({ answer_id, amount_fen, wx_out_trade_no: outTradeNo, status: "created" })
      .select("id").single();
    if (error) return json({ error: error.message }, 500);

    // 微信支付 Native 下单 (v3 API)
    const appid = Deno.env.get("WXPAY_APPID")!;
    const mchid = Deno.env.get("WXPAY_MCHID")!;
    const body = {
      appid, mchid,
      description: "个人特质测评-深度解读报告",
      out_trade_no: outTradeNo,
      notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/wxpay-callback`,
      amount: { total: amount_fen, currency: "CNY" },
      time_expire: new Date(Date.now() + 15 * 60 * 1000).toISOString().replace(/\.\d+Z$/, "+08:00"),
    };
    const wxRes = await wxRequest("POST", "/v3/pay/transactions/native", body);
    if (!wxRes.ok) {
      const err = await wxRes.text();
      await supabase.from("orders").update({ status: "closed" }).eq("id", order.id);
      return json({ error: `wxpay_${wxRes.status}`, detail: err.slice(0, 300) }, 502);
    }
    const { code_url } = await wxRes.json();

    return json({ order_id: order.id, out_trade_no: outTradeNo, code_url, amount_fen });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

async function wxRequest(method: string, path: string, body: unknown) {
  const url = `https://api.mch.weixin.qq.com${path}`;
  const ts = Math.floor(Date.now() / 1000);
  const nonce = randomUUID().replace(/-/g, "");
  const signStr = `${method}\n${path}\n${ts}\n${nonce}\n${JSON.stringify(body)}\n`;
  const sign = createSign("RSA-SHA256");
  sign.update(signStr);
  sign.end();
  const signature = sign.sign(Deno.env.get("WXPAY_PRIVATE_KEY")!.replace(/\\n/g, "\n"), "base64");
  const auth = `WECHATPAY2-SHA256-RSA2048 mchid="${Deno.env.get("WXPAY_MCHID")}",nonce_str="${nonce}",signature="${signature}",timestamp="${ts}",serial_no="${Deno.env.get("WXPAY_SERIAL_NO")}"`;
  return fetch(url, {
    method, headers: {
      "Content-Type": "application/json", Authorization: auth,
      "User-Agent": "ceping-edge-function",
    }, body: JSON.stringify(body),
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

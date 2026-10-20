// check-unlock：结果页轮询订单状态，已付款则解锁全文
// 兜底：订单 created 超过 20s 时，主动向微信查单同步（回调可能延迟/丢失）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSign, randomUUID } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-order-no",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { out_trade_no } = await req.json();
    if (!out_trade_no) return json({ error: "out_trade_no required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("orders")
      .select("status, answer_id, created_at")
      .eq("wx_out_trade_no", out_trade_no)
      .maybeSingle();
    if (!data) return json({ status: "not_found" }, 404);

    let status = data.status;

    // 兜底查单：created 且下单超 20s，主动向微信确认
    if (status === "created" && Date.now() - new Date(data.created_at).getTime() > 20_000) {
      const wxState = await queryWxOrder(out_trade_no);
      if (wxState === "SUCCESS") {
        await supabase
          .from("orders")
          .update({ status: "paid", paid_at: new Date().toISOString(), wx_transaction_id: "query_sync" })
          .eq("wx_out_trade_no", out_trade_no)
          .eq("status", "created");
        status = "paid";
      }
    }
    return json({ status, answer_id: data.answer_id });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

async function queryWxOrder(outTradeNo: string): Promise<string | null> {
  try {
    const mchid = Deno.env.get("WXPAY_MCHID")!;
    const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${mchid}`;
    const ts = Math.floor(Date.now() / 1000);
    const nonce = randomUUID().replace(/-/g, "");
    const sign = createSign("RSA-SHA256");
    sign.update(`GET\n${url}\n${ts}\n${nonce}\n\n`);
    sign.end();
    const signature = sign.sign(Deno.env.get("WXPAY_PRIVATE_KEY")!.replace(/\\n/g, "\n"), "base64");
    const res = await fetch(`https://api.mch.weixin.qq.com${url}`, {
      headers: { Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${ts}",serial_no="${Deno.env.get("WXPAY_SERIAL_NO")}"` },
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.trade_state ?? null;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

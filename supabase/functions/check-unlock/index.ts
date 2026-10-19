// check-unlock：结果页轮询订单状态，已付款则解锁全文
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-order-no",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { out_trade_no } = await req.json();
    if (!out_trade_no) return json({ error: "out_trade_no required" }, 400);

    // anon 语义：仅按 out_trade_no 查（不泄露其他字段），够结果页判断
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("orders")
      .select("status, answer_id")
      .eq("wx_out_trade_no", out_trade_no)
      .maybeSingle();
    if (!data) return json({ status: "not_found" }, 404);
    return json({ status: data.status, answer_id: data.answer_id });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

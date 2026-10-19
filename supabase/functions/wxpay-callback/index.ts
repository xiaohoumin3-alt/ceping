// wxpay-callback：微信支付异步通知（自动发货核心）
// 收到支付成功 → 标记订单 paid → 该 answers 行即被解锁（is_unlocked 查 orders）
// 平台签名验证 + 幂等；验签失败拒绝。
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createVerify, createDecipheriv } from "node:crypto";

Deno.serve(async (req: Request) => {
  try {
    const wxTimestamp = req.headers.get("wechatpay-timestamp")!;
    const wxNonce = req.headers.get("wechatpay-nonce")!;
    const wxSignature = req.headers.get("wechatpay-signature")!;
    const wxSerial = req.headers.get("wechatpay-serial")!;
    const rawBody = await req.text();

    // 1. 验签（平台证书公钥来自 secret WXPAY_PLATFORM_PUBKEY，或走证书下载，此处用配置公钥）
    const verify = createVerify("RSA-SHA256");
    verify.update(`${wxTimestamp}\n${wxNonce}\n${rawBody}\n`);
    const pubPem = Deno.env.get("WXPAY_PLATFORM_PUBKEY")!;
    const ok = verify.verify(pubPem.replace(/\\n/g, "\n"), wxSignature, "base64");
    if (!ok) {
      console.error("signature_verify_failed", wxSerial);
      return Response.json({ code: "FAIL", message: "验签失败" }, { status: 401 });
    }

    // 2. 解密 resource（AES-256-GCM，APIv3 密钥）
    const event = JSON.parse(rawBody);
    if (event.event_type !== "TRANSACTION.SUCCESS") {
      return Response.json({ code: "SUCCESS", message: "忽略非支付成功事件" });
    }
    const { ciphertext, nonce: resNonce, associated_data } = event.resource;
    const key = Deno.env.get("WXPAY_MCH_API_V3_KEY")!;
    const data = decryptGCM(ciphertext, key, resNonce, associated_data ?? "");
    const { out_trade_no, transaction_id, trade_state } = JSON.parse(data);

    if (trade_state !== "SUCCESS") {
      return Response.json({ code: "SUCCESS", message: "非成功状态忽略" });
    }

    // 3. 幂等发货：created → paid
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // 原子条件更新：只有 created 才置 paid（并发回调只成功一次）
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), wx_transaction_id: transaction_id })
      .eq("wx_out_trade_no", out_trade_no)
      .eq("status", "created")
      .select("id");

    if (error) {
      console.error("db_update_failed", out_trade_no, error.message);
      return Response.json({ code: "FAIL", message: "订单更新失败" }, { status: 500 });
    }
    if (data?.length) {
      console.log("DELIVERED order=", out_trade_no, "tx=", transaction_id); // 发货日志
    }
    // 已 paid（重复通知）也返回成功，微信停止重试
    return Response.json({ code: "SUCCESS", message: "OK" });
  } catch (e: any) {
    console.error("callback_error", e.message);
    return Response.json({ code: "FAIL", message: e.message }, { status: 500 });
  }
});

function decryptGCM(ciphertext: string, key: string, nonce: string, aad: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "utf8"), Buffer.from(nonce, "utf8"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(buf.subarray(buf.length - 16));
  const dec = Buffer.concat([decipher.update(buf.subarray(0, buf.length - 16)), decipher.final()]);
  return dec.toString("utf8");
}

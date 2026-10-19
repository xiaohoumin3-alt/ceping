-- 测评付费闭环 schema v2（在 Supabase SQL Editor 执行一次）
-- 设计：一次性订单，付款回调标记 paid，answers 行解锁深度内容

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  answer_id bigint references answers(id),
  openid_hint text,              -- 浏览器指纹/本地生成的匿名 id，用于回调匹配兜底
  amount_fen int not null,
  status text not null default 'created' check (status in ('created','paid','closed','refunded')),
  wx_out_trade_no text unique,   -- 我们生成，传给微信
  wx_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

-- 匿名可插入新订单（创建订单时），不可读不可改
create policy "anon insert orders" on orders
  for insert to anon with check (true);

-- 匿名按 out_trade_no 只读自己订单状态（轮询用）
create policy "anon read own order" on orders
  for select to anon
  using (wx_out_trade_no = current_setting('request.header.x-order-no', true));

-- 解锁判定 RPC：结果页据此决定展示全文还是付费墙
create or replace function is_unlocked(p_answer_id bigint)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from orders
    where answer_id = p_answer_id and status = 'paid'
  );
$$;

grant execute on function is_unlocked(bigint) to anon;

-- 索引
create index if not exists idx_orders_answer on orders(answer_id);
create index if not exists idx_orders_outtrade on orders(wx_out_trade_no);

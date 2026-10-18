-- Supabase 初始化 schema（在 Supabase SQL Editor 执行一次）
create table if not exists codes (
  code text primary key,
  remaining int not null default 3 check (remaining >= 0),
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id bigint generated always as identity primary key,
  code text not null,
  answers text not null,
  result_key text not null,
  created_at timestamptz not null default now()
);

-- 行级安全：anon 只能通过 RPC 扣次数和写答案，不能直接读 codes
alter table codes enable row level security;
alter table answers enable row level security;

-- 允许匿名写 answers（答题记录），不允许读
create policy "anon insert answers" on answers
  for insert to anon with check (true);

-- 核验+扣次数的原子 RPC（防并发超用）
create or replace function verify_and_consume(p_code text)
returns int  -- 返回剩余次数，-1 表示无效
language plpgsql
security definer
as $$
declare
  v_remaining int;
begin
  update codes
     set remaining = remaining - 1
   where code = lower(trim(p_code))
     and remaining > 0
  returning remaining into v_remaining;
  if v_remaining is null then
    -- 可能是无效码，也可能已用完
    if exists (select 1 from codes where code = lower(trim(p_code))) then
      return 0;  -- 已用完
    end if;
    return -1;   -- 无效
  end if;
  return v_remaining;
end; $$;

grant execute on function verify_and_consume(text) to anon;

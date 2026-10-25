-- schema-v3-codes-unlock.sql
-- 目的：支持「全解锁码」——闲鱼买家凭码进门 + 跳过付费墙，一次付费体验完整。
-- 在 Supabase Dashboard → SQL Editor 执行一次。幂等。

-- 1. codes 表加标记字段：true = 全解锁码（闲鱼发货码），false = 普通体验码
alter table codes
  add column if not exists unlocks_full boolean not null default false;

-- 2. 给全解锁码建索引（便于统计闲鱼码消耗）
create index if not exists idx_codes_unlocks_full
  on codes(unlocks_full) where unlocks_full;

-- 3. 改 RPC 返回 JSON（含 unlocks_full 标记），原子扣次数逻辑不变
create or replace function verify_and_consume(p_code text)
returns json
language plpgsql
security definer
as $$
declare
  v_remaining int;
  v_unlocks   boolean;
begin
  update codes
     set remaining = remaining - 1
   where code = lower(trim(p_code))
     and remaining > 0
  returning remaining, unlocks_full into v_remaining, v_unlocks;

  if v_remaining is null then
    if exists (select 1 from codes where code = lower(trim(p_code))) then
      return json_build_object('remaining', 0, 'unlocks_full', false);
    end if;
    return json_build_object('remaining', -1, 'unlocks_full', false);
  end if;

  return json_build_object('remaining', v_remaining, 'unlocks_full', coalesce(v_unlocks, false));
end; $$;

grant execute on function verify_and_consume(text) to anon;

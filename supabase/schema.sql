create table if not exists public.fee_calc_records (
  record_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  saved_at timestamptz not null default now(),
  student_name text not null default '',
  target_year integer,
  target_month integer,
  current_tab text not null default 'auto',
  total_text text not null default '0원',
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.fee_calc_private_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

create index if not exists fee_calc_records_saved_at_idx
  on public.fee_calc_records (saved_at desc);

create index if not exists fee_calc_records_student_name_idx
  on public.fee_calc_records (student_name);

alter table public.fee_calc_records enable row level security;
alter table public.fee_calc_private_settings enable row level security;

drop policy if exists "fee_calc_records_select_all" on public.fee_calc_records;
drop policy if exists "fee_calc_records_insert_all" on public.fee_calc_records;

revoke all on public.fee_calc_records from anon, authenticated;
revoke all on public.fee_calc_private_settings from anon, authenticated;

drop function if exists public.set_fee_calc_access_code(text);
create or replace function public.set_fee_calc_access_code(p_access_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(coalesce(p_access_code, ''))) < 8 then
    raise exception '접속 코드는 8자 이상이어야 합니다.';
  end if;

  insert into public.fee_calc_private_settings (setting_key, setting_value, updated_at)
  values ('access_code_hash', md5(trim(p_access_code)), now())
  on conflict (setting_key)
  do update set
    setting_value = excluded.setting_value,
    updated_at = now();
end;
$$;

drop function if exists public.fee_calc_check_access_code(text);
create or replace function public.fee_calc_check_access_code(p_access_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  select setting_value
    into stored_hash
  from public.fee_calc_private_settings
  where setting_key = 'access_code_hash';

  if stored_hash is null then
    raise exception '수강료 계산기 접속 코드가 아직 설정되지 않았습니다.';
  end if;

  return md5(trim(coalesce(p_access_code, ''))) = stored_hash;
end;
$$;

drop function if exists public.feecalc_list_records(text, integer);
create or replace function public.feecalc_list_records(
  p_access_code text,
  p_limit integer default 80
)
returns table (
  record_id uuid,
  saved_at timestamptz,
  student_name text,
  target_year integer,
  target_month integer,
  current_tab text,
  total_text text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  return query
  select
    r.record_id,
    r.saved_at,
    r.student_name,
    r.target_year,
    r.target_month,
    r.current_tab,
    r.total_text
  from public.fee_calc_records r
  order by r.saved_at desc
  limit greatest(1, least(coalesce(p_limit, 80), 200));
end;
$$;

drop function if exists public.feecalc_get_record(text, uuid);
create or replace function public.feecalc_get_record(
  p_access_code text,
  p_record_id uuid
)
returns table (
  record_id uuid,
  saved_at timestamptz,
  student_name text,
  target_year integer,
  target_month integer,
  current_tab text,
  total_text text,
  payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  return query
  select
    r.record_id,
    r.saved_at,
    r.student_name,
    r.target_year,
    r.target_month,
    r.current_tab,
    r.total_text,
    r.payload
  from public.fee_calc_records r
  where r.record_id = p_record_id
  limit 1;
end;
$$;

drop function if exists public.feecalc_save_record(text, text, integer, integer, text, text, jsonb);
create or replace function public.feecalc_save_record(
  p_access_code text,
  p_student_name text,
  p_target_year integer,
  p_target_month integer,
  p_current_tab text,
  p_total_text text,
  p_payload jsonb
)
returns table (
  record_id uuid,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  return query
  insert into public.fee_calc_records (
    student_name,
    target_year,
    target_month,
    current_tab,
    total_text,
    payload,
    saved_at
  )
  values (
    coalesce(p_student_name, ''),
    p_target_year,
    p_target_month,
    coalesce(nullif(p_current_tab, ''), 'auto'),
    coalesce(nullif(p_total_text, ''), '0원'),
    coalesce(p_payload, '{}'::jsonb),
    now()
  )
  returning fee_calc_records.record_id, fee_calc_records.saved_at;
end;
$$;

drop function if exists public.feecalc_delete_record(text, uuid);
create or replace function public.feecalc_delete_record(
  p_access_code text,
  p_record_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  delete from public.fee_calc_records
  where record_id = p_record_id;
end;
$$;

drop function if exists public.feecalc_get_app_settings(text);
create or replace function public.feecalc_get_app_settings(
  p_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_text text;
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  select setting_value
    into settings_text
  from public.fee_calc_private_settings
  where setting_key = 'app_settings';

  return coalesce(settings_text::jsonb, '{}'::jsonb);
end;
$$;

drop function if exists public.feecalc_save_app_settings(text, jsonb);
create or replace function public.feecalc_save_app_settings(
  p_access_code text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_settings jsonb;
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  clean_settings := coalesce(p_settings, '{}'::jsonb);

  insert into public.fee_calc_private_settings (setting_key, setting_value, updated_at)
  values ('app_settings', clean_settings::text, now())
  on conflict (setting_key)
  do update set
    setting_value = excluded.setting_value,
    updated_at = now();

  return clean_settings;
end;
$$;

grant execute on function public.feecalc_list_records(text, integer) to anon, authenticated;
grant execute on function public.feecalc_get_record(text, uuid) to anon, authenticated;
grant execute on function public.feecalc_save_record(text, text, integer, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.feecalc_delete_record(text, uuid) to anon, authenticated;
grant execute on function public.feecalc_get_app_settings(text) to anon, authenticated;
grant execute on function public.feecalc_save_app_settings(text, jsonb) to anon, authenticated;

revoke all on function public.fee_calc_check_access_code(text) from public, anon, authenticated;
revoke all on function public.set_fee_calc_access_code(text) from public, anon, authenticated;

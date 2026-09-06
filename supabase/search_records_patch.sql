-- Run secure_gateway.sql first for an existing installation.
begin;
drop function if exists public.feecalc_search_records(text, text, integer);

create or replace function public.feecalc_search_records(
  p_access_code text,
  p_keyword text,
  p_limit integer default 500
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
declare
  keyword text;
begin
  if not public.fee_calc_check_access_code(p_access_code) then
    raise exception '기록 접속 코드가 올바르지 않습니다.';
  end if;

  keyword := trim(coalesce(p_keyword, ''));

  if keyword = '' then
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
    limit greatest(1, least(coalesce(p_limit, 500), 1000));
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
  where r.student_name ilike ('%' || keyword || '%')
  order by r.saved_at desc
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
end;
$$;

revoke all on function public.feecalc_search_records(text, text, integer) from public, anon, authenticated;
grant execute on function public.feecalc_search_records(text, text, integer) to service_role;

commit;

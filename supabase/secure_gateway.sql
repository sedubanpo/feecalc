-- Apply only after feeCalculatorApi and the employee-login client are ready.
-- No record rows or shared settings are changed. Re-running is safe.
begin;

-- Keep the legacy RPC signatures for stored-record compatibility, but a public
-- access code is never an authority. auth.role() reads the gateway-verified JWT;
-- current_user must NOT be used inside SECURITY DEFINER functions.
create or replace function public.fee_calc_check_access_code(p_access_code text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false);
$$;

revoke all on public.fee_calc_records from public, anon, authenticated;
revoke all on public.fee_calc_private_settings from public, anon, authenticated;
alter table public.fee_calc_records enable row level security;
alter table public.fee_calc_private_settings enable row level security;

do $$
declare f record;
begin
  -- Include every installed overload of the known calculator RPC names.
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'feecalc_list_records', 'feecalc_search_records', 'feecalc_get_record',
      'feecalc_save_record', 'feecalc_update_record', 'feecalc_delete_record',
      'feecalc_get_app_settings', 'feecalc_save_app_settings'
    )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end;
$$;

revoke all on function public.fee_calc_check_access_code(text) from public, anon, authenticated;
grant execute on function public.fee_calc_check_access_code(text) to service_role;
-- This obsolete setup API cannot restore the retired shared-code mechanism.
revoke all on function public.set_fee_calc_access_code(text) from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;

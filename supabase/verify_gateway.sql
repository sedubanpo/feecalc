-- Metadata only. Never returns student data, settings, hashes, or credentials.
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'feecalc_list_records', 'feecalc_search_records', 'feecalc_get_record',
  'feecalc_save_record', 'feecalc_update_record', 'feecalc_delete_record',
  'feecalc_get_app_settings', 'feecalc_save_app_settings'
)
order by p.proname;

select c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('fee_calc_records', 'fee_calc_private_settings');

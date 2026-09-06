// Local PostgreSQL (PGlite), synthetic records only. No production connection.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE || '/tmp/feecalc-sql-test/node_modules/@electric-sql/pglite/dist/index.js'));
const db = new PGlite();
const sql = name => fs.readFile(new URL('../supabase/' + name, import.meta.url), 'utf8');
// pg_trgm indexing is unrelated to authorization and omitted in this WASM test.
const portable = s => s.replace(/create extension if not exists pg_trgm;/g, '')
  .replace(/create index if not exists fee_calc_records_student_name_trgm_idx[\s\S]*?;/g, '');
const query = (s, args) => db.query(s, args);
const role = async name => {
  await db.exec('reset role');
  await query("select set_config('request.jwt.claim.role', $1, false)", [name]);
  await db.exec(`set role ${name}`);
};
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.role() to anon, authenticated, service_role;`);
  const oldSchema = execFileSync('git', ['show', 'HEAD:supabase/schema.sql'], {encoding:'utf8'});
  await db.exec(portable(oldSchema));
  await query("select public.set_fee_calc_access_code('synthetic-local-code')");
  const saved = await query("select * from public.feecalc_save_record('synthetic-local-code','가상검증',2026,8,'auto','100원','{\"synthetic\":true}')");
  const id = saved.rows[0].record_id;
  await role('anon');
  assert.equal((await query("select * from public.feecalc_get_record('synthetic-local-code',$1)",[id])).rows.length, 1);
  await db.exec('reset role');
  const before = (await query('select * from public.fee_calc_records')).rows;
  await db.exec(await sql('secure_gateway.sql'));
  await db.exec(await sql('secure_gateway.sql'));
  assert.deepEqual((await query('select * from public.fee_calc_records')).rows, before);
  console.log('PASS migration is idempotent and preserves every synthetic record column');
  for (const name of ['anon','authenticated']) {
    await role(name);
    for (const command of [
      ["select * from public.feecalc_list_records('synthetic-local-code',1)"],
      ["select * from public.feecalc_search_records('synthetic-local-code','',1)"],
      ["select * from public.feecalc_get_record('synthetic-local-code',$1)",[id]],
      ["select * from public.feecalc_save_record('synthetic-local-code','blocked',2026,8,'auto','0원','{}')"],
      ["select * from public.feecalc_update_record('synthetic-local-code',$1,'blocked',2026,8,'auto','0원','{}')",[id]],
      ["select public.feecalc_delete_record('synthetic-local-code',$1)",[id]],
      ["select public.feecalc_get_app_settings('synthetic-local-code')"],
      ["select public.feecalc_save_app_settings('synthetic-local-code','{}')"],
      ['select * from public.fee_calc_records'],
      ['select * from public.fee_calc_private_settings'],
      ["select public.set_fee_calc_access_code('synthetic-new-code')"],
    ]) await assert.rejects(() => query(...command), /permission denied/);
    console.log(`PASS ${name}: eight RPCs, direct tables and obsolete setup denied`);
  }
  await role('service_role');
  assert.equal((await query("select * from public.feecalc_get_record('',$1)",[id])).rows.length, 1);
  const newId = (await query("select * from public.feecalc_save_record('','가상검증2',2026,9,'auto','200원','{}')")).rows[0].record_id;
  await query("select * from public.feecalc_update_record('',$1,'가상수정',2026,9,'auto','300원','{}')",[newId]);
  assert.equal((await query("select * from public.feecalc_search_records('','가상수정',1)")).rows[0].total_text,'300원');
  await query("select public.feecalc_save_app_settings('','{\"test\":1}')");
  assert.deepEqual((await query("select public.feecalc_get_app_settings('') as settings")).rows[0].settings,{test:1});
  await query("select public.feecalc_delete_record('',$1)",[newId]);
  assert.equal((await query("select * from public.feecalc_get_record('',$1)",[newId])).rows.length,0);
  console.log('PASS server-only read/search/save/update/delete/settings roundtrip');
  await db.exec('reset role');
  // A future fresh schema or search patch must not reopen the direct RPC path.
  await db.exec(portable(await sql('schema.sql')));
  await db.exec(await sql('search_records_patch.sql'));
  const grants = (await query(`select p.proname,
    has_function_privilege('anon',p.oid,'execute') as anon_allowed,
    has_function_privilege('authenticated',p.oid,'execute') as auth_allowed,
    has_function_privilege('service_role',p.oid,'execute') as server_allowed
    from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.proname like 'feecalc_%'`)).rows;
  assert.equal(grants.length,8);
  for (const g of grants) {assert.equal(g.anon_allowed,false);assert.equal(g.auth_allowed,false);assert.equal(g.server_allowed,true);}
  console.log('PASS schema and search patch preserve the eight server-only grants');
} finally { await db.close(); }

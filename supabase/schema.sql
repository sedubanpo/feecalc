create extension if not exists pgcrypto;

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

create index if not exists fee_calc_records_saved_at_idx
  on public.fee_calc_records (saved_at desc);

create index if not exists fee_calc_records_student_name_idx
  on public.fee_calc_records (student_name);

alter table public.fee_calc_records enable row level security;

drop policy if exists "fee_calc_records_select_all" on public.fee_calc_records;
create policy "fee_calc_records_select_all"
on public.fee_calc_records
for select
to anon, authenticated
using (true);

drop policy if exists "fee_calc_records_insert_all" on public.fee_calc_records;
create policy "fee_calc_records_insert_all"
on public.fee_calc_records
for insert
to anon, authenticated
with check (true);

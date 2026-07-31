-- ============================================================================
-- Identra (Kinentry) — RLS Regression Test Suite
-- Runs against a throwaway Postgres instance in CI on every push. This
-- formalizes the manual security audit performed on 2026-07-26, which found
-- two serious bugs (staff couldn't read other patients' records; staff's
-- enrollment status updates were silently failing). Every assertion below
-- either reproduces one of those two real bugs, or locks in a security
-- boundary that was manually verified that day. If a future migration
-- reintroduces either bug, this suite fails loudly in CI instead of
-- silently shipping.
--
-- This file is self-contained: it stubs the Supabase-specific pieces
-- (auth schema, auth.uid()/auth.role(), the `authenticated` role) since a
-- plain Postgres container doesn't have them, then recreates every table
-- and policy exactly as they exist in production, then runs assertions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Supabase environment stubs
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

create or replace function auth.role() returns text as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$ language sql stable;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tables + policies (mirrors production exactly, including the 2026-07-26 fixes)
-- ---------------------------------------------------------------------------

create table if not exists patients (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'patient' check (role in ('patient', 'staff', 'admin'))
);
alter table patients enable row level security;
grant all on patients to authenticated;

create or replace function is_staff_or_admin()
returns boolean as $$
  select exists (select 1 from patients where id = auth.uid() and role in ('staff', 'admin'));
$$ language sql security definer stable;

drop policy if exists "patients_select_own" on patients;
create policy "patients_select_own" on patients for select to authenticated using (auth.uid() = id);
drop policy if exists "patients_select_staff" on patients;
create policy "patients_select_staff" on patients for select to authenticated using (is_staff_or_admin());
drop policy if exists "patients_update_own" on patients;
create policy "patients_update_own" on patients for update to authenticated using (auth.uid() = id);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  status text not null default 'pending'
);
alter table enrollments enable row level security;
grant all on enrollments to authenticated;

drop policy if exists "enrollments_insert_own" on enrollments;
create policy "enrollments_insert_own" on enrollments for insert to authenticated with check (auth.uid() = patient_id);
drop policy if exists "enrollments_select_own_or_staff" on enrollments;
create policy "enrollments_select_own_or_staff" on enrollments for select to authenticated
  using (auth.uid() = patient_id or exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "enrollments_update_own" on enrollments;
create policy "enrollments_update_own" on enrollments for update to authenticated using (auth.uid() = patient_id);
drop policy if exists "enrollments_update_staff" on enrollments;
create policy "enrollments_update_staff" on enrollments for update to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text default 'draft'
);
alter table programs enable row level security;
grant all on programs to authenticated;

drop policy if exists "programs_write_staff" on programs;
create policy "programs_write_staff" on programs for all to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "programs_select_authenticated" on programs;
create policy "programs_select_authenticated" on programs for select to authenticated using (auth.role() = 'authenticated');

create table if not exists insurance_verifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  status text not null default 'pending'
    check (status in ('pending','under_review','verified','needs_correction','ineligible')),
  payer_name text
);
alter table insurance_verifications enable row level security;
grant all on insurance_verifications to authenticated;

drop policy if exists "insurance_verifications_select_own" on insurance_verifications;
create policy "insurance_verifications_select_own" on insurance_verifications for select to authenticated using (patient_id = auth.uid());
drop policy if exists "insurance_verifications_select_staff" on insurance_verifications;
create policy "insurance_verifications_select_staff" on insurance_verifications for select to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "insurance_verifications_insert_own" on insurance_verifications;
create policy "insurance_verifications_insert_own" on insurance_verifications for insert to authenticated
  with check (patient_id = auth.uid() and status in ('pending','under_review'));
drop policy if exists "insurance_verifications_insert_staff" on insurance_verifications;
create policy "insurance_verifications_insert_staff" on insurance_verifications for insert to authenticated
  with check (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "insurance_verifications_update_staff" on insurance_verifications;
create policy "insurance_verifications_update_staff" on insurance_verifications for update to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id),
  status text not null default 'scheduled'
    check (status in ('scheduled','confirmed','completed','cancelled','no_show'))
);
alter table appointments enable row level security;
grant all on appointments to authenticated;

drop policy if exists "appointments_select_own" on appointments;
create policy "appointments_select_own" on appointments for select to authenticated using (patient_id = auth.uid());
drop policy if exists "appointments_select_staff" on appointments;
create policy "appointments_select_staff" on appointments for select to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "appointments_insert_staff" on appointments;
create policy "appointments_insert_staff" on appointments for insert to authenticated
  with check (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "appointments_update_staff" on appointments;
create policy "appointments_update_staff" on appointments for update to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));
drop policy if exists "appointments_cancel_own" on appointments;
create policy "appointments_cancel_own" on appointments for update to authenticated
  using (patient_id = auth.uid() and status in ('scheduled','confirmed'))
  with check (patient_id = auth.uid() and status = 'cancelled');

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, patient_id uuid, description text
);
alter table audit_logs enable row level security;
grant all on audit_logs to authenticated;

drop policy if exists "audit_logs_insert_own" on audit_logs;
create policy "audit_logs_insert_own" on audit_logs for insert to authenticated with check (actor_id = auth.uid());
drop policy if exists "audit_logs_select_own" on audit_logs;
create policy "audit_logs_select_own" on audit_logs for select to authenticated using (patient_id = auth.uid());
drop policy if exists "audit_logs_select_staff" on audit_logs;
create policy "audit_logs_select_staff" on audit_logs for select to authenticated
  using (exists (select 1 from patients p where p.id = auth.uid() and p.role in ('staff','admin')));

-- ---------------------------------------------------------------------------
-- Fixture data
-- ---------------------------------------------------------------------------
delete from insurance_verifications; delete from appointments; delete from audit_logs; delete from enrollments;
delete from patients; delete from auth.users;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

insert into patients (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Patient One', 'patient'),
  ('22222222-2222-2222-2222-222222222222', 'Patient Two', 'patient'),
  ('33333333-3333-3333-3333-333333333333', 'Staff Sam', 'staff');

set role authenticated;
set request.jwt.claim.role = 'authenticated';

-- ============================================================================
-- REGRESSION 1: staff must be able to read another patient's record.
-- (2026-07-26 bug: this returned NULL for every patient but the staff
-- member's own row, causing "Unknown patient" throughout the admin UI.)
-- ============================================================================
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare found_name text;
begin
  select full_name into found_name from patients where id = '11111111-1111-1111-1111-111111111111';
  if found_name is distinct from 'Patient One' then
    raise exception 'REGRESSION 1 FAILED: staff could not read another patient''s record (got %)', found_name;
  end if;
end $$;

-- ============================================================================
-- REGRESSION 2: staff must be able to actually update an enrollment's status.
-- (2026-07-26 bug: this silently matched 0 rows with no error, so Confirm/
-- Waitlist/Cancel appeared to work in the UI but never persisted.)
-- ============================================================================
-- Only the patient themselves can create their own enrollment (matches
-- production: there's no staff-insert policy on enrollments, by design).
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into enrollments (patient_id, status) values ('11111111-1111-1111-1111-111111111111', 'pending');

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare affected int;
begin
  update enrollments set status = 'confirmed' where patient_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'REGRESSION 2 FAILED: staff enrollment update silently affected 0 rows';
  end if;
end $$;

-- ============================================================================
-- SECURITY: a patient must never see or modify another patient's data.
-- ============================================================================
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare cnt int; affected int;
begin
  select count(*) into cnt from patients where id = '11111111-1111-1111-1111-111111111111';
  if cnt != 0 then raise exception 'SECURITY FAILED: patient two could read patient one''s record'; end if;

  select count(*) into cnt from enrollments where patient_id = '11111111-1111-1111-1111-111111111111';
  if cnt != 0 then raise exception 'SECURITY FAILED: patient two could read patient one''s enrollment'; end if;

  update enrollments set status = 'cancelled' where patient_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'SECURITY FAILED: patient two modified patient one''s enrollment'; end if;
end $$;

-- ============================================================================
-- insurance_verifications: patient can submit, cannot self-verify, staff can.
-- ============================================================================
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into insurance_verifications (patient_id, status, payer_name) values ('11111111-1111-1111-1111-111111111111', 'pending', 'Aetna');

do $$
declare affected int;
begin
  update insurance_verifications set status = 'verified' where patient_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'SECURITY FAILED: patient self-verified their own insurance'; end if;
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare affected int; cnt int;
begin
  select count(*) into cnt from insurance_verifications;
  if cnt != 1 then raise exception 'FAILED: staff cannot see insurance_verifications (saw %)', cnt; end if;

  update insurance_verifications set status = 'verified' where patient_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics affected = row_count;
  if affected != 1 then raise exception 'FAILED: staff could not verify insurance'; end if;
end $$;

-- ============================================================================
-- appointments: patient can cancel own, cannot self-complete, staff can do both.
-- ============================================================================
-- Only staff can create an appointment (matches production: no patient
-- self-insert policy — scheduling is staff-initiated).
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into appointments (patient_id, status) values ('11111111-1111-1111-1111-111111111111', 'scheduled');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare affected int;
begin
  update appointments set status = 'cancelled' where patient_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics affected = row_count;
  if affected != 1 then raise exception 'FAILED: patient could not cancel their own appointment'; end if;
end $$;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into appointments (patient_id, status) values ('11111111-1111-1111-1111-111111111111', 'scheduled');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare affected int;
begin
  begin
    update appointments set status = 'completed' where patient_id = '11111111-1111-1111-1111-111111111111' and status = 'scheduled';
    get diagnostics affected = row_count;
    if affected != 0 then
      raise exception 'SECURITY FAILED: patient marked their own appointment completed';
    end if;
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- ============================================================================
-- audit_logs: must be genuinely tamper-proof — no one can update or delete.
-- ============================================================================
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into audit_logs (actor_id, patient_id, description) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'original');

do $$
declare affected int;
begin
  update audit_logs set description = 'TAMPERED' where actor_id = '33333333-3333-3333-3333-333333333333';
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'SECURITY FAILED: an audit log entry was modified — not tamper-proof'; end if;

  delete from audit_logs where actor_id = '33333333-3333-3333-3333-333333333333';
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'SECURITY FAILED: an audit log entry was deleted — not tamper-proof'; end if;
end $$;

-- ============================================================================
-- programs: staff full CRUD, patients read-only.
-- ============================================================================
do $$
declare new_id uuid; affected int;
begin
  insert into programs (name, status) values ('Test Program', 'draft') returning id into new_id;
  update programs set status = 'open' where id = new_id;
  get diagnostics affected = row_count;
  if affected != 1 then raise exception 'FAILED: staff could not update a program'; end if;
  delete from programs where id = new_id;
end $$;

insert into programs (name, status) values ('Patient-visible Program', 'open');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare cnt int; affected int;
begin
  select count(*) into cnt from programs;
  if cnt = 0 then raise exception 'FAILED: patient cannot read programs at all'; end if;

  update programs set status = 'closed';
  get diagnostics affected = row_count;
  if affected != 0 then raise exception 'SECURITY FAILED: patient modified a program'; end if;
end $$;

select 'ALL RLS REGRESSION TESTS PASSED' as result;

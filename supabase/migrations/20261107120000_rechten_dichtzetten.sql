-- Security review 2026-11-07 (T1): browser roles get nothing, now and later.
-- Explanation in Dutch: docs/beveiliging.md ("Database: wie mag wat")
--
-- The earlier migrations already revoke the rights on every table and function
-- they create, and RLS is on everywhere without policies. But Supabase gives
-- `anon` and `authenticated` all rights on *new* tables and functions by
-- default (default privileges). A table added later without its own REVOKE
-- would then be readable by every logged-in scanner through the Data API.
-- This migration closes that door for good.

-- 1. Everything that exists now.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- 2. Everything created later by the role that runs the migrations (postgres).
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- PostgreSQL itself lets PUBLIC (so everyone) run every new function. That
-- default can only be taken away for all schemas at once, not per schema.
-- Only our own migrations create functions as postgres, so that is fine.
alter default privileges for role postgres revoke execute on functions from public;

-- 3. The edge functions (service role) keep what they need.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges for role postgres in schema public grant all on tables    to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

-- 4. Belt and braces: RLS on every table in public, also any added by hand,
--    so a stray GRANT later still returns no rows.
do $$
declare
  t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end;
$$;

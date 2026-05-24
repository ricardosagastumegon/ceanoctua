-- Phase 2 - Migration 0010
-- Enable RLS on all public tables and attach the updated_at trigger to every
-- table that has an updated_at column.
-- Per PLAN-FASE-2.md: no policies defined here; only service_role accesses.
-- Policies per role are added in Phase 3 alongside auth.

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'                       -- ordinary tables
      and c.relname not like 'pg_%'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end;
$$;

-- Attach set_updated_at trigger to every table that has updated_at
do $$
declare
  r record;
  trg_name text;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'updated_at'
      and not a.attisdropped
  loop
    trg_name := 'set_updated_at_' || r.relname;
    -- Drop if it exists to make this idempotent
    execute format('drop trigger if exists %I on public.%I', trg_name, r.relname);
    execute format(
      'create trigger %I before update on public.%I
        for each row execute function public.set_updated_at()',
      trg_name, r.relname
    );
  end loop;
end;
$$;

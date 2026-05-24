-- Phase 3 - Migration 0002
-- Activate created_by default auth.uid() on every table that has the column.
-- Add a second updated_at trigger function that also stamps updated_by.
-- Re-attach the correct trigger per table based on column presence.

-- 1) Default auth.uid() on created_by ------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'created_by'
      and not a.attisdropped
  loop
    execute format(
      'alter table public.%I alter column created_by set default auth.uid()',
      r.relname
    );
  end loop;
end;
$$;

-- 2) Variant trigger function that also sets updated_by ------------------
create or replace function public.set_updated_at_with_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

-- 3) Re-create updated_at triggers, picking the variant per table -------
do $$
declare
  r record;
  trg_name text;
  has_updated_by boolean;
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

    select exists (
      select 1
      from pg_attribute a2
      join pg_class c2 on c2.oid = a2.attrelid
      join pg_namespace n2 on n2.oid = c2.relnamespace
      where n2.nspname = 'public'
        and c2.relname = r.relname
        and a2.attname = 'updated_by'
        and not a2.attisdropped
    ) into has_updated_by;

    execute format('drop trigger if exists %I on public.%I', trg_name, r.relname);

    if has_updated_by then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at_with_by()',
        trg_name, r.relname
      );
    else
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        trg_name, r.relname
      );
    end if;
  end loop;
end;
$$;

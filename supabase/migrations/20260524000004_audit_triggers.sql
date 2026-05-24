-- Phase 3 - Migration 0004
-- Audit trigger function and attach to the 6 financial tables.

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
begin
  if TG_OP = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(NEW);
    v_id  := NEW.id;
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id  := NEW.id;
  else  -- DELETE
    v_old := to_jsonb(OLD);
    v_new := null;
    v_id  := OLD.id;
  end if;

  insert into public.audit_log
    (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  values
    (TG_TABLE_NAME, v_id, lower(TG_OP), auth.uid(), v_old, v_new);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- Attach to financial tables.
do $$
declare
  t text;
  trg text;
  finance_tables text[] := array[
    'tc_consumos',
    'reintegros',
    'caja_chica_vales',
    'caja_chica_liquidaciones',
    'pagos',
    'vouchers'
  ];
begin
  foreach t in array finance_tables loop
    trg := 'audit_' || t;
    execute format('drop trigger if exists %I on public.%I', trg, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
        for each row execute function public.audit_trigger()',
      trg, t
    );
  end loop;
end;
$$;

-- Phase 12 — Audit fixes (Senior Engineering Review)
--   * C-1: RLS de CEA — allow asistente to write cea_todos / lavanderia / firmas / directorio
--   * C-2: Trigger sync_vale_liquidacion_link — preserve previous estado + handle soft-delete
--   * C-3: CHECK constraints en columnas no-blank críticas
--   * M-3: Drop legacy cea_directorio (replaced by `directorio` in fase 7)

------------------------------------------------------------------
-- C-1) RLS — let `asistente` write CEA tables
------------------------------------------------------------------
-- The Pattern C bucket in 20260524000003 created `_admin_write` policies
-- that restrict writes to admin only. Drop them and replace with
-- admin|asistente policies for CEA-operational tables.
do $$
declare
  t text;
  cea_op_tables text[] := array[
    'cea_todos',
    'lavanderia',
    'firmas',
    'directorio'
  ];
begin
  foreach t in array cea_op_tables loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.auth_rol() in (''admin'',''asistente''))
         with check (public.auth_rol() in (''admin'',''asistente''))',
      t || '_write', t
    );
  end loop;
end $$;

-- Miel y Arriaza siguen siendo admin-only (catálogos sensibles).
-- Si más adelante asistente las necesita, agregar policies análogas.

------------------------------------------------------------------
-- C-2) Trigger: preservar estado_previo de vale + manejar soft-delete
------------------------------------------------------------------
alter table public.caja_chica_vales
  add column if not exists estado_previo vale_status;

create or replace function public.sync_vale_liquidacion_link()
returns trigger language plpgsql as $$
declare
  prev_estado vale_status;
begin
  -- INSERT o cambio de vale_serial
  if (tg_op = 'INSERT' and new.vale_serial is not null and new.vale_serial <> '')
     or (tg_op = 'UPDATE' and coalesce(old.vale_serial,'') <> coalesce(new.vale_serial,''))
  then
    -- Desligar el vale viejo (si había uno) restaurando su estado_previo
    if tg_op = 'UPDATE' and old.vale_serial is not null and old.vale_serial <> '' then
      update public.caja_chica_vales
         set liquidacion_id = null,
             estado = coalesce(estado_previo, 'Creado'::vale_status),
             estado_previo = null
       where serial = old.vale_serial and liquidacion_id = old.id;
    end if;

    -- Ligar el vale nuevo, guardando su estado actual antes de sobrescribir
    if new.vale_serial is not null and new.vale_serial <> '' then
      select estado into prev_estado
        from public.caja_chica_vales
       where serial = new.vale_serial
       limit 1;

      update public.caja_chica_vales
         set liquidacion_id = new.id,
             estado_previo = prev_estado,
             estado = 'Asignado a Liquidación'::vale_status
       where serial = new.vale_serial;
    end if;
  end if;
  return new;
end $$;

-- Trigger para soft-delete: si se marca deleted_at en la liquidación,
-- desligar y restaurar todos los vales que apuntaban a ella.
create or replace function public.unlink_vales_on_liq_delete()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.caja_chica_vales
       set liquidacion_id = null,
           estado = coalesce(estado_previo, 'Creado'::vale_status),
           estado_previo = null
     where liquidacion_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_unlink_vales_on_liq_delete on public.caja_chica_liquidaciones;
create trigger trg_unlink_vales_on_liq_delete
  after update of deleted_at on public.caja_chica_liquidaciones
  for each row execute function public.unlink_vales_on_liq_delete();

------------------------------------------------------------------
-- C-3) CHECK constraints en campos críticos (no-blank)
------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'caja_chica_liq_motivo_not_blank'
  ) then
    alter table public.caja_chica_liquidaciones
      add constraint caja_chica_liq_motivo_not_blank
      check (motivo is null or length(trim(motivo)) > 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'caja_chica_liq_solicitado_not_blank'
  ) then
    alter table public.caja_chica_liquidaciones
      add constraint caja_chica_liq_solicitado_not_blank
      check (solicitado is null or length(trim(solicitado)) > 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'caja_chica_vales_vale_a_not_blank'
  ) then
    alter table public.caja_chica_vales
      add constraint caja_chica_vales_vale_a_not_blank
      check (length(trim(vale_a)) > 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'caja_chica_vales_monto_positive'
  ) then
    alter table public.caja_chica_vales
      add constraint caja_chica_vales_monto_positive
      check (monto > 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'firmas_tipo_not_blank'
  ) then
    alter table public.firmas
      add constraint firmas_tipo_not_blank
      check (length(trim(tipo)) > 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pagos_monto_positive'
  ) then
    alter table public.pagos
      add constraint pagos_monto_positive
      check (monto > 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'miel_constancias_total_non_negative'
  ) then
    alter table public.miel_constancias
      add constraint miel_constancias_total_non_negative
      check (total >= 0);
  end if;
end $$;

------------------------------------------------------------------
-- M-3) Drop legacy table cea_directorio (replaced by `directorio` in fase 7)
------------------------------------------------------------------
drop table if exists public.cea_directorio cascade;

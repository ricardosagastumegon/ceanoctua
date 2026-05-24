-- Phase 11 — Reference-HTML corrections
-- This migration aligns the schema with the original board-assistant monolith:
--   * CC Board: rewrite liquidaciones (rows, motivo, payment, vale link, comprobante)
--   * Vales: extend status vocabulary (Solicitado, Acreditado, …) and use VL-YYYY-NNNN serial
--   * Lavandería: add 5-step workflow
--   * CEA todos: extend prioridad/estado labels
--   * Pagos: add 6-step workflow

------------------------------------------------------------------
-- 1) Sequences & per-year correlatives
------------------------------------------------------------------
create sequence if not exists seq_cc_liq;
create sequence if not exists seq_cc_vale_yr;

------------------------------------------------------------------
-- 2) CC Board · Vales — VL-YYYY-NNNN serial
------------------------------------------------------------------
alter table public.caja_chica_vales
  alter column serial set default ('VL-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_cc_vale_yr')::text, 4, '0'));

-- Extend vale_status enum to include the original 8 labels.
alter type vale_status add value if not exists 'Solicitado';
alter type vale_status add value if not exists 'Acreditado';
alter type vale_status add value if not exists 'Asignado a Liquidación';
alter type vale_status add value if not exists 'Pendiente de Liquidar';
alter type vale_status add value if not exists 'Pendiente de Reintegro';

------------------------------------------------------------------
-- 3) CC Board · Liquidaciones — full rewrite (additive)
------------------------------------------------------------------
alter table public.caja_chica_liquidaciones
  add column if not exists serial text unique,
  add column if not exists entidad text,
  add column if not exists payment_method text,
  add column if not exists motivo text,
  add column if not exists producto text,
  add column if not exists solicitado text,
  add column if not exists reintegrar_a text,
  add column if not exists vale_serial text,
  add column if not exists vale_monto numeric(14,2) default 0,
  add column if not exists comentarios text,
  add column if not exists comprobante_storage_path text;

alter table public.caja_chica_liquidaciones
  alter column serial set default ('CC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_cc_liq')::text, 4, '0'));

-- Generated column for diff (total - vale_monto). Drop+recreate-safe.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='caja_chica_liquidaciones' and column_name='diff'
  ) then
    alter table public.caja_chica_liquidaciones
      add column diff numeric(14,2)
        generated always as (coalesce(monto_total,0) - coalesce(vale_monto,0)) stored;
  end if;
end $$;

create index if not exists caja_chica_liq_solicitado_idx on public.caja_chica_liquidaciones(solicitado);
create index if not exists caja_chica_liq_estado_idx     on public.caja_chica_liquidaciones(estado);

------------------------------------------------------------------
-- 4) Child table: compras de una liquidación
------------------------------------------------------------------
create table if not exists public.caja_chica_liq_rows (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  liquidacion_id  uuid not null references public.caja_chica_liquidaciones(id) on delete cascade,
  fecha           date,
  factura         text,
  proveedor       text,
  concepto        text,
  cantidad        numeric(12,3) not null default 1,
  unitario        numeric(14,2) not null default 0,
  total           numeric(14,2) generated always as (coalesce(cantidad,0) * coalesce(unitario,0)) stored,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists caja_chica_liq_rows_liq_idx on public.caja_chica_liq_rows(liquidacion_id);

-- Recalcular monto_total de la liquidación cuando sus rows cambian.
create or replace function public.recalc_caja_chica_liq_total()
returns trigger language plpgsql as $$
declare
  liq_id uuid;
begin
  liq_id := coalesce(new.liquidacion_id, old.liquidacion_id);
  if liq_id is not null then
    update public.caja_chica_liquidaciones
       set monto_total = coalesce((
         select sum(coalesce(cantidad,0) * coalesce(unitario,0))
           from public.caja_chica_liq_rows
          where liquidacion_id = liq_id
       ), 0),
       updated_at = now()
     where id = liq_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_liq_total on public.caja_chica_liq_rows;
create trigger trg_recalc_liq_total
  after insert or update or delete on public.caja_chica_liq_rows
  for each row execute function public.recalc_caja_chica_liq_total();

-- Sync vale.liquidacion_id and status when vale_serial is set/unset.
create or replace function public.sync_vale_liquidacion_link()
returns trigger language plpgsql as $$
begin
  -- Si cambió el vale_serial, desligar el viejo y ligar el nuevo
  if (tg_op = 'UPDATE' and coalesce(old.vale_serial,'') <> coalesce(new.vale_serial,''))
     or tg_op = 'INSERT' then
    if old is not null and old.vale_serial is not null and old.vale_serial <> '' then
      update public.caja_chica_vales
         set liquidacion_id = null,
             estado = 'Aprobado'
       where serial = old.vale_serial and liquidacion_id = old.id;
    end if;
    if new.vale_serial is not null and new.vale_serial <> '' then
      update public.caja_chica_vales
         set liquidacion_id = new.id,
             estado = 'Asignado a Liquidación'::vale_status
       where serial = new.vale_serial;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_vale_link on public.caja_chica_liquidaciones;
create trigger trg_sync_vale_link
  after insert or update of vale_serial, id on public.caja_chica_liquidaciones
  for each row execute function public.sync_vale_liquidacion_link();

------------------------------------------------------------------
-- 5) CEA · Lavandería — 5-step workflow
------------------------------------------------------------------
alter table public.lavanderia
  add column if not exists step_idx int not null default 0,
  add column if not exists step_dates text[] default '{}'::text[],
  add column if not exists deleted_at timestamptz;

------------------------------------------------------------------
-- 6) CEA · To-dos — extended prioridad/estado labels
------------------------------------------------------------------
alter table public.cea_todos
  add column if not exists prioridad_label text default 'Media',
  add column if not exists estado_label    text default 'Comentado';

------------------------------------------------------------------
-- 7) Pagos — 6-step workflow + tipo_label
------------------------------------------------------------------
alter table public.pagos
  add column if not exists step_idx     int not null default 0,
  add column if not exists step_dates   text[] default '{}'::text[],
  add column if not exists tipo_label   text,
  add column if not exists comprobante_storage_path text,
  add column if not exists serial       text;

-- Sequence + per-year serial for pagos (SP-YYYY-NNNN).
create sequence if not exists seq_pago_yr;
alter table public.pagos
  alter column serial set default ('SP-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_pago_yr')::text, 4, '0'));

------------------------------------------------------------------
-- 8) Firmas — link table already exists (firma_miembros).
--    Add convenience columns if missing.
------------------------------------------------------------------
alter table public.firmas
  add column if not exists serial text;

create sequence if not exists seq_firma_yr;
alter table public.firmas
  alter column serial set default ('FR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('seq_firma_yr')::text, 4, '0'));

------------------------------------------------------------------
-- 9) RLS for caja_chica_liq_rows (mirrors liquidaciones policy)
------------------------------------------------------------------
alter table public.caja_chica_liq_rows enable row level security;

drop policy if exists "liq_rows read" on public.caja_chica_liq_rows;
create policy "liq_rows read" on public.caja_chica_liq_rows
  for select using (true);

drop policy if exists "liq_rows write" on public.caja_chica_liq_rows;
create policy "liq_rows write" on public.caja_chica_liq_rows
  for all using (
    exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol in ('admin','asistente'))
  ) with check (
    exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol in ('admin','asistente'))
  );

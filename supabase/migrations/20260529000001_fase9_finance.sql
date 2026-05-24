-- Phase 9 - Financial module adjustments

-- 1) Missing FKs
alter table public.caja_chica_vales
  add column if not exists liquidacion_id uuid references public.caja_chica_liquidaciones(id);
create index if not exists caja_chica_vales_liquidacion_idx on public.caja_chica_vales(liquidacion_id);

alter table public.pagos
  add column if not exists consumo_id uuid references public.tc_consumos(id);
create index if not exists pagos_consumo_idx on public.pagos(consumo_id);

-- 2) Server-side serial defaults (no concurrent duplicates)
alter table public.caja_chica_vales
  alter column serial set default 'CC-' || lpad(nextval('seq_cc_vale')::text, 4, '0');

alter table public.tc_consumos
  alter column voucher_num set default 'VCH-' || lpad(nextval('seq_voucher')::text, 4, '0');

-- 3) Expand vale_status enum to the 8 values used in the UI
alter type vale_status add value if not exists 'EnLiquidacion';
alter type vale_status add value if not exists 'Pagado';
alter type vale_status add value if not exists 'Reintegrado';
alter type vale_status add value if not exists 'Cancelado';

-- 4) New pago_estado enum (6 values)
do $$ begin
  if not exists (select 1 from pg_type where typname='pago_estado') then
    create type pago_estado as enum ('Programado','Aprobado','Pagado','Conciliado','Anulado','Devuelto');
  end if;
end; $$;

-- 5) Add columns to pagos for cotizacion, anticipo, entidad, estado, etc.
alter table public.pagos add column if not exists estado pago_estado not null default 'Programado';
alter table public.pagos add column if not exists nit text;
alter table public.pagos add column if not exists entidad text;
alter table public.pagos add column if not exists entidad_id uuid references public.entidades(id);
alter table public.pagos add column if not exists cotizacion numeric(12,6);
alter table public.pagos add column if not exists pct_anticipo numeric(5,2) default 0;
alter table public.pagos add column if not exists pct_pendiente numeric(5,2);

-- 6) vouchers: pagado_por
alter table public.vouchers add column if not exists pagado_por text;

-- 7) Verify audit triggers exist on the 6 financial tables; re-attach if missing.
do $$
declare
  t text;
  trg text;
  tables text[] := array['tc_consumos','reintegros','caja_chica_vales','caja_chica_liquidaciones','pagos','vouchers'];
begin
  foreach t in array tables loop
    trg := 'audit_' || t;
    if not exists (
      select 1 from pg_trigger
      where tgname = trg and tgrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'create trigger %I after insert or update or delete on public.%I
          for each row execute function public.audit_trigger()',
        trg, t
      );
    end if;
  end loop;
end; $$;

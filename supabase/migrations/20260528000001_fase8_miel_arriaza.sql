-- Phase 8 - Miel SJ + Arriaza T&T schema adjustments

-- ============================================================
-- MIEL SJ - constancias
-- ============================================================
-- Drop unused columns (replaced by 475g/1000g line items)
alter table public.miel_constancias drop column if exists nit;
alter table public.miel_constancias drop column if exists producto;
alter table public.miel_constancias drop column if exists presentacion;
alter table public.miel_constancias drop column if exists cantidad;
alter table public.miel_constancias drop column if exists unidad;
alter table public.miel_constancias drop column if exists precio_unit;

-- Renames: cliente -> nombre (destinatario), monto_total -> total
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='miel_constancias' and column_name='cliente')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='miel_constancias' and column_name='nombre') then
    alter table public.miel_constancias rename column cliente to nombre;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='miel_constancias' and column_name='monto_total')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='miel_constancias' and column_name='total') then
    alter table public.miel_constancias rename column monto_total to total;
  end if;
end; $$;

-- Line items (cant/precio for the two fixed presentations)
alter table public.miel_constancias add column if not exists cant475 numeric(10,2) not null default 0;
alter table public.miel_constancias add column if not exists precio475 numeric(14,2) not null default 0;
alter table public.miel_constancias add column if not exists cant1000 numeric(10,2) not null default 0;
alter table public.miel_constancias add column if not exists precio1000 numeric(14,2) not null default 0;

-- Envio
alter table public.miel_constancias add column if not exists envio boolean not null default false;
alter table public.miel_constancias add column if not exists envio_dir text;
alter table public.miel_constancias add column if not exists envio_costo numeric(14,2) not null default 0;

-- People
alter table public.miel_constancias add column if not exists entregado text;
alter table public.miel_constancias add column if not exists recibido text;

-- Ensure 'total' exists (in case the rename didn't apply because monto_total was already total)
alter table public.miel_constancias add column if not exists total numeric(14,2) not null default 0;

-- Server-side serial generation (no concurrent duplicates)
alter table public.miel_constancias
  alter column correlativo set default 'MSJ-' || lpad(nextval('seq_miel_corr')::text, 4, '0');

-- ============================================================
-- ARRIAZA T&T - viajes (add reason / paidby / lat / lng)
-- ============================================================
alter table public.att_viajes add column if not exists other_reason text;
alter table public.att_viajes add column if not exists paidby text;
alter table public.att_viajes add column if not exists lat double precision;
alter table public.att_viajes add column if not exists lng double precision;

-- ============================================================
-- ARRIAZA T&T - tickets (add tipo de vuelo, número de vuelo, comentarios)
-- ============================================================
alter table public.att_tickets add column if not exists tipo_vuelo text default 'ida_vuelta';
alter table public.att_tickets add column if not exists numero_vuelo text;
alter table public.att_tickets add column if not exists comentarios text;

-- ============================================================
-- ARRIAZA T&T - hoteles
-- ============================================================
alter table public.att_hoteles add column if not exists location text;
alter table public.att_hoteles add column if not exists nights integer;
alter table public.att_hoteles add column if not exists room text;
alter table public.att_hoteles add column if not exists rate numeric(14,2);
alter table public.att_hoteles add column if not exists ota text;
alter table public.att_hoteles add column if not exists pay text;
alter table public.att_hoteles add column if not exists services text;
alter table public.att_hoteles add column if not exists cancel_policy text;

-- ============================================================
-- ARRIAZA T&T - restaurantes
-- ============================================================
alter table public.att_restaurantes add column if not exists specialty text;
alter table public.att_restaurantes add column if not exists phone text;
alter table public.att_restaurantes add column if not exists email text;
alter table public.att_restaurantes add column if not exists location text;
alter table public.att_restaurantes add column if not exists hora time;
alter table public.att_restaurantes add column if not exists covers integer;
alter table public.att_restaurantes add column if not exists conf text;
alter table public.att_restaurantes add column if not exists detalles text;
alter table public.att_restaurantes add column if not exists cancel_policy text;
alter table public.att_restaurantes add column if not exists stars integer;

-- ============================================================
-- att_pins: redundant — map markers derive from att_viajes (lat/lng).
-- Keep the table for now (it has RLS/triggers) but no code uses it.
-- A future cleanup migration can drop it.
-- ============================================================

-- ============================================================
-- Comment on policies: miel_constancias and att_* were created as catalog
-- pattern (read all authenticated, write admin only) in Phase 3.
-- For Phase 8 they should also be writable by asistente, since CEA manages
-- Miel and Arriaza day-to-day. Adjust policies.
-- ============================================================
do $$
declare
  t text;
  tables text[] := array['miel_constancias','att_viajes','att_tickets','att_hoteles','att_restaurantes'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all
        using ( public.auth_rol() in (''admin'',''asistente'') )
        with check ( public.auth_rol() in (''admin'',''asistente'') )',
      t || '_write', t
    );
  end loop;
end; $$;

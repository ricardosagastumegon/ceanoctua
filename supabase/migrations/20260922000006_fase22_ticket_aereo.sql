-- Fase 22-1 · Modelo completo del servicio Ticket Aéreo
--
-- El ticket que había era el de la Fase 13, pensado para control migratorio:
-- vencimiento de pasaporte, libreta, visa, programa de viajero. El documento
-- TT_SERVICIOS-Ticket_Aéreos.docx pide otra cosa — equipaje, tarifa y extras
-- por pasajero, escalas, varios PNR y adjuntos.
--
-- Nada del modelo viejo se borra: las columnas de pasaporte y visa se quedan
-- por si se necesitan para trámites migratorios. El formulario simplemente
-- deja de pedirlas.
--
-- Hoy hay 0 tickets en la base, así que no hay datos que migrar.
--
-- Idempotente: add column if not exists + create table if not exists.

-- ============================================================
-- 1) att_tickets — encabezado, tipo de vuelo, pago y adjuntos
-- ============================================================
alter table public.att_tickets
  add column if not exists titulo text,
  add column if not exists reservado_por text,
  add column if not exists categoria text,
  add column if not exists tipo_ticket text,
  add column if not exists vuelo_directo boolean,
  add column if not exists num_escalas int,
  add column if not exists checkin_ini time,
  add column if not exists checkin_fin time,
  add column if not exists estatus_pago text,
  add column if not exists formas_pago text[],
  add column if not exists penalidad_desc text,
  add column if not exists penalidad_monto numeric(14,2),
  add column if not exists pagado_con_tc_id uuid,
  add column if not exists pdf_boleto_path text,
  add column if not exists pdf_boarding_path text,
  add column if not exists pdf_sat_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'att_tickets_categoria_chk'
  ) then
    alter table public.att_tickets add constraint att_tickets_categoria_chk
      check (categoria is null or categoria in
        ('Económica', 'Premium Economy', 'Ejecutiva', 'Primera Clase'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'att_tickets_tipo_ticket_chk'
  ) then
    alter table public.att_tickets add constraint att_tickets_tipo_ticket_chk
      check (tipo_ticket is null or tipo_ticket in ('OW', 'RT'));
  end if;

  -- Lista unificada de estatus de pago para TODOS los servicios del módulo
  -- (decisión del usuario, 2026-09-22). Las cinco primeras salen del documento
  -- del ticket; "A PAGAR EN PROPIEDAD" se conserva porque es un estado real de
  -- los hoteles que la lista del documento no cubre.
  if not exists (
    select 1 from pg_constraint where conname = 'att_tickets_estatus_pago_chk'
  ) then
    alter table public.att_tickets add constraint att_tickets_estatus_pago_chk
      check (estatus_pago is null or estatus_pago in
        ('HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO',
         'A PAGAR EN PROPIEDAD'));
  end if;
end $$;

comment on column public.att_tickets.monto is
  'Derivado: suma de (tarifa + extras) de cada pasajero. Se recalcula al guardar.';

-- ============================================================
-- 2) att_ticket_segments — ruta y segunda fecha
--    `fecha` pasa a ser la de salida; `direccion` ya distingue ida/retorno.
-- ============================================================
alter table public.att_ticket_segments
  add column if not exists ruta text,
  add column if not exists fecha_llegada date;

-- ============================================================
-- 3) att_ticket_pax — equipaje, tarifas y datos por pasajero
-- ============================================================
alter table public.att_ticket_pax
  add column if not exists nacionalidades text[],
  add column if not exists numero_ticket text,
  add column if not exists asiento text,
  add column if not exists eq_personal text,
  add column if not exists eq_carryon text,
  add column if not exists eq_documentado text,
  add column if not exists tarifa numeric(14,2),
  add column if not exists tarifa_nota text,
  add column if not exists extras numeric(14,2),
  add column if not exists extras_nota text;

comment on column public.att_ticket_pax.nacionalidad is
  'DEPRECADA (fase 22) — usar nacionalidades[] con códigos ISO alfa-3 de pasaporte.';

-- ============================================================
-- 4) att_ticket_pnrs — un ticket (o un segmento) puede tener varios PNR
-- ============================================================
create table if not exists public.att_ticket_pnrs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.att_tickets(id) on delete cascade,
  -- null = PNR del ticket completo; con valor = PNR de ese segmento
  segmento_id uuid references public.att_ticket_segments(id) on delete cascade,
  codigo text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 5) att_segmento_escalas — escalas de un segmento
-- ============================================================
create table if not exists public.att_segmento_escalas (
  id uuid primary key default gen_random_uuid(),
  segmento_id uuid not null references public.att_ticket_segments(id) on delete cascade,
  iata text,
  ciudad text,
  tiempo text,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create index if not exists att_ticket_pnrs_ticket_id_idx
  on public.att_ticket_pnrs(ticket_id) where deleted_at is null;
create index if not exists att_ticket_pnrs_segmento_id_idx
  on public.att_ticket_pnrs(segmento_id) where deleted_at is null;
create index if not exists att_segmento_escalas_segmento_id_idx
  on public.att_segmento_escalas(segmento_id) where deleted_at is null;

-- ============================================================
-- 6) RLS Pattern A + triggers en las dos tablas nuevas
-- ============================================================
do $$
declare
  t text;
  new_tables text[] := array['att_ticket_pnrs', 'att_segmento_escalas'];
begin
  foreach t in array new_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.auth_rol() in (''admin'',''asistente''))',
      t || '_read', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.auth_rol() in (''admin'',''asistente''))
         with check (public.auth_rol() in (''admin'',''asistente''))',
      t || '_write', t
    );

    execute format('drop trigger if exists %I on public.%I', t || '_updated_at_trg', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at_with_by()',
      t || '_updated_at_trg', t
    );

    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      'audit_' || t, t
    );
  end loop;
end $$;

-- ============================================================
-- 7) Bucket propio para los PDF de T&T
--
--    El usuario pidió que estos archivos vivan estrictamente dentro de T&T y
--    NO en el bucket `documentos`, que es el de Finanzas. Separarlos por bucket
--    y no por carpeta hace que la separación la imponga la política, no la
--    disciplina de quien sube el archivo.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tt-documentos', 'tt-documentos', false)
on conflict (id) do nothing;

drop policy if exists "tt-documentos read" on storage.objects;
create policy "tt-documentos read" on storage.objects for select
  using (bucket_id = 'tt-documentos' and auth.uid() is not null);

drop policy if exists "tt-documentos insert" on storage.objects;
create policy "tt-documentos insert" on storage.objects for insert
  with check (bucket_id = 'tt-documentos' and public.auth_rol() in ('admin', 'asistente'));

drop policy if exists "tt-documentos update" on storage.objects;
create policy "tt-documentos update" on storage.objects for update
  using (bucket_id = 'tt-documentos' and public.auth_rol() in ('admin', 'asistente'))
  with check (bucket_id = 'tt-documentos' and public.auth_rol() in ('admin', 'asistente'));

drop policy if exists "tt-documentos delete" on storage.objects;
create policy "tt-documentos delete" on storage.objects for delete
  using (bucket_id = 'tt-documentos' and public.auth_rol() in ('admin', 'asistente'));

NOTIFY pgrst, 'reload schema';

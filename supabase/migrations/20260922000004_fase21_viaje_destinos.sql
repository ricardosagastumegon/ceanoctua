-- Fase 21-1 · Destinos múltiples del viaje (países, ciudades y paradas)
--
-- Objetivo: el documento TT_Dashboard_inicial.docx pide que un viaje pueda ir a
-- varios países, tener varias ciudades destino, y llevar paradas (sub-destinos)
-- con su propia ventana de fechas. Hoy `att_viajes` guarda un solo `pais` y una
-- sola `ciudad` en texto plano.
--
-- Regla 0 aplicada a las 3 tablas nuevas:
--   - PK uuid, viaje_id references att_viajes on delete cascade
--   - AuditCols completos: created_at, updated_at, created_by, updated_by, deleted_at
--   - Índice por viaje_id where deleted_at is null
--   - Trigger audit_trigger (audit_log) + set_updated_at_with_by
--   - RLS Pattern A (Financial): admin + asistente rw
--
-- Por qué ciudades y paradas son tablas separadas: el documento las pide como
-- dos campos distintos y solo las paradas llevan fechas. Si con el uso resulta
-- que toda ciudad termina teniendo fechas, se fusionan y se borra la otra.
--
-- Idempotente: create table if not exists + drop policy/trigger if exists.

-- ============================================================
-- 1) att_viaje_paises — un viaje puede ir a varios países.
--    El de orden = 0 es el destino principal: su código es el que la tarjeta
--    muestra junto al nombre y su país el que marca el pin del mapa.
-- ============================================================
create table if not exists public.att_viaje_paises (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint att_viaje_paises_codigo_len check (char_length(codigo) between 2 and 3)
);

-- ============================================================
-- 2) att_viaje_ciudades — ciudades destino, con botón "agregar" en el form.
-- ============================================================
create table if not exists public.att_viaje_ciudades (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  nombre text not null,
  pais_codigo text,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 3) att_viaje_paradas — sub-destinos con ventana de fechas propia.
-- ============================================================
create table if not exists public.att_viaje_paradas (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  nombre text not null,
  pais_codigo text,
  fecha_ini date,
  fecha_fin date,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint att_viaje_paradas_fechas check (
    fecha_ini is null or fecha_fin is null or fecha_fin >= fecha_ini
  )
);

-- ============================================================
-- 4) Índices
-- ============================================================
create index if not exists att_viaje_paises_viaje_id_idx
  on public.att_viaje_paises(viaje_id) where deleted_at is null;
create index if not exists att_viaje_ciudades_viaje_id_idx
  on public.att_viaje_ciudades(viaje_id) where deleted_at is null;
create index if not exists att_viaje_paradas_viaje_id_idx
  on public.att_viaje_paradas(viaje_id) where deleted_at is null;

-- ============================================================
-- 5) RLS Pattern A + triggers de auditoría
-- ============================================================
do $$
declare
  t text;
  new_tables text[] := array[
    'att_viaje_paises',
    'att_viaje_ciudades',
    'att_viaje_paradas'
  ];
begin
  if not exists (select 1 from pg_proc where proname = 'audit_trigger') then
    raise exception 'audit_trigger() no existe — falta correr la migración fase 3';
  end if;
  if not exists (select 1 from pg_proc where proname = 'set_updated_at_with_by') then
    raise exception 'set_updated_at_with_by() no existe — falta correr la migración fase 4';
  end if;
  if not exists (select 1 from pg_proc where proname = 'auth_rol') then
    raise exception 'public.auth_rol() no existe — falta correr la migración fase 3';
  end if;

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
-- 6) Backfill — los viajes que ya existen no pueden perder su destino.
--    Copia pais/ciudad a las tablas nuevas como orden = 0. Solo si la tabla
--    nueva todavía no tiene nada para ese viaje, para que re-aplicar la
--    migración no duplique filas.
-- ============================================================
insert into public.att_viaje_paises (viaje_id, codigo, nombre, orden)
select v.id,
       upper(left(v.pais, 2)),
       v.pais,
       0
  from public.att_viajes v
 where v.deleted_at is null
   and v.pais is not null
   and btrim(v.pais) <> ''
   and not exists (
     select 1 from public.att_viaje_paises p
      where p.viaje_id = v.id and p.deleted_at is null
   );

insert into public.att_viaje_ciudades (viaje_id, nombre, orden)
select v.id,
       coalesce(nullif(btrim(v.ciudad), ''), btrim(v.destino)),
       0
  from public.att_viajes v
 where v.deleted_at is null
   and coalesce(nullif(btrim(v.ciudad), ''), nullif(btrim(v.destino), '')) is not null
   and not exists (
     select 1 from public.att_viaje_ciudades c
      where c.viaje_id = v.id and c.deleted_at is null
   );

-- ============================================================
-- 7) Marcar las columnas viejas como deprecadas.
--    No se borran todavía: primero el frontend tiene que dejar de leerlas.
-- ============================================================
comment on column public.att_viajes.pais is
  'DEPRECADA (fase 21) — usar att_viaje_paises. Se elimina cuando el frontend deje de leerla.';
comment on column public.att_viajes.ciudad is
  'DEPRECADA (fase 21) — usar att_viaje_ciudades. Se elimina cuando el frontend deje de leerla.';
comment on column public.att_viajes.destino is
  'DEPRECADA (fase 21) — usar att_viaje_ciudades. Se elimina cuando el frontend deje de leerla.';

NOTIFY pgrst, 'reload schema';

-- Fase 45 · Control de combustible de vehiculos
--
-- La cadena que hoy vive en papel y en un Excel:
--
--   SOLICITUD DE VALE  ->  VALE  ->  RECIBO DE DESPACHO  ->  FACTURA
--   (la emite CEA)         (la gasolinera, via el Tesorero)
--                                    -> CONTRASEÑA DE PAGO
--                                    -> CONTROL DE VALES (quincenal)
--                                    -> SOLICITUD DE PAGO (modulo PAGOS, ya existe)
--
-- Tres cosas lo distinguen de todo lo demas del sistema:
--
--  1. ES A CREDITO. No es un adelanto de efectivo (caja chica) ni un deposito
--     previo (aeronaves). Se consume primero y se paga despues, por quincena.
--  2. EL DOCUMENTO SALE Y VUELVE. La solicitud la emite Angeles y la ejecuta
--     el Tesorero. Ese viaje se vuelve digital con `envios`.
--  3. TIENE DOS FORMATOS OFICIALES que hay que replicar exactos:
--     OL-RG-0175 (solicitud de vale) y OL-RG-0270 (control de vales).
--
-- LO QUE NO ES: administracion de flota. La usuaria dijo expresamente que no
-- lleva la informacion de los vehiculos. Las columnas de kilometraje existen
-- porque estan en el formato oficial, no porque se vaya a analizar nada.
--
--
-- POR QUE EL VALE DE CAJA CHICA NO SIRVE
--
-- Se evaluo y se descarto. `caja_chica_vales` (VL-2026-####) es un adelanto de
-- efectivo que luego se liquida contra facturas. Este es un consumo a credito
-- contra un documento de un tercero --la gasolinera-- que ni siquiera emite
-- CEA. Mismo nombre, cosas distintas. La usuaria lo confirmo el 5 nov 2026:
-- «el vale que hoy existe NO aplica, no es igual».
--
--
-- POR QUE UNA SOLA TABLA PARA CUATRO DOCUMENTOS
--
-- Los documentos de ejemplo lo demuestran: el recibo de despacho dice Q50.09,
-- la factura dice Q50.09 y la contraseña dice Q50.09 sobre el documento
-- 657409232. Son el mismo consumo visto cuatro veces. Partirlo en cuatro
-- tablas seria modelar la papeleria, no el hecho.

-- ══════════════════════════════════════════════════════════════════════
-- 0 · CORRECCION a 20261105000003_envios.sql
-- ══════════════════════════════════════════════════════════════════════
--
-- La prueba en seco de esta migracion destapo un agujero en la anterior, que
-- ya estaba aplicada. Se corrige aqui, en la misma fase, en vez de editar el
-- archivo ya aplicado --que entonces mentiria sobre lo que corrio.
--
-- EL PROBLEMA. La comprobacion era:
--
--     if v_envio.destinatario_id <> auth.uid() and not public.es_admin()
--     then raise exception ...
--
-- Con `auth.uid()` NULO --una sesion sin JWT-- `destinatario_id <> null` da
-- NULL, no TRUE. `NULL and true` da NULL, y un `if NULL` NO entra. O sea: la
-- comprobacion dejaba pasar justo al que no se habia identificado.
--
-- Y era alcanzable: se verifico que el rol `anon` tiene permiso de ejecucion
-- sobre la funcion (PostgREST expone las funciones como RPC). Quien tuviera
-- la clave publica y adivinara el UUID de un envio podia aceptarlo.
--
-- Explotarlo exige adivinar un uuid v4, que no es realista. Pero apoyarse en
-- eso no es una defensa, es una esperanza.
--
-- LA CORRECCION, por los dos lados:
--   1. Exigir sesion explicitamente, antes de comparar nada.
--   2. Quitarle a `anon` el permiso de ejecucion: estas funciones son de
--      usuarios identificados.

create or replace function public.envio_aceptar(
  p_envio uuid,
  p_datos jsonb default '{}'::jsonb,
  p_nota  text  default null
)
returns public.envios
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_envio public.envios;
  v_fn    text;
begin
  -- Primero lo primero: sin sesion no se acepta nada. Va antes de cualquier
  -- comparacion para que ningun NULL se cuele por la logica de tres valores.
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesion para aceptar un envio.';
  end if;

  select * into v_envio
    from public.envios
   where id = p_envio and deleted_at is null
     for update;

  if not found then
    raise exception 'El envio no existe o fue retirado.';
  end if;

  if v_envio.destinatario_id <> auth.uid() and not public.es_admin() then
    raise exception 'Este envio no es suyo.';
  end if;

  if v_envio.estado <> 'enviado' then
    raise exception 'El envio % ya fue %; no se puede aceptar de nuevo.',
      v_envio.serial, v_envio.estado;
  end if;

  update public.envios
     set estado       = 'aceptado',
         resuelto_at  = now(),
         resuelto_por = auth.uid(),
         datos        = coalesce(p_datos, '{}'::jsonb),
         nota         = coalesce(p_nota, nota),
         updated_by   = auth.uid()
   where id = p_envio
  returning * into v_envio;

  v_fn := 'envio_despacho_' || v_envio.doc_tipo;

  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn
  ) then
    execute format('select public.%I($1)', v_fn) using v_envio;
  end if;

  return v_envio;
end $$;

create or replace function public.envio_rechazar(
  p_envio uuid,
  p_nota  text default null
)
returns public.envios
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_envio public.envios;
begin
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesion para rechazar un envio.';
  end if;

  select * into v_envio
    from public.envios
   where id = p_envio and deleted_at is null
     for update;

  if not found then
    raise exception 'El envio no existe o fue retirado.';
  end if;

  if v_envio.destinatario_id <> auth.uid() and not public.es_admin() then
    raise exception 'Este envio no es suyo.';
  end if;

  if v_envio.estado <> 'enviado' then
    raise exception 'El envio % ya fue %.', v_envio.serial, v_envio.estado;
  end if;

  update public.envios
     set estado       = 'rechazado',
         resuelto_at  = now(),
         resuelto_por = auth.uid(),
         nota         = coalesce(p_nota, nota),
         updated_by   = auth.uid()
   where id = p_envio
  returning * into v_envio;

  return v_envio;
end $$;

-- Ojo con esto: `anon` tiene el permiso por DOS vias --un grant propio y la
-- herencia de PUBLIC-- y revocar una sola no sirve de nada. Hay que quitar
-- las dos y volver a conceder a `authenticated`, que es quien si debe poder.
revoke execute on function public.envio_aceptar(uuid, jsonb, text) from public, anon;
revoke execute on function public.envio_rechazar(uuid, text)       from public, anon;
grant  execute on function public.envio_aceptar(uuid, jsonb, text) to authenticated;
grant  execute on function public.envio_rechazar(uuid, text)       to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 1 · comb_responsables  --  los cuadros del control de vales
-- ══════════════════════════════════════════════════════════════════════
--
-- Esto es, literalmente, lo que esta marcado EN ROJO en la hoja de la
-- usuaria. Se verifico celda por celda: el rojo son las fechas del periodo y,
-- por cuadro, la marca, el tipo, el puesto, el nombre y la placa. Su nota al
-- pie dice «una hoja debe de llevar 6 cuadros para registrar los vales».
--
-- Es catalogo y no seccion del reporte porque el cuadro ES un responsable con
-- su vehiculo asignado, y porque asi da igual que sean cinco, seis o siete.

create table if not exists public.comb_responsables (
  id uuid primary key default gen_random_uuid(),

  -- De aqui salen nombre y puesto. Nulo en los cuadros que no son de una
  -- persona fija ("OTROS", "DEPARTAMENTO DE COMPRAS").
  empleado_id uuid references public.empleados(id),

  -- El titulo del cuadro cuando no lo da un empleado.
  etiqueta text,

  -- Sobrescribe el puesto del empleado si el formato pide otro texto.
  -- Ej: el empleado dice "Compras" y el formato dice "Departamento de Compras".
  puesto_label text,

  -- NULO = cuadro de «vehiculos varios»: el carro cambia en cada renglon.
  vehiculo_id uuid references public.vehiculos(id),

  -- Decide QUE COLUMNAS imprime el cuadro, que no son las mismas:
  --   vehiculo_asignado -> Km x Gl anterior/actual, Kms recorridos, Km x Gl
  --   varios            -> Vehiculo, Propietario, Observaciones, Placa
  tipo_bloque text not null default 'vehiculo_asignado'
    check (tipo_bloque in ('vehiculo_asignado','varios')),

  orden int not null default 0,
  activo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- Un cuadro sin empleado tiene que traer etiqueta, o sale sin titulo.
alter table public.comb_responsables
  drop constraint if exists comb_responsables_titulo_chk;
alter table public.comb_responsables
  add constraint comb_responsables_titulo_chk
  check (empleado_id is not null or nullif(trim(etiqueta), '') is not null);

-- Un cuadro de vehiculo asignado sin vehiculo no puede imprimir su encabezado.
alter table public.comb_responsables
  drop constraint if exists comb_responsables_vehiculo_chk;
alter table public.comb_responsables
  add constraint comb_responsables_vehiculo_chk
  check (tipo_bloque = 'varios' or vehiculo_id is not null);

create index if not exists comb_responsables_orden_idx
  on public.comb_responsables (orden) where deleted_at is null and activo;

comment on table public.comb_responsables is
  'Los cuadros del control de vales OL-RG-0270. Un cuadro por responsable con su vehiculo. Es lo que la usuaria marca en rojo en su hoja: lo que cambia de un cuadro a otro.';
comment on column public.comb_responsables.tipo_bloque is
  'Decide que columnas imprime el cuadro. Los de vehiculo asignado llevan kilometraje; los de varios llevan vehiculo, propietario y placa por renglon.';

-- ══════════════════════════════════════════════════════════════════════
-- 2 · comb_solicitudes  --  el expediente que viaja
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.comb_solicitudes (
  id uuid primary key default gen_random_uuid(),
  serial text unique,

  -- ── Lo que llena Angeles al crearla (formato OL-RG-0175) ──────────
  fecha date not null default current_date,
  responsable_id uuid references public.comb_responsables(id),
  vehiculo_id uuid references public.vehiculos(id),

  -- «Vale a:» del formato. Texto porque el chofer no siempre es empleado.
  vale_a text,
  solicitado_por_id uuid references public.empleados(id),
  departamento text,
  justificacion text,

  -- «Autorizado por: Lissa Arriaza». Personal JD es la UNICA fuente de
  -- autorizadores (invariante 4 de CLAUDE.md).
  autorizado_por_id uuid references public.personas(id),

  monto_autorizado numeric(14,2),
  kilometraje_actual numeric(12,1),
  km_ultima_llenada numeric(12,1),

  -- ── Lo que llena el TESORERO al entregar el vale ──────────────────
  vale_num text,
  vale_fecha date,
  vale_emitido_por uuid references public.usuarios(id),

  -- ── Lo que vuelve con el chofer: el recibo de despacho ────────────
  recibo_num text,
  recibo_fecha date,
  producto text,
  galones numeric(12,3),
  precio_galon numeric(12,4),
  bomba text,
  manguera text,

  -- EL MONTO QUE SUMA EL REPORTE. Es el del despacho, no el de la factura.
  -- Si una factura cubre dos despachos del mismo dia --la usuaria confirmo
  -- que pasa-- sumar facturas duplicaria el total.
  monto numeric(14,2),

  -- ── La factura ────────────────────────────────────────────────────
  proveedor_id uuid references public.proveedores(id),
  factura_serie text,
  factura_numero text,
  factura_fecha date,
  -- Referencia, NO sumando: puede repetirse en dos solicitudes.
  factura_monto numeric(14,2),

  -- ── La contraseña de pago ─────────────────────────────────────────
  -- Una por factura (confirmado). NO aparece en el control de vales: se
  -- captura para el expediente y se adjunta en fisico.
  contrasena_num text,
  contrasena_fecha date,
  contrasena_vencimiento date,

  -- ── Solo para los cuadros de «vehiculos varios» ───────────────────
  vehiculo_desc text,
  propietario text,
  placa_libre text,
  observaciones text,

  -- ── Donde esta en su vida ─────────────────────────────────────────
  estado text not null default 'borrador'
    check (estado in (
      'borrador',          -- se esta escribiendo
      'enviada_tesorero',  -- esta en la bandeja de el
      'vale_emitido',      -- el registro el numero del vale
      'despachada',        -- volvio con su recibo de despacho
      'documentada',       -- con factura y contraseña; lista para el reporte
      'en_reporte',        -- entro en un control de vales cerrado
      'en_tesoreria',      -- la SP del reporte la acepto el Tesorero
      'pagada',            -- la SP se pago
      'anulada'
    )),

  reporte_id uuid,  -- FK despues de crear comb_reportes

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.comb_solicitudes
  drop constraint if exists comb_solicitudes_monto_chk;
alter table public.comb_solicitudes
  add constraint comb_solicitudes_monto_chk
  check (monto is null or monto > 0);

alter table public.comb_solicitudes
  drop constraint if exists comb_solicitudes_galones_chk;
alter table public.comb_solicitudes
  add constraint comb_solicitudes_galones_chk
  check (galones is null or galones > 0);

create index if not exists comb_solicitudes_estado_idx
  on public.comb_solicitudes (estado, fecha desc) where deleted_at is null;
create index if not exists comb_solicitudes_reporte_idx
  on public.comb_solicitudes (reporte_id) where deleted_at is null;
create index if not exists comb_solicitudes_responsable_idx
  on public.comb_solicitudes (responsable_id) where deleted_at is null;

comment on table public.comb_solicitudes is
  'Un expediente de combustible: solicitud de vale, vale, recibo de despacho, factura y contraseña. Una sola fila porque los cuatro documentos describen el mismo consumo.';
comment on column public.comb_solicitudes.monto is
  'El monto DEL DESPACHO. Es el que suma el control de vales. factura_monto no suma: una factura puede cubrir dos despachos del mismo dia.';

-- ══════════════════════════════════════════════════════════════════════
-- 3 · comb_reportes  --  el control de vales quincenal (OL-RG-0270)
-- ══════════════════════════════════════════════════════════════════════
--
-- Los cuadros NO se guardan: se derivan agrupando las solicitudes del periodo
-- por responsable. Asi el total siempre cuadra con sus renglones y no hay dos
-- verdades que puedan separarse.

create table if not exists public.comb_reportes (
  id uuid primary key default gen_random_uuid(),
  serial text unique,

  periodo_ini date not null,
  periodo_fin date not null,

  -- «Realizado Por: Angeles Quezada / Asistente de Gerencias»
  realizado_por_id uuid references public.empleados(id),

  estado text not null default 'abierto'
    check (estado in ('abierto','cerrado','enviado_a_pagos','en_tesoreria','pagado')),

  -- Se congela al cerrar. Despues no se recalcula: es un documento emitido.
  total numeric(14,2),

  notificacion_id uuid references public.pagos_notificaciones(id),
  pago_id uuid references public.pagos(id),

  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.comb_reportes
  drop constraint if exists comb_reportes_periodo_chk;
alter table public.comb_reportes
  add constraint comb_reportes_periodo_chk
  check (periodo_fin >= periodo_ini);

create index if not exists comb_reportes_periodo_idx
  on public.comb_reportes (periodo_ini desc) where deleted_at is null;
create index if not exists comb_reportes_pago_idx
  on public.comb_reportes (pago_id) where deleted_at is null;

comment on table public.comb_reportes is
  'Control de vales de combustible OL-RG-0270, quincenal. Sus cuadros se derivan de las solicitudes del periodo; no se guardan aparte.';

alter table public.comb_solicitudes
  drop constraint if exists comb_solicitudes_reporte_id_fkey;
alter table public.comb_solicitudes
  add constraint comb_solicitudes_reporte_id_fkey
  foreign key (reporte_id) references public.comb_reportes(id);

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Correlativos
-- ══════════════════════════════════════════════════════════════════════

create sequence if not exists public.comb_solicitudes_seq;
create sequence if not exists public.comb_reportes_seq;

create or replace function public.comb_solicitudes_set_serial()
returns trigger language plpgsql as $$
begin
  if new.serial is null or new.serial = '' then
    new.serial := 'SV-' || extract(year from current_date)::int::text || '-'
               || lpad(nextval('public.comb_solicitudes_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function public.comb_reportes_set_serial()
returns trigger language plpgsql as $$
begin
  if new.serial is null or new.serial = '' then
    new.serial := 'CV-' || extract(year from current_date)::int::text || '-'
               || lpad(nextval('public.comb_reportes_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists comb_solicitudes_set_serial on public.comb_solicitudes;
create trigger comb_solicitudes_set_serial
  before insert on public.comb_solicitudes
  for each row execute function public.comb_solicitudes_set_serial();

drop trigger if exists comb_reportes_set_serial on public.comb_reportes;
create trigger comb_reportes_set_serial
  before insert on public.comb_reportes
  for each row execute function public.comb_reportes_set_serial();

-- ══════════════════════════════════════════════════════════════════════
-- 5 · updated_at y auditoria
-- ══════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['comb_responsables','comb_solicitudes','comb_reportes'] loop
    execute format('drop trigger if exists set_updated_at_%1$s on public.%1$I', t);
    execute format(
      'create trigger set_updated_at_%1$s before update on public.%1$I
         for each row execute function public.set_updated_at()', t);

    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════
-- 6 · RLS
-- ══════════════════════════════════════════════════════════════════════
--
-- Estas tablas son del espacio de Angeles. El Tesorero NO las lee: lo que el
-- ve entra por `envios`, con su `snapshot`. Por eso aqui no aparece.

alter table public.comb_responsables enable row level security;
alter table public.comb_solicitudes  enable row level security;
alter table public.comb_reportes     enable row level security;

-- Catalogo (Pattern C): lo lee cualquier sesion, lo escribe quien opera.
drop policy if exists comb_responsables_read on public.comb_responsables;
create policy comb_responsables_read on public.comb_responsables for select
  using (auth.uid() is not null);

drop policy if exists comb_responsables_write on public.comb_responsables;
create policy comb_responsables_write on public.comb_responsables for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- Financiero (Pattern A): ni lectura para quien no opera.
drop policy if exists comb_solicitudes_read on public.comb_solicitudes;
create policy comb_solicitudes_read on public.comb_solicitudes for select
  using (public.auth_rol() in ('admin','asistente'));

drop policy if exists comb_solicitudes_write on public.comb_solicitudes;
create policy comb_solicitudes_write on public.comb_solicitudes for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

drop policy if exists comb_reportes_read on public.comb_reportes;
create policy comb_reportes_read on public.comb_reportes for select
  using (public.auth_rol() in ('admin','asistente'));

drop policy if exists comb_reportes_write on public.comb_reportes;
create policy comb_reportes_write on public.comb_reportes for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- ══════════════════════════════════════════════════════════════════════
-- 7 · Las cascadas
-- ══════════════════════════════════════════════════════════════════════
--
-- `envio_aceptar` busca `envio_despacho_{doc_tipo}` y la llama si existe.
-- Aqui viven las dos que necesita el combustible.

-- ── 7.1 · El Tesorero emite el vale ────────────────────────────────────

create or replace function public.envio_despacho_comb_solicitud(e public.envios)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_num   text := nullif(trim(e.datos ->> 'vale_num'), '');
  v_fecha date := coalesce((e.datos ->> 'vale_fecha')::date, current_date);
begin
  if v_num is null then
    raise exception 'Para aceptar una solicitud de vale hay que registrar el numero del vale que se entrego.';
  end if;

  update public.comb_solicitudes
     set vale_num         = v_num,
         vale_fecha       = v_fecha,
         vale_emitido_por = e.resuelto_por,
         estado           = 'vale_emitido',
         updated_by       = e.resuelto_por
   where id = e.doc_id
     and deleted_at is null
     and estado = 'enviada_tesorero';

  if not found then
    raise exception 'La solicitud ya no esta esperando vale; no se toco nada.';
  end if;
end $$;

comment on function public.envio_despacho_comb_solicitud(public.envios) is
  'El Tesorero acepta una solicitud de vale y registra el numero del vale de la gasolinera que entrego.';

-- ── 7.2 · El Tesorero recibe la Solicitud de Pago ya firmada ───────────
--
-- Pasa la SP a «Procesado» (paso 4 de 6) y arrastra hacia atras el control de
-- vales y todas sus solicitudes. Es lo que la usuaria pidio: que al aceptar el
-- Tesorero, «automaticamente todos los estatus anteriores» se muevan.
--
-- NO salta a «Pagado». El combustible es a credito 30 dias: la contraseña del
-- ejemplo se recibe el 26/10 y vence el 13/11. Entre recibir y pagar hay
-- semanas, y el sistema tiene que poder decir en cual de las dos esta.
--
-- Sobre `step_dates`: es text[] de 6 posiciones. Si viene corto o vacio,
-- asignar por indice deja un array con limite inferior distinto de 1, que
-- luego se lee mal desde el cliente. Por eso se normaliza con generate_series
-- antes de tocarlo --el mismo cuidado que la fase 43.

create or replace function public.envio_despacho_pago(e public.envios)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_orig   text[];
  v_fechas text[];
  v_rep    uuid;
begin
  select coalesce(step_dates, '{}'::text[]) into v_orig
    from public.pagos where id = e.doc_id and deleted_at is null;

  if not found then
    raise exception 'La solicitud de pago ya no existe.';
  end if;

  select array_agg(v_orig[i] order by i) into v_fechas
    from generate_series(1, 6) as i;

  -- step_idx 4 = «Procesado». En el array es la posicion 5 (PG indexa en 1).
  v_fechas[5] := to_char(now(), 'YYYY-MM-DD');

  update public.pagos
     set step_idx   = 4,
         step_dates = v_fechas,
         updated_by = e.resuelto_por
   where id = e.doc_id
     and step_idx < 4;

  -- La cascada hacia atras, solo si el pago salio de un control de vales.
  select id into v_rep
    from public.comb_reportes
   where pago_id = e.doc_id and deleted_at is null;

  if v_rep is not null then
    update public.comb_reportes
       set estado = 'en_tesoreria', updated_by = e.resuelto_por
     where id = v_rep;

    update public.comb_solicitudes
       set estado = 'en_tesoreria', updated_by = e.resuelto_por
     where reporte_id = v_rep and deleted_at is null and estado = 'en_reporte';
  end if;
end $$;

comment on function public.envio_despacho_pago(public.envios) is
  'El Tesorero acepta una SP firmada: la pasa a Procesado y arrastra el control de vales y sus solicitudes. No salta a Pagado porque el credito es a 30 dias.';

-- ── 7.3 · El Tesorero marca la SP como pagada ──────────────────────────
--
-- El otro acto suyo, semanas despues. Cierra la cadena entera.

create or replace function public.pago_marcar_pagado(p_pago uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_orig   text[];
  v_fechas text[];
  v_rep    uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesion.';
  end if;

  -- Solo lo marca quien lo recibio, o el admin.
  if not public.es_admin() and not exists (
    select 1 from public.envios
     where doc_tipo = 'pago' and doc_id = p_pago
       and destinatario_id = auth.uid()
       and estado = 'aceptado' and deleted_at is null
  ) then
    raise exception 'Esta solicitud de pago no esta a su cargo.';
  end if;

  select coalesce(step_dates, '{}'::text[]) into v_orig
    from public.pagos where id = p_pago and deleted_at is null;

  if not found then
    raise exception 'La solicitud de pago ya no existe.';
  end if;

  select array_agg(v_orig[i] order by i) into v_fechas
    from generate_series(1, 6) as i;

  v_fechas[6] := to_char(now(), 'YYYY-MM-DD');

  update public.pagos
     set step_idx   = 5,
         step_dates = v_fechas,
         updated_by = auth.uid()
   where id = p_pago and step_idx < 5;

  select id into v_rep
    from public.comb_reportes
   where pago_id = p_pago and deleted_at is null;

  if v_rep is not null then
    update public.comb_reportes
       set estado = 'pagado', updated_by = auth.uid()
     where id = v_rep;

    update public.comb_solicitudes
       set estado = 'pagada', updated_by = auth.uid()
     where reporte_id = v_rep and deleted_at is null
       and estado in ('en_reporte','en_tesoreria');
  end if;
end $$;

comment on function public.pago_marcar_pagado(uuid) is
  'El Tesorero marca pagada una SP que recibio. Cierra la cascada: el control de vales y sus solicitudes pasan a pagada.';

-- ══════════════════════════════════════════════════════════════════════
-- 8 · Cerrar el control de vales y mandarlo a PAGOS
-- ══════════════════════════════════════════════════════════════════════
--
-- El total se calcula EN EL SERVIDOR y se congela. Es un documento emitido:
-- si se recalculara al leerlo, el papel impreso y la pantalla podrian decir
-- cosas distintas el dia que alguien edite una solicitud vieja.

create or replace function public.comb_cerrar_reporte(p_reporte uuid)
returns public.comb_reportes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rep   public.comb_reportes;
  v_total numeric(14,2);
  v_n     int;
begin
  if public.auth_rol() not in ('admin','asistente') then
    raise exception 'No tiene permiso para cerrar un control de vales.';
  end if;

  select * into v_rep from public.comb_reportes
   where id = p_reporte and deleted_at is null for update;

  if not found then
    raise exception 'El control de vales no existe.';
  end if;
  if v_rep.estado <> 'abierto' then
    raise exception 'El control % ya esta %; no se puede cerrar de nuevo.',
      v_rep.serial, v_rep.estado;
  end if;

  select coalesce(sum(monto), 0), count(*) into v_total, v_n
    from public.comb_solicitudes
   where reporte_id = p_reporte and deleted_at is null;

  if v_n = 0 then
    raise exception 'El control % no tiene ninguna solicitud; no hay que cerrar.', v_rep.serial;
  end if;

  if exists (
    select 1 from public.comb_solicitudes
     where reporte_id = p_reporte and deleted_at is null and monto is null
  ) then
    raise exception 'Hay solicitudes sin monto de despacho. El total saldria incompleto.';
  end if;

  update public.comb_reportes
     set estado = 'cerrado', total = v_total, updated_by = auth.uid()
   where id = p_reporte
  returning * into v_rep;

  update public.comb_solicitudes
     set estado = 'en_reporte', updated_by = auth.uid()
   where reporte_id = p_reporte and deleted_at is null
     and estado in ('documentada','despachada');

  return v_rep;
end $$;

comment on function public.comb_cerrar_reporte(uuid) is
  'Cierra un control de vales: calcula el total en el servidor y lo congela. Rechaza cerrarlo si alguna solicitud no tiene monto.';

-- El puente a PAGOS. `pagos_notificaciones` ya lo usan caja chica, los
-- consumos de tarjeta y el combustible de aeronaves; aqui solo se agrega un
-- origen mas.
--
-- El origen se llama `combustible_vehiculos` y no `combustible` a proposito:
-- ese ya esta tomado por el combustible de AERONAVES, y en la bandeja de
-- avisos hay que poder distinguir un deposito del aeroclub de la quincena de
-- la gasolinera. Ampliar el CHECK es aditivo: no se quita ninguno.

alter table public.pagos_notificaciones
  drop constraint if exists pagos_notificaciones_origen_tipo_check;
alter table public.pagos_notificaciones
  add constraint pagos_notificaciones_origen_tipo_check
  check (origen_tipo = any (array[
    'liquidacion', 'consumo_tc', 'combustible', 'combustible_vehiculos'
  ]));

create or replace function public.comb_enviar_a_pagos(p_reporte uuid)
returns public.pagos_notificaciones
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rep   public.comb_reportes;
  v_notif public.pagos_notificaciones;
  v_res   text;
begin
  if public.auth_rol() not in ('admin','asistente') then
    raise exception 'No tiene permiso para enviar a Pagos.';
  end if;

  select * into v_rep from public.comb_reportes
   where id = p_reporte and deleted_at is null for update;

  if not found then
    raise exception 'El control de vales no existe.';
  end if;
  if v_rep.estado <> 'cerrado' then
    raise exception 'Solo se envia a Pagos un control cerrado. El % esta %.',
      v_rep.serial, v_rep.estado;
  end if;

  -- El proveedor NO viaja en el aviso: `pagos_notificaciones` no tiene esa
  -- columna. Se elige al crear la solicitud de pago, como en los demas
  -- origenes. El aviso lleva el monto, la moneda y de donde viene.
  v_res := 'Combustible de vehiculos del '
        || to_char(v_rep.periodo_ini, 'DD/MM/YYYY') || ' al '
        || to_char(v_rep.periodo_fin, 'DD/MM/YYYY')
        || ' (' || v_rep.serial || ')';

  insert into public.pagos_notificaciones
    (origen_tipo, origen_id, monto, moneda, resumen, procesado)
  values
    ('combustible_vehiculos', p_reporte, v_rep.total, 'GTQ', v_res, false)
  returning * into v_notif;

  update public.comb_reportes
     set estado = 'enviado_a_pagos',
         notificacion_id = v_notif.id,
         updated_by = auth.uid()
   where id = p_reporte;

  return v_notif;
end $$;

comment on function public.comb_enviar_a_pagos(uuid) is
  'Emite el aviso a PAGOS de un control de vales cerrado, por el mismo puente que ya usan caja chica, tarjetas y el combustible de aeronaves.';

-- ══════════════════════════════════════════════════════════════════════
-- 8.1 · Ninguna de estas funciones es para el publico
-- ══════════════════════════════════════════════════════════════════════
--
-- Todas son `security definer`: corren con privilegios del dueño y las
-- comprobaciones de adentro son la unica defensa. PostgREST las expone como
-- RPC, y por omision `anon` --el rol de la clave publica del frontend-- puede
-- llamarlas. No hay ningun caso de uso sin sesion, asi que se le quita.

revoke execute on function public.envio_despacho_comb_solicitud(public.envios) from public, anon;
revoke execute on function public.envio_despacho_pago(public.envios)           from public, anon;
revoke execute on function public.pago_marcar_pagado(uuid)                     from public, anon;
revoke execute on function public.comb_cerrar_reporte(uuid)                    from public, anon;
revoke execute on function public.comb_enviar_a_pagos(uuid)                    from public, anon;

grant execute on function public.pago_marcar_pagado(uuid)  to authenticated;
grant execute on function public.comb_cerrar_reporte(uuid) to authenticated;
grant execute on function public.comb_enviar_a_pagos(uuid) to authenticated;

-- Las dos de despacho NO se conceden a nadie: solo las llama `envio_aceptar`,
-- que corre como dueño. Nadie debe poder disparar una cascada por su cuenta,
-- saltandose el envio que la justifica.

-- ══════════════════════════════════════════════════════════════════════
-- 9 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_falta text := '';
  t text;
begin
  foreach t in array array['comb_responsables','comb_solicitudes','comb_reportes'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = t
    ) then
      v_falta := v_falta || format('falta la tabla %s; ', t);
      continue;
    end if;

    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      v_falta := v_falta || format('%s sin RLS; ', t);
    end if;

    if (select count(*) from pg_policies where schemaname='public' and tablename=t) < 2 then
      v_falta := v_falta || format('%s sin sus politicas; ', t);
    end if;

    if not exists (
      select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
       where c.relname = t and g.tgname = 'audit_' || t and not g.tgisinternal
    ) then
      v_falta := v_falta || format('%s sin auditoria; ', t);
    end if;
  end loop;

  foreach t in array array[
    'envio_despacho_comb_solicitud','envio_despacho_pago',
    'pago_marcar_pagado','comb_cerrar_reporte','comb_enviar_a_pagos'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = t
    ) then
      v_falta := v_falta || format('falta la funcion %s; ', t);
    end if;
  end loop;

  -- Que ninguna funcion `security definer` le quedara abierta a `anon`.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'envio_aceptar','envio_rechazar','pago_marcar_pagado',
         'comb_cerrar_reporte','comb_enviar_a_pagos',
         'envio_despacho_comb_solicitud','envio_despacho_pago'
       )
       and has_function_privilege('anon', p.oid, 'execute')
  ) then
    v_falta := v_falta || 'anon todavia puede ejecutar alguna funcion security definer; ';
  end if;

  if v_falta <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_falta;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

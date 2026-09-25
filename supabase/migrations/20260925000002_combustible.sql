-- Aeronaves · Control de combustible
--
-- El registro de vales y facturas de combustible de una aeronave, y el
-- puente hacia la solicitud de pago.
--
-- El flujo que describio el usuario:
--   1. Se registra el vale con su factura y sus productos (galones x precio).
--   2. El registro aparece en la liquidacion de facturas.
--   3. "Enviar a SP" avisa a Finanzas → Pagos, que genera la solicitud con
--      los datos del proveedor del registro.
--   4. Desde el registro se puede VER la solicitud que salio de el.
--
-- El paso 3 NO inventa un mecanismo nuevo: `pagos_notificaciones` ya existe y
-- es justo eso. Lo unico que hacia falta era dejarla aceptar este origen.

-- ── 1 · El puente hacia Pagos acepta un origen mas ────────────────────────
alter table public.pagos_notificaciones
  drop constraint if exists pagos_notificaciones_origen_tipo_check;
alter table public.pagos_notificaciones
  add constraint pagos_notificaciones_origen_tipo_check
  check (origen_tipo in ('liquidacion', 'consumo_tc', 'combustible'));

-- ── 2 · El correlativo del registro ───────────────────────────────────────
create sequence if not exists public.avn_combustible_seq;

create or replace function public.avn_combustible_next_serial()
returns text
language plpgsql
as $function$
declare
  y int := extract(year from current_date)::int;
  n bigint;
begin
  n := nextval('public.avn_combustible_seq');
  return 'CB-' || y::text || '-' || lpad(n::text, 4, '0');
end;
$function$;

create or replace function public.avn_combustible_set_serial()
returns trigger
language plpgsql
as $function$
begin
  if new.serial is null or new.serial = '' then
    new.serial := public.avn_combustible_next_serial();
  end if;
  return new;
end;
$function$;

-- ── 3 · El registro ───────────────────────────────────────────────────────
create table if not exists public.avn_combustible_registros (
  id uuid primary key default gen_random_uuid(),
  aeronave_id uuid not null references public.avn_aeronaves(id) on delete cascade,
  serial text,
  fecha date not null,
  vale text,
  factura text,
  fer_ap text,

  -- Entidad que paga y proveedor que surte. Se guarda el id Y el texto: si
  -- manana cambia el nombre o el NIT de cualquiera de los dos, un registro
  -- de hace un ano tiene que seguir diciendo lo que decia el dia que se hizo.
  -- Es la misma leccion del nombre de la tarjeta en la liquidacion de T&T.
  entidad_id uuid references public.entidades(id),
  entidad text,
  entidad_nit text,
  proveedor_id uuid references public.proveedores(id),
  proveedor text,
  proveedor_nit text,

  moneda text not null default 'GTQ',
  -- Lo mantiene al dia el trigger de abajo a partir de las lineas: un total
  -- escrito a mano se desincroniza en cuanto alguien edita un renglon.
  total numeric(14,2) not null default 0,

  archivo_path text,
  archivo_nombre text,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists avn_combustible_serial_uniq
  on public.avn_combustible_registros (serial) where serial is not null;
create index if not exists avn_combustible_aeronave_idx
  on public.avn_combustible_registros (aeronave_id, fecha desc) where deleted_at is null;

-- ── 4 · Las lineas de producto ────────────────────────────────────────────
-- Gasolina, Aceite, Diesel hoy. Es texto libre a proposito y no un enum: el
-- King Air usa Jet A1, y cuando entre no deberia hacer falta una migracion
-- para poder capturarlo.
create table if not exists public.avn_combustible_lineas (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.avn_combustible_registros(id) on delete cascade,
  producto text not null,
  galones numeric(12,3) not null default 0,
  precio_unitario numeric(12,4) not null default 0,
  -- Calculada por la base: no hay forma de que quede distinta de sus factores.
  total numeric(14,2) generated always as (round(galones * precio_unitario, 2)) stored,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists avn_combustible_lineas_registro_idx
  on public.avn_combustible_lineas (registro_id, orden);

alter table public.avn_combustible_lineas drop constraint if exists avn_combustible_lineas_chk;
alter table public.avn_combustible_lineas add constraint avn_combustible_lineas_chk
  check (galones >= 0 and precio_unitario >= 0);

-- ── 5 · El total del registro lo lleva la base ────────────────────────────
create or replace function public.avn_combustible_recalcular_total()
returns trigger
language plpgsql
as $function$
declare
  r uuid := coalesce(new.registro_id, old.registro_id);
begin
  update public.avn_combustible_registros
     set total = coalesce((
           select sum(l.total) from public.avn_combustible_lineas l
            where l.registro_id = r
         ), 0)
   where id = r;
  return null;
end;
$function$;

drop trigger if exists avn_combustible_total on public.avn_combustible_lineas;
create trigger avn_combustible_total
  after insert or update or delete on public.avn_combustible_lineas
  for each row execute function public.avn_combustible_recalcular_total();

-- ── 6 · Triggers ──────────────────────────────────────────────────────────
drop trigger if exists avn_combustible_serial on public.avn_combustible_registros;
create trigger avn_combustible_serial before insert on public.avn_combustible_registros
  for each row execute function public.avn_combustible_set_serial();

drop trigger if exists set_updated_at_avn_combustible_registros on public.avn_combustible_registros;
create trigger set_updated_at_avn_combustible_registros before update
  on public.avn_combustible_registros for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_avn_combustible_lineas on public.avn_combustible_lineas;
create trigger set_updated_at_avn_combustible_lineas before update
  on public.avn_combustible_lineas for each row execute function public.set_updated_at();

drop trigger if exists audit_avn_combustible_registros on public.avn_combustible_registros;
create trigger audit_avn_combustible_registros after insert or update or delete
  on public.avn_combustible_registros for each row execute function public.audit_trigger();

drop trigger if exists audit_avn_combustible_lineas on public.avn_combustible_lineas;
create trigger audit_avn_combustible_lineas after insert or update or delete
  on public.avn_combustible_lineas for each row execute function public.audit_trigger();

-- ── 7 · RLS ───────────────────────────────────────────────────────────────
alter table public.avn_combustible_registros enable row level security;
alter table public.avn_combustible_lineas enable row level security;

-- Lo lee quien administra la aeronave Y quien procesa pagos: la solicitud se
-- llena extrayendo los datos del documento que la origino, asi que sin este
-- permiso el prellenado quedaria vacio para un usuario de Finanzas que no
-- tenga acceso al modulo de Aeronaves.
drop policy if exists avn_combustible_registros_read on public.avn_combustible_registros;
create policy avn_combustible_registros_read on public.avn_combustible_registros for select
  using (public.puede('aeronaves', 'observador') or public.puede('finanzas', 'observador'));
drop policy if exists avn_combustible_registros_write on public.avn_combustible_registros;
create policy avn_combustible_registros_write on public.avn_combustible_registros for all
  using (public.puede('aeronaves', 'editor'))
  with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_combustible_lineas_read on public.avn_combustible_lineas;
create policy avn_combustible_lineas_read on public.avn_combustible_lineas for select
  using (public.puede('aeronaves', 'observador') or public.puede('finanzas', 'observador'));
drop policy if exists avn_combustible_lineas_write on public.avn_combustible_lineas;
create policy avn_combustible_lineas_write on public.avn_combustible_lineas for all
  using (public.puede('aeronaves', 'editor'))
  with check (public.puede('aeronaves', 'editor'));

-- Quien administra el combustible tiene que poder avisarle a Pagos, aunque no
-- tenga acceso al modulo de Finanzas: la notificacion es una peticion, no un
-- pago. Leer las suyas le sirve para saber si ya se atendio.
drop policy if exists pagos_notif_combustible_insert on public.pagos_notificaciones;
create policy pagos_notif_combustible_insert on public.pagos_notificaciones for insert
  with check (origen_tipo = 'combustible' and public.puede('aeronaves', 'editor'));

drop policy if exists pagos_notif_combustible_read on public.pagos_notificaciones;
create policy pagos_notif_combustible_read on public.pagos_notificaciones for select
  using (origen_tipo = 'combustible' and public.puede('aeronaves', 'observador'));

NOTIFY pgrst, 'reload schema';

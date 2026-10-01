-- Aeronaves · Bitacora de vuelo
--
-- Lo que el piloto reporta despues de volar. Es el origen de todo lo demas:
-- de aqui salen las horas, y de las horas saldran despues los cobros y la
-- cuenta regresiva de los mantenimientos.
--
-- ── Las horas salen del HOROMETRO ────────────────────────────────────────
-- No del reloj. Cada tramo guarda el horometro al salir y al llegar, y la
-- diferencia son sus horas; las del vuelo son la suma de sus tramos. La hora
-- de reloj se guarda aparte: sirve para el itinerario y para la espera, pero
-- no es lo que cuenta la aeronave.
--
-- ── Lo que NO va todavia ─────────────────────────────────────────────────
-- Por decision de la usuaria, esta migracion es solo la base:
--
--  - CICLOS: "mi alcance de informacion no llegara a los ciclos, nada mas a
--    horas". El mock los traia por el King Air; aca no van.
--  - GALONES por tramo: "no estoy segura de como lo vamos a amarrar". El fuel
--    hoy se captura como facturas en la pestana de Combustible, y meterlo
--    tambien aca seria tener el mismo numero en dos lugares antes de saber
--    cual manda.
--  - TARIFAS, VIATICOS y A QUIEN SE LE COBRA: eso es lo que la administracion
--    le agrega despues a lo que reporto el piloto. Va en su propia fase.

-- ── 1 · Los pilotos ───────────────────────────────────────────────────────
-- Catalogo de flota, no por aeronave: un piloto puede volar mas de una. El
-- vuelo es el que amarra piloto con aeronave.
--
-- No se usa `personas` para esto: un piloto necesita licencia y vencimiento
-- medico, que esa tabla no tiene ni deberia tener. `personas` sigue siendo la
-- fuente de autorizadores y firmantes, que es otra cosa.
create table if not exists public.avn_pilotos (
  id uuid primary key default gen_random_uuid(),

  nombre text not null,
  licencia text,
  tipo text,                             -- 'PPL · dueño', 'Instructor'…
  -- Se vigila igual que los certificados de la aeronave: un piloto con el
  -- medico vencido no deberia volar.
  medico_vence date,
  telefono text,
  activo boolean not null default true,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_pilotos_idx
  on public.avn_pilotos (activo, nombre) where deleted_at is null;

-- ── 2 · El vuelo ──────────────────────────────────────────────────────────
create sequence if not exists public.avn_vuelos_seq;

create or replace function public.avn_vuelos_next_serial()
returns text
language plpgsql
as $function$
declare
  y int := extract(year from current_date)::int;
  n bigint;
begin
  n := nextval('public.avn_vuelos_seq');
  return 'VU-' || y::text || '-' || lpad(n::text, 4, '0');
end;
$function$;

create table if not exists public.avn_vuelos (
  id uuid primary key default gen_random_uuid(),
  aeronave_id uuid not null references public.avn_aeronaves(id) on delete cascade,
  serial text,

  fecha date not null,
  numero text,                           -- el que usa el operador, si lo lleva

  -- Quien iba al mando. El dueno vuela sin costo de piloto y la instruccion
  -- paga la tarifa del instructor, pero eso se valoriza en la fase siguiente:
  -- aca solo se registra quien fue.
  mando text not null default 'piloto',  -- 'piloto' | 'dueno' | 'instruccion'
  piloto_id uuid references public.avn_pilotos(id),
  instructor_id uuid references public.avn_pilotos(id),

  proposito text,                        -- recorrido de fincas, traslado…
  notas text,

  -- La suma de las horas de sus tramos. La mantiene el trigger de abajo: se
  -- lee en la lista, en los totales del mes y --cuando exista-- en la cuenta
  -- regresiva de los mantenimientos, asi que vale la pena tenerla lista.
  horas numeric(8,1) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_vuelos_idx
  on public.avn_vuelos (aeronave_id, fecha desc) where deleted_at is null;
create unique index if not exists avn_vuelos_serial_unq
  on public.avn_vuelos (serial) where serial is not null;

alter table public.avn_vuelos drop constraint if exists avn_vuelos_mando_chk;
alter table public.avn_vuelos add constraint avn_vuelos_mando_chk
  check (mando in ('piloto', 'dueno', 'instruccion'));

create or replace function public.avn_vuelos_set_serial()
returns trigger
language plpgsql
as $function$
begin
  if new.serial is null or new.serial = '' then
    new.serial := public.avn_vuelos_next_serial();
  end if;
  return new;
end;
$function$;

drop trigger if exists avn_vuelos_serial on public.avn_vuelos;
create trigger avn_vuelos_serial before insert on public.avn_vuelos
  for each row execute function public.avn_vuelos_set_serial();

-- ── 3 · Los tramos ────────────────────────────────────────────────────────
create table if not exists public.avn_vuelo_tramos (
  id uuid primary key default gen_random_uuid(),
  vuelo_id uuid not null references public.avn_vuelos(id) on delete cascade,

  origen text,                           -- OACI
  destino text,
  hora_salida time,
  hora_llegada time,

  horometro_salida numeric(10,1),
  horometro_llegada numeric(10,1),

  -- Lo calcula la base: no hay forma de que quede distinta de sus factores.
  horas numeric(8,1) generated always as (
    case
      when horometro_salida is null or horometro_llegada is null then 0
      else round(horometro_llegada - horometro_salida, 1)
    end
  ) stored,

  espera numeric(6,1) not null default 0, -- horas en tierra esperando
  notas text,
  orden integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_vuelo_tramos_idx
  on public.avn_vuelo_tramos (vuelo_id, orden) where deleted_at is null;

alter table public.avn_vuelo_tramos drop constraint if exists avn_vuelo_tramos_chk;
alter table public.avn_vuelo_tramos add constraint avn_vuelo_tramos_chk
  check (
    espera >= 0
    -- El horometro no camina para atras. Si esto salta, hay un dedazo.
    and (horometro_salida is null or horometro_llegada is null
         or horometro_llegada >= horometro_salida)
  );

-- ── 4 · Los pasajeros ─────────────────────────────────────────────────────
-- Una fila por persona: "pasajeros que sean agregados, no solo en una fila
-- todos, porque si despues lo quiero descargar no lo puedo filtrar".
create table if not exists public.avn_vuelo_pax (
  id uuid primary key default gen_random_uuid(),
  vuelo_id uuid not null references public.avn_vuelos(id) on delete cascade,

  nombre text,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_vuelo_pax_idx
  on public.avn_vuelo_pax (vuelo_id, orden) where deleted_at is null;

-- ── 5 · Las horas del vuelo las lleva la base ─────────────────────────────
create or replace function public.avn_vuelo_recalcular_horas()
returns trigger
language plpgsql
as $function$
declare
  v uuid := coalesce(new.vuelo_id, old.vuelo_id);
begin
  if v is null then
    return null;
  end if;
  update public.avn_vuelos
     set horas = coalesce((
           select sum(t.horas) from public.avn_vuelo_tramos t
            where t.vuelo_id = v and t.deleted_at is null
         ), 0)
   where id = v;
  return null;
end;
$function$;

drop trigger if exists avn_vuelo_horas on public.avn_vuelo_tramos;
create trigger avn_vuelo_horas
  after insert or update or delete on public.avn_vuelo_tramos
  for each row execute function public.avn_vuelo_recalcular_horas();

-- ── 6 · Triggers comunes ──────────────────────────────────────────────────
drop trigger if exists set_updated_at_avn_pilotos on public.avn_pilotos;
create trigger set_updated_at_avn_pilotos before update on public.avn_pilotos
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_avn_vuelos on public.avn_vuelos;
create trigger set_updated_at_avn_vuelos before update on public.avn_vuelos
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_avn_vuelo_tramos on public.avn_vuelo_tramos;
create trigger set_updated_at_avn_vuelo_tramos before update on public.avn_vuelo_tramos
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_avn_vuelo_pax on public.avn_vuelo_pax;
create trigger set_updated_at_avn_vuelo_pax before update on public.avn_vuelo_pax
  for each row execute function public.set_updated_at();

drop trigger if exists audit_avn_pilotos on public.avn_pilotos;
create trigger audit_avn_pilotos after insert or update or delete
  on public.avn_pilotos for each row execute function public.audit_trigger();
drop trigger if exists audit_avn_vuelos on public.avn_vuelos;
create trigger audit_avn_vuelos after insert or update or delete
  on public.avn_vuelos for each row execute function public.audit_trigger();
drop trigger if exists audit_avn_vuelo_tramos on public.avn_vuelo_tramos;
create trigger audit_avn_vuelo_tramos after insert or update or delete
  on public.avn_vuelo_tramos for each row execute function public.audit_trigger();
drop trigger if exists audit_avn_vuelo_pax on public.avn_vuelo_pax;
create trigger audit_avn_vuelo_pax after insert or update or delete
  on public.avn_vuelo_pax for each row execute function public.audit_trigger();

-- ── 7 · RLS · el mismo modulo que el resto de aeronaves ───────────────────
alter table public.avn_pilotos enable row level security;
alter table public.avn_vuelos enable row level security;
alter table public.avn_vuelo_tramos enable row level security;
alter table public.avn_vuelo_pax enable row level security;

drop policy if exists avn_pilotos_read on public.avn_pilotos;
create policy avn_pilotos_read on public.avn_pilotos for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_pilotos_write on public.avn_pilotos;
create policy avn_pilotos_write on public.avn_pilotos for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_vuelos_read on public.avn_vuelos;
create policy avn_vuelos_read on public.avn_vuelos for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_vuelos_write on public.avn_vuelos;
create policy avn_vuelos_write on public.avn_vuelos for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_vuelo_tramos_read on public.avn_vuelo_tramos;
create policy avn_vuelo_tramos_read on public.avn_vuelo_tramos for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_vuelo_tramos_write on public.avn_vuelo_tramos;
create policy avn_vuelo_tramos_write on public.avn_vuelo_tramos for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_vuelo_pax_read on public.avn_vuelo_pax;
create policy avn_vuelo_pax_read on public.avn_vuelo_pax for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_vuelo_pax_write on public.avn_vuelo_pax;
create policy avn_vuelo_pax_write on public.avn_vuelo_pax for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

NOTIFY pgrst, 'reload schema';

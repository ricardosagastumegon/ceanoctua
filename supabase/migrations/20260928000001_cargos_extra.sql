-- T&T · Cargos adicionales con su propia forma de pago y su propia fecha
--
-- EL PROBLEMA
--
-- Un servicio tenia un solo campo de monto extra y ningun lugar donde decir
-- con que se pago ni cuando. El extra se sumaba al `monto` del servicio, asi
-- que al liquidar se le cargaba entero a la tarjeta del servicio.
--
-- Con datos reales: el ticket EWR-GUA son 2 x (603.50 tarifa + 103.50 extras)
-- = 1414.00, y los 207.00 de asientos y maleta aparecian en la Amex del
-- boleto aunque se hayan pagado despues, con otra tarjeta y otro dia. El
-- consumo por tarjeta de la liquidacion salia mal.
--
-- LA CORRECCION
--
-- Un cargo adicional deja de ser un numero dentro del servicio y pasa a ser
-- un cobro con vida propia: su descripcion, su monto, su tarjeta y su fecha.
-- Una sola tabla para los once servicios, en vez de repetir dos columnas en
-- cada tabla y en cada formulario.
--
-- Consecuencia importante: a partir de aqui `monto` del servicio es lo que se
-- le cargo a SU tarjeta --la base-- y los extras suman aparte. El total que
-- ve el usuario sigue siendo base + cargos.

-- ── 1 · La tabla ──────────────────────────────────────────────────────────
create table if not exists public.att_cargos (
  id uuid primary key default gen_random_uuid(),

  -- El viaje va aqui aunque se pueda deducir del servicio: la liquidacion
  -- necesita todos los cargos del viaje en una sola consulta, sin tener que
  -- pasar por las once tablas de servicio para averiguar a cual pertenecen.
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,

  -- A que servicio pertenece. Es una referencia suelta y no una llave foranea
  -- porque el servicio puede estar en cualquiera de las once tablas.
  servicio_tipo text not null,
  servicio_id uuid not null,

  -- Solo para tickets: a que pasajero corresponde el cargo. Permite que la
  -- hoja siga mostrando el desglose por pasajero.
  pax_id uuid references public.att_ticket_pax(id) on delete set null,

  descripcion text not null,
  monto numeric(14,2) not null default 0,
  reintegro numeric(14,2) not null default 0,
  moneda text not null default 'USD',

  -- Con que y cuando se pago ESTE cargo, que es justo lo que faltaba.
  -- `pagado_con` guarda el texto del dia que se capturo: renombrar una
  -- tarjeta en Admin no puede reescribir un reporte de hace meses.
  pagado_con text,
  pagado_con_id uuid references public.tarjetas_credito(id),
  fecha_cargo date,

  notas text,
  orden integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists att_cargos_viaje_idx
  on public.att_cargos (viaje_id) where deleted_at is null;
create index if not exists att_cargos_servicio_idx
  on public.att_cargos (servicio_tipo, servicio_id) where deleted_at is null;

alter table public.att_cargos drop constraint if exists att_cargos_monto_chk;
alter table public.att_cargos add constraint att_cargos_monto_chk
  check (monto >= 0 and reintegro >= 0 and reintegro <= monto);

alter table public.att_cargos drop constraint if exists att_cargos_tipo_chk;
alter table public.att_cargos add constraint att_cargos_tipo_chk
  check (servicio_tipo in (
    'tickets','hotel','restaurantes','renta','tours','aeronave',
    'acuatico','ferry','terrestre','actividades','reunion'
  ));

comment on table public.att_cargos is
  'Cargos adicionales de un servicio. Cada uno con su forma de pago y su fecha, porque un extra se paga aparte del servicio que lo origino.';
comment on column public.att_cargos.viaje_id is
  'Denormalizado a proposito: la liquidacion lee todos los cargos del viaje de un golpe.';

-- ── 2 · Triggers ──────────────────────────────────────────────────────────
drop trigger if exists set_updated_at_att_cargos on public.att_cargos;
create trigger set_updated_at_att_cargos before update on public.att_cargos
  for each row execute function public.set_updated_at();

drop trigger if exists audit_att_cargos on public.att_cargos;
create trigger audit_att_cargos after insert or update or delete
  on public.att_cargos for each row execute function public.audit_trigger();

-- ── 3 · RLS · mismo patron que el resto de T&T ────────────────────────────
alter table public.att_cargos enable row level security;

drop policy if exists att_cargos_read on public.att_cargos;
create policy att_cargos_read on public.att_cargos for select
  using (public.puede('tt', 'observador'));

drop policy if exists att_cargos_write on public.att_cargos;
create policy att_cargos_write on public.att_cargos for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

-- ── 4 · Rescate de los extras que ya estaban capturados ───────────────────
-- Hoy solo los tickets tienen extras: 6 renglones de pasajero, 345.40 en
-- total. Se convierten en cargos conservando la tarjeta y la fecha del
-- boleto, que es la mejor informacion disponible --era la unica que habia--
-- y desde la pantalla se pueden corregir uno por uno.
insert into public.att_cargos (
  viaje_id, servicio_tipo, servicio_id, pax_id, descripcion, monto, moneda,
  pagado_con, pagado_con_id, fecha_cargo, orden, notas
)
select
  t.viaje_id, 'tickets', t.id, p.id,
  coalesce(nullif(trim(p.extras_nota), ''), 'Extras'),
  p.extras,
  coalesce(t.moneda::text, 'USD'),
  t.pagado_con, t.pagado_con_id, t.fecha_cargo,
  coalesce(p.orden, 0),
  'Rescatado del extra del pasajero al separar los cargos. Verificar con que se pago de verdad.'
from public.att_ticket_pax p
join public.att_tickets t on t.id = p.ticket_id
where p.extras is not null
  and p.extras > 0
  and p.deleted_at is null
  and t.deleted_at is null
  and not exists (
    select 1 from public.att_cargos c
     where c.servicio_tipo = 'tickets' and c.pax_id = p.id and c.deleted_at is null
  );

-- El monto del ticket se queda con la base: lo que de verdad se le cargo a su
-- tarjeta. Los extras ya viven como cargos.
update public.att_tickets t
   set monto = sub.base
  from (
    select p.ticket_id, sum(coalesce(p.tarifa, 0)) base
      from public.att_ticket_pax p
     where p.deleted_at is null
     group by p.ticket_id
  ) sub
 where sub.ticket_id = t.id
   and t.deleted_at is null
   and t.monto is distinct from sub.base;

-- Y el campo viejo se vacia para que nada lo vuelva a sumar dos veces.
update public.att_ticket_pax
   set extras = 0, extras_nota = null
 where extras is not null and extras > 0;

comment on column public.att_ticket_pax.extras is
  'DEPRECADA. Los cargos adicionales viven en att_cargos, con su propia forma de pago y fecha. Se deja en 0.';
comment on column public.att_ticket_pax.extras_nota is
  'DEPRECADA. Vease att_cargos.descripcion.';

NOTIFY pgrst, 'reload schema';

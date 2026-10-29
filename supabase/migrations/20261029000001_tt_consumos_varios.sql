-- T&T · Consumos Varios del viaje
--
-- EL PROBLEMA
--
-- Al cerrar un viaje le entregan a la asistente un reporte de los gastos
-- menudos que se pagaron con tarjeta durante el camino: propinas, taxis, un
-- cafe, una farmacia. Son decenas de renglones chiquitos y no se capturan uno
-- por uno --nadie va a teclear sesenta propinas-- sino como un total bajo un
-- concepto: "CONSUMOS VARIOS Sra. Arriaza". Hoy no hay donde ponerlo, asi que
-- ese dinero no aparece en la liquidacion del viaje y el consumo por tarjeta
-- sale corto justo cuando hay que pedir el reintegro.
--
-- POR QUE UNA TABLA Y NO `att_cargos`
--
-- `att_cargos` ya tiene la forma correcta --un cobro con su descripcion, su
-- monto, su tarjeta y su fecha-- pero esta amarrado a un servicio: su CHECK
-- solo acepta los once tipos y `servicio_id` es not null. Un consumo varios no
-- pertenece a ningun servicio, pertenece al viaje. Guardar el id del viaje en
-- una columna llamada `servicio_id` seria una trampa para quien lea la tabla
-- en un ano.
--
-- COMO ENTRA A LOS REPORTES
--
-- La liquidacion pide ocho columnas comunes --monto, reintegro, moneda,
-- estado_pago, cancelado_en, pagado_con, pagado_con_id, fecha_cargo-- y esta
-- tabla las lleva todas. Con eso una sola entrada en `MAPEO` la mete en la
-- liquidacion del viaje, en la liquidacion por periodo y en el resumen, sin
-- tocar ninguno de los tres.

-- ── 1 · La tabla ──────────────────────────────────────────────────────────
create table if not exists public.att_consumos_varios (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,

  -- Texto libre a proposito. No es catalogo: cambia con quien viaja y con lo
  -- que reportan.
  concepto text not null,

  monto numeric(14,2) not null default 0,
  moneda public.currency not null default 'USD',

  -- La tarjeta y el texto del dia que se capturo, igual que en att_cargos:
  -- renombrar una tarjeta en Admin no puede reescribir un reporte de hace
  -- meses.
  pagado_con text,
  pagado_con_id uuid references public.tarjetas_credito(id),

  -- `fecha` es el dia del reporte --o el corte del viaje--; `fecha_cargo` es
  -- cuando pego en el estado de cuenta. La liquidacion por periodo usa
  -- fecha_cargo ?? fecha, la misma regla que los demas servicios.
  fecha date,
  fecha_cargo date,

  -- Nace CONFIRMADO: este dinero ya se gasto, por definicion. La lista es la
  -- unificada de seis valores, la que entienden cancelarServicio() y
  -- reactivarServicio().
  estado_pago text not null default 'CONFIRMADO',
  cancelado_en date,
  reintegro numeric(14,2) not null default 0,
  reintegro_nota text,

  -- El detalle del reporte, si se quiere que salga en el papel. No afecta la
  -- suma: el monto es el monto.
  notas text,

  -- El reporte escaneado, en el bucket tt-documentos que ya usan los once
  -- servicios.
  reporte_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create index if not exists att_consumos_varios_viaje_idx
  on public.att_consumos_varios (viaje_id) where deleted_at is null;

-- ── 2 · Restricciones ─────────────────────────────────────────────────────
alter table public.att_consumos_varios
  drop constraint if exists att_consumos_varios_monto_chk;
alter table public.att_consumos_varios
  add constraint att_consumos_varios_monto_chk
  check (monto >= 0 and reintegro >= 0 and reintegro <= monto);

alter table public.att_consumos_varios
  drop constraint if exists att_consumos_varios_estado_pago_chk;
alter table public.att_consumos_varios
  add constraint att_consumos_varios_estado_pago_chk
  check (estado_pago is null or estado_pago in (
    'HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'
  ));

comment on table public.att_consumos_varios is
  'Gastos menudos del viaje registrados como un total bajo un concepto, con su tarjeta. Opcional: solo los viajes donde entregaron el reporte.';
comment on column public.att_consumos_varios.concepto is
  'Como "CONSUMOS VARIOS Sra. Arriaza". Texto libre, no catalogo.';
comment on column public.att_consumos_varios.fecha is
  'Dia del reporte o corte del viaje. La liquidacion por periodo cae aqui cuando no hay fecha_cargo.';
comment on column public.att_consumos_varios.notas is
  'Detalle del reporte si se quiere en el papel. No participa en la suma.';
comment on column public.att_consumos_varios.reporte_path is
  'Ruta en el bucket tt-documentos. Subir otro archivo reemplaza el anterior.';

-- ── 3 · Triggers ──────────────────────────────────────────────────────────
drop trigger if exists set_updated_at_att_consumos_varios on public.att_consumos_varios;
create trigger set_updated_at_att_consumos_varios
  before update on public.att_consumos_varios
  for each row execute function public.set_updated_at();

drop trigger if exists audit_att_consumos_varios on public.att_consumos_varios;
create trigger audit_att_consumos_varios
  after insert or update or delete on public.att_consumos_varios
  for each row execute function public.audit_trigger();

-- ── 4 · RLS · mismo patron que el resto de T&T ────────────────────────────
alter table public.att_consumos_varios enable row level security;

drop policy if exists att_consumos_varios_read on public.att_consumos_varios;
create policy att_consumos_varios_read on public.att_consumos_varios for select
  using (public.puede('tt', 'observador'));

drop policy if exists att_consumos_varios_write on public.att_consumos_varios;
create policy att_consumos_varios_write on public.att_consumos_varios for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

NOTIFY pgrst, 'reload schema';

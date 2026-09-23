-- Fase 22 · Tours, según el documento del 2026-09-23.
--
-- La tabla viene del port de la Fase 19 y ya tiene casi todo. Faltan tres
-- cosas que el documento pide y el mockup del formulario no muestra -- el
-- propio documento lo advierte: "Este formulario no tiene un par de cosas que
-- si te pido arriba".
--
--   nombre                · "TOURS: Espacio para escribir nombre del Tour". La
--                           tabla solo tenia `prestador`, que es la empresa que
--                           da el servicio, no el tour.
--   hora_fin              · "Inicio: hora  fin: hora". `hora` pasa a ser la de
--                           inicio; esta es la de fin.
--   incluye_alimentacion  · "Incluye alimentación: SI / NO"
--   alimentacion_detalle  · "Si es SI: despliega casilla para escribir"
--
-- Mas las tres que comparten los cuatro servicios de este documento: `monto`
-- para que el tour sume al total del viaje, `moneda`, y `confirmacion_path`
-- para el boton "Cargar confirmación" que hoy solo guarda el nombre del
-- archivo en `confirm_file_name`.

alter table public.att_tours
  add column if not exists nombre text,
  add column if not exists hora_fin time,
  add column if not exists incluye_alimentacion boolean,
  add column if not exists alimentacion_detalle text,
  add column if not exists monto numeric(14,2),
  add column if not exists moneda public.currency not null default 'USD',
  add column if not exists confirmacion_path text;

comment on column public.att_tours.nombre is
  'Nombre del tour. `prestador` es la empresa que lo opera.';
comment on column public.att_tours.hora is
  'Hora de inicio del tour. La de fin es hora_fin.';
comment on column public.att_tours.monto is
  'Derivado: tarifa por persona x personas. Se recalcula al guardar.';
comment on column public.att_tours.confirmacion_path is
  'Ruta en el bucket tt-documentos. confirm_file_name queda del port viejo.';

-- Estado de pago · la lista unificada de 6 valores que ya usan ticket, hotel,
-- restaurante y renta.
--
-- La restriccion vieja se elimina en esta misma migracion. El 22 de septiembre
-- la renta no se pudo guardar porque quedaron las dos activas a la vez y
-- ninguna fila podia cumplir ambas: 'A PAGAR EN PROPIEDAD' pasa la nueva y
-- falla la vieja.
alter table public.att_tours drop constraint if exists att_tours_estado_pago_check;
alter table public.att_tours drop constraint if exists att_tours_estado_pago_chk;
alter table public.att_tours add constraint att_tours_estado_pago_chk
  check (estado_pago is null or estado_pago in (
    'HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'
  ));

-- La tabla esta vacia, asi que no hay filas con el vocabulario viejo que
-- migrar. Se deja el backfill de monto por si entra alguna antes del deploy.
update public.att_tours
   set monto = coalesce(tarifa, 0) * coalesce(personas, 0)
 where monto is null
   and deleted_at is null;

NOTIFY pgrst, 'reload schema';

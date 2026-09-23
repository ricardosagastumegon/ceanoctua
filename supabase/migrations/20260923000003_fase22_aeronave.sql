-- Fase 22 · Renta de Aeronave Privada, según el documento del 2026-09-23.
--
-- La tabla viene del port de la Fase 19 y ya tiene todas sus columnas de
-- negocio, incluidas las de ruta. Faltan las tres que comparten los cuatro
-- servicios de este documento:
--
--   monto              · sin ella el servicio aporta cero al total del viaje
--                        y no aparece en "Costo por servicio"
--   moneda             · el resto de servicios ya la tiene
--   confirmacion_path  · el boton "Cargar confirmación" que pide el documento.
--                        Hoy solo existe confirm_file_name, que guarda el
--                        nombre sin el archivo.

alter table public.att_aeronaves
  add column if not exists monto numeric(14,2),
  add column if not exists moneda public.currency not null default 'USD',
  add column if not exists confirmacion_path text;

comment on column public.att_aeronaves.monto is
  'Derivado: tarifa de servicio + monto de extras. Se recalcula al guardar.';
comment on column public.att_aeronaves.confirmacion_path is
  'Ruta en el bucket tt-documentos. confirm_file_name queda del port viejo.';

-- Estado de pago · la lista unificada de 6 valores que ya usan ticket, hotel,
-- restaurante y renta.
--
-- La restriccion vieja se elimina en esta misma migracion. El 22 de septiembre
-- la renta no se pudo guardar porque quedaron las dos activas a la vez y
-- ninguna fila podia cumplir ambas: 'A PAGAR EN PROPIEDAD' pasa la nueva y
-- falla la vieja.
alter table public.att_aeronaves drop constraint if exists att_aeronaves_estado_pago_check;
alter table public.att_aeronaves drop constraint if exists att_aeronaves_estado_pago_chk;
alter table public.att_aeronaves add constraint att_aeronaves_estado_pago_chk
  check (estado_pago is null or estado_pago in (
    'HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'
  ));

-- La tabla esta vacia, asi que no hay filas con el vocabulario viejo que
-- migrar. Se deja el backfill de monto por si entra alguna antes del deploy.
update public.att_aeronaves
   set monto = coalesce(tarifa, 0) + coalesce(monto_extras, 0)
 where monto is null
   and deleted_at is null;

NOTIFY pgrst, 'reload schema';

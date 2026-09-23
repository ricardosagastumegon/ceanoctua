-- Fase 22 · Traslado Terrestre, según el documento del 2026-09-23.
--
-- La tabla viene del port de la Fase 19 y ya tiene las columnas de ruta OW/RT
-- y `personas`. Falta:
--
--   ruta               · el documento pide, SOLO en el modo OW, un campo libre
--                        "Ruta:" ademas de origen y destino. En RT los rotulos
--                        "Ruta: Salida" y "Ruta: Retorno" son encabezados.
--   monto              · sin ella el servicio aporta cero al total del viaje
--   moneda             · como el resto de los servicios
--   confirmacion_path  · el boton "Cargar confirmación"; confirm_file_name
--                        solo guardaba el nombre del archivo

alter table public.att_terrestres
  add column if not exists ruta text,
  add column if not exists monto numeric(14,2),
  add column if not exists moneda public.currency not null default 'USD',
  add column if not exists confirmacion_path text;

comment on column public.att_terrestres.ruta is
  'Descripcion libre de la ruta. El documento la pide solo en el modo OW.';
comment on column public.att_terrestres.monto is
  'Derivado: tarifa por persona x personas + monto de extras. Se recalcula al guardar.';
comment on column public.att_terrestres.confirmacion_path is
  'Ruta en el bucket tt-documentos. confirm_file_name queda del port viejo.';

-- Estado de pago · la lista unificada de 6 valores. La restriccion vieja se
-- elimina en esta misma migracion: dejar las dos activas fue lo que impidio
-- guardar la renta de vehiculo el 22 de septiembre.
alter table public.att_terrestres drop constraint if exists att_terrestres_estado_pago_check;
alter table public.att_terrestres drop constraint if exists att_terrestres_estado_pago_chk;
alter table public.att_terrestres add constraint att_terrestres_estado_pago_chk
  check (estado_pago is null or estado_pago in (
    'HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'
  ));

-- Total del documento: tarifa por persona x cantidad de personas + extras.
-- Ojo: a diferencia de acuatico y ferry, aqui SI multiplica por personas.
update public.att_terrestres
   set monto = coalesce(tarifa, 0) * coalesce(personas, 0) + coalesce(monto_extras, 0)
 where monto is null
   and deleted_at is null;

NOTIFY pgrst, 'reload schema';

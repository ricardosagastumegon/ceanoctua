-- Aeronaves · Combustible · anular un registro
--
-- Un registro que ya tiene solicitud de pago no se puede borrar: del otro
-- lado hay un documento que quedaria apuntando al vacio. Pero si el vale
-- resulta mal, o se factura dos veces, o se cae la compra, tiene que haber
-- una salida que no sea borrar.
--
-- Es la misma idea que `cancelado_en` de los servicios de T&T: anular no es
-- borrar. El registro anulado sigue en la lista y sigue en el historial --hubo
-- una solicitud de pago que lo menciona-- pero deja de sumar al total
-- facturado, que es lo unico que cambia para quien cuadra las cuentas.

alter table public.avn_combustible_registros
  add column if not exists cancelado_en date,
  add column if not exists cancelacion_nota text;

comment on column public.avn_combustible_registros.cancelado_en is
  'Anulado, no borrado. Deja de sumar al total facturado pero conserva su historial.';

NOTIFY pgrst, 'reload schema';

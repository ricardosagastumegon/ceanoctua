-- Fix · la renta de vehículo no dejaba guardar.
--
-- Error real del usuario:
--   new row for relation "att_rentas" violates check constraint
--   "att_rentas_estado_pago_check"
--
-- Qué pasó: al agregar la lista unificada en 20260922000010 pregunté si existía
-- una restricción llamada `att_rentas_estado_pago_chk`. No existía, así que la
-- creé — pero la que sí existía desde la Fase 19 se llama
-- `att_rentas_estado_pago_check`, con la lista vieja. Quedaron las dos activas
-- y ninguna fila podía cumplir ambas: 'A PAGAR EN PROPIEDAD' pasa la nueva y
-- falla la vieja.
--
-- Lección para los servicios que faltan: al unificar el estado de pago de un
-- servicio hay que BUSCAR la restricción por su definición, no adivinar el
-- nombre, y borrar la vieja en la misma migración. Todavía la conservan
-- att_tours, att_aeronaves, att_acuaticos, att_ferries, att_terrestres y
-- att_actividades, que siguen usando la lista vieja en su formulario.

alter table public.att_rentas drop constraint if exists att_rentas_estado_pago_check;

NOTIFY pgrst, 'reload schema';

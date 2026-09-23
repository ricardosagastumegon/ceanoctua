-- Cierra DT-5 · se van las dos tablas de actividades del port viejo.
--
-- att_actividad_tickets guardaba bloques repetibles de participantes, cada uno
-- con su propia tarifa y extras, y att_actividad_subtickets colgaba de aquella.
-- La fase 22 las reemplazo por att_actividad_entradas, que cuelga directo del
-- evento y lleva un participante por fila con su tarifa.
--
-- Se borran de verdad, no en suave: nunca tuvieron una sola fila (verificado el
-- 2026-09-23, 0 en ambas) y no hay historial que preservar. El `drop` va en
-- orden hijo -> padre por la foreign key.
--
-- Autorizado por el usuario el 2026-09-23.

drop table if exists public.att_actividad_subtickets;
drop table if exists public.att_actividad_tickets;

NOTIFY pgrst, 'reload schema';

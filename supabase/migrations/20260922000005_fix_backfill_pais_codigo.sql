-- Fase 21-1 · Corrige el código de país del backfill anterior.
--
-- El backfill de 20260922000004 derivó `codigo` con upper(left(pais, 2)), que
-- toma las dos primeras letras del NOMBRE, no el código ISO. "Estados Unidos"
-- quedó como 'ES', que es España. Heurística mala: los dos únicos viajes que
-- existían quedaron con el código equivocado.
--
-- Se corrigen a mano porque son dos filas y ambas son el mismo país. De aquí en
-- adelante el código lo escribe el frontend, que lo deriva del catálogo real
-- (src/modules/arriaza/constants/countries.ts) y no de las letras del nombre.
--
-- Si algún día se restaura una base vieja y se vuelve a correr el backfill, hay
-- que revisar `att_viaje_paises.codigo` antes de confiar en él.

update public.att_viaje_paises
   set codigo = 'US'
 where nombre = 'Estados Unidos'
   and codigo <> 'US';

NOTIFY pgrst, 'reload schema';

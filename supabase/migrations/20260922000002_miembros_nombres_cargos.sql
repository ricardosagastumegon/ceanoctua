-- Nombres por cargo para el resto de los miembros de junta.
--
-- Continúa 20260922000001: el `codigo` sigue siendo la llave técnica (ruta,
-- control de acceso, CSV del catálogo) y `nombre` es lo que la UI muestra.
--
-- AA y PE quedan fuera a propósito: el usuario los definió a ambos como
-- "Board", así que quedarían indistinguibles en la barra de pestañas. Se
-- llenan cuando se decida cómo diferenciarlos.

update public.miembros_board set nombre = 'Gerencia Agrícola'      where codigo = 'JA';
update public.miembros_board set nombre = 'Gerencia Administrativa' where codigo = 'LA';
update public.miembros_board set nombre = 'Gerencia LUM'            where codigo = 'JM';
update public.miembros_board set nombre = 'Gerente General'         where codigo = 'EG';

NOTIFY pgrst, 'reload schema';

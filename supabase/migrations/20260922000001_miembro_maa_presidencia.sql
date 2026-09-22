-- Renombra la etiqueta visible del miembro MAA a "Presidencia".
--
-- Por qué solo el nombre y no el código: `codigo` es la llave técnica. La usan
-- la ruta /maa, el control de acceso (un board_member solo ve su pestaña si su
-- código coincide) y la importación por CSV del catálogo. Cambiarlo obligaría a
-- mover ruta, carpeta del módulo y política, y rompería enlaces guardados, sin
-- que el usuario vea ninguna diferencia.
--
-- `nombre` es la columna que la UI muestra: MemberSummaryPage ya la pinta como
-- título de la página. Estaba sin llenar — repetía el código — desde el seed
-- original en 20260525000001_seed_miembros_board.sql.
--
-- Los otros seis miembros siguen con sus iniciales hasta que se definan sus
-- cargos. Cuando se definan, va aquí el mismo update para cada uno.

update public.miembros_board
   set nombre = 'Presidencia'
 where codigo = 'MAA';

NOTIFY pgrst, 'reload schema';

-- Cierra el nombrado de los miembros de junta: AA y PE son ambos "Board".
--
-- Que los dos se llamen igual es correcto: no son cargos distintos, son dos
-- personas que integran el Board. En la UI se distinguen por sus iniciales,
-- que es lo que el código ya era. El cargo aparece en el título de la página.

update public.miembros_board set nombre = 'Board' where codigo in ('AA', 'PE');

NOTIFY pgrst, 'reload schema';

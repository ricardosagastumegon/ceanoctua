-- CEA · firmas y to-dos pasan al permiso por modulo
--
-- POR QUE
--
-- `firmas` y `cea_todos` se protegian con el rol global viejo: o sos
-- admin/asistente --y entonces escribis en TODO el sistema-- o no escribis
-- nada. Para que la Gerente Administrativa pueda firmar hay que darle una de
-- esas dos llaves, y con cualquiera podria editar una solicitud de pago o una
-- liquidacion, que no es su trabajo.
--
-- El sistema por modulo ya existe y es el que usan los modulos nuevos:
-- `puede('cea','editor')` deja pasar al admin siempre, y a quien tenga ese
-- modulo en ese nivel. Asi su permiso queda acotado a lo que de verdad hace.
--
-- La lectura no se toca: sigue abierta a cualquiera con sesion, como estaba.
-- Lo que cambia es quien puede ESCRIBIR.
--
-- Hoy el unico usuario es el admin, que pasa por las dos vias, asi que esto
-- no le quita acceso a nadie.

drop policy if exists firmas_write on public.firmas;
create policy firmas_write on public.firmas for all
  using (public.puede('cea', 'editor'))
  with check (public.puede('cea', 'editor'));

drop policy if exists cea_todos_write on public.cea_todos;
create policy cea_todos_write on public.cea_todos for all
  using (public.puede('cea', 'editor'))
  with check (public.puede('cea', 'editor'));

NOTIFY pgrst, 'reload schema';

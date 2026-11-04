-- Fase 42 · Retirar los tableros por miembro (MAA, JA, LA, JM, AA, EG, PE)
--
-- Los siete botones de la barra superior abrian una pantalla de solo lectura
-- que resumia cinco tablas --tareas, viajes, eventos, notas, perfiles-- que
-- nunca se llenaron: cero filas en las cinco. Siempre decian «sin pendientes».
--
-- Esta migracion solo retira los permisos, que es lo unico que vive en la
-- base. El codigo de las pantallas se fue en el mismo commit.
--
-- ── Lo que NO se toca ───────────────────────────────────────────────────
--
-- `miembros_board` se queda con sus siete filas. No es parte de esos
-- tableros: de ahi cuelgan `firma_miembros` --el reparto de firmas
-- digitales, con filas vivas-- y la columna `usuarios.miembro_id`. Borrarla
-- apagaria las firmas.
--
-- Las cinco tablas vacias tampoco se tocan todavia. Estan sin uso y sin
-- costo, y un `drop table` no se deshace; se retiran en una migracion aparte
-- cuando se confirme que nadie las extraña (ver docs/PENDIENTES.md).
--
-- ── Por que un DELETE y no un soft delete ───────────────────────────────
--
-- `usuario_modulos` no es una tabla de negocio sino el reparto de permisos,
-- y no tiene `deleted_at`: asi es como la pantalla de Admin revoca un
-- acceso. El trigger `audit_usuario_modulos` deja constancia de cada fila
-- retirada, que es lo que exige la Regla 0.

do $$
declare
  v_antes int;
  v_despues int;
  v_firmas int;
begin
  select count(*) into v_antes
    from public.usuario_modulos
    where modulo in ('maa', 'ja', 'la', 'jm', 'aa', 'eg', 'pe');

  delete from public.usuario_modulos
    where modulo in ('maa', 'ja', 'la', 'jm', 'aa', 'eg', 'pe');

  select count(*) into v_despues
    from public.usuario_modulos
    where modulo in ('maa', 'ja', 'la', 'jm', 'aa', 'eg', 'pe');

  if v_despues <> 0 then
    raise exception 'Quedaron % permisos de tableros por miembro. No se guarda nada.', v_despues;
  end if;

  -- Red de seguridad: si esto toco las firmas, algo se entendio mal.
  select count(*) into v_firmas from public.firma_miembros;
  if v_firmas < 1 then
    raise exception 'firma_miembros quedo en % filas. No se guarda nada.', v_firmas;
  end if;

  raise notice 'Permisos retirados: %. Firmas intactas: %.', v_antes, v_firmas;
end $$;

NOTIFY pgrst, 'reload schema';

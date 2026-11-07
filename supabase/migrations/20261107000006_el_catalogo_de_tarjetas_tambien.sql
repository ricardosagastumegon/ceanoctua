-- Fase 51 · El catalogo de tarjetas, tambien fuera
--
-- Quedo suelto al cerrar los consumos: `tc_consumos` paso a pedir
-- `finanzas:editor` pero `tarjetas_credito` se quedo en `observador`, asi que
-- quien firma seguia viendo las doce tarjetas con su titular, su banco y su
-- LIMITE. La usuaria lo zanjo en una linea: «si, dejalos afuera».
--
-- SE COMPROBO ANTES QUE NO ROMPE ARRIBA. El catalogo lo consume Arriaza T&T
-- --los cargos de un servicio se pagan con una tarjeta-- y Lissa tiene ese
-- modulo, asi que cerrarlo a lo bruto era justo la clase de degradacion
-- silenciosa que esta fase viene evitando.
--
-- No lo es, por dos razones que se miraron en el codigo y no se supusieron:
--
--   · `att_cargos` guarda `pagado_con` COMO TEXTO al lado de `pagado_con_id`.
--     Las vistas de solo lectura pintan ese texto y no tocan el catalogo.
--   · los unicos que leen `tarjetas_credito` son formularios de edicion
--     --`CargosEditor`, `PaymentMethodSelect`, el modal de cruceros-- y
--     escribir en T&T pide `tt:editor`, que Lissa no tiene.
--
-- O sea: pierde un desplegable en pantallas donde de todos modos no puede
-- guardar, y no pierde ningun dato que estuviera viendo.

-- DOS politicas lo abrian, no una. `tarjetas_credito_read_tt` lo concedia a
-- cualquiera con `tt:observador`, que es exactamente el permiso de Lissa; por
-- ahi seguia entrando aunque se apretara la otra. Dos politicas permisivas
-- sobre la misma tabla se suman, asi que cerrar una sola no cierra nada --y
-- en una revision rapida parece hecho. Se funden en una.

drop policy if exists tarjetas_credito_read_tt on public.tarjetas_credito;
drop policy if exists tarjetas_credito_read on public.tarjetas_credito;
create policy tarjetas_credito_read on public.tarjetas_credito for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('finanzas', 'editor')
    -- Quien opera T&T sigue necesitando escoger con que tarjeta se paga un
    -- cargo. Es un permiso de trabajo, no de lectura.
    or public.puede('tt', 'editor')
  );

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_u   record;
  v_n   bigint;
  v_rep text := '';
  v_mal text := '';
begin
  for v_u in
    select id,
           case when rol = 'admin' then 'angeles'
                when email = 'larriaza@sion.com.gt' then 'lissa'
                when email = 'jarriaza@sion.com.gt' then 'javier'
                else 'otro' end as quien
      from public.usuarios where activo
  loop
    if v_u.quien = 'otro' then continue; end if;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u.id::text, 'role','authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_n from public.tarjetas_credito;
    v_rep := v_rep || format('%s.tarjetas=%s ', v_u.quien, v_n);
    if v_u.quien = 'angeles' and v_n = 0 then
      v_mal := v_mal || 'Angeles perdio el catalogo de tarjetas; ';
    end if;
    if v_u.quien <> 'angeles' and v_n > 0 then
      v_mal := v_mal || format('%s sigue viendo las tarjetas; ', v_u.quien);
    end if;

    -- Y que a Lissa no se le haya caido nada de lo suyo por el camino: los
    -- cargos de T&T llevan el nombre de la tarjeta encima, asi que los sigue
    -- viendo aunque no vea el catalogo.
    if v_u.quien = 'lissa' then
      select count(*) into v_n from public.att_cargos;
      v_rep := v_rep || format('lissa.cargos=%s ', v_n);
      if v_n = 0 then
        v_mal := v_mal || 'Lissa perdio los cargos de T&T; ';
      end if;
      select count(*) into v_n from public.att_viajes;
      v_rep := v_rep || format('lissa.viajes=%s ', v_n);
      if v_n = 0 then
        v_mal := v_mal || 'Lissa perdio los viajes; ';
      end if;
    end if;

    perform set_config('role', 'postgres', true);
  end loop;

  perform set_config('request.jwt.claims', '', true);

  -- Y que no quede ninguna otra politica abriendo la tabla por detras: asi
  -- es como se colo esta.
  if (select count(*) from pg_policies
       where schemaname='public' and tablename='tarjetas_credito' and cmd='SELECT') <> 1 then
    v_mal := v_mal || 'quedo mas de una politica de lectura sobre tarjetas_credito; ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

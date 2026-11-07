-- Fase 51 · Quien firma ve lo que firma, no la operacion entera
--
-- SALIO DE CREAR EL USUARIO DE JAVIER. Se le dio lo que la usuaria pidio
-- --su tablero, Finanzas para las solicitudes de firma, y Aeronaves-- y al
-- medir que veia de verdad aparecieron las 22 liquidaciones de caja chica,
-- los 25 vales, los reintegros y los consumos de tarjeta.
--
-- No venia del modulo de Finanzas: venia del ROL `solo_lectura`, que abre
-- seis tablas de golpe sin mirar modulos --`pagos`, las dos de caja chica,
-- `reintegros`, `tc_consumos` y `vouchers`. Se escribio cuando la unica
-- persona de solo lectura era Lissa, que si necesita ver lo que firma;
-- Javier lo heredo entero por necesitar `pagos` para firmar.
--
-- La decision la tomo ella, sabiendo que alcanza a Lissa: «ni Javier ni
-- Lissa verian caja chica, reintegros ni consumos de tarjeta. Seguirian
-- viendo las solicitudes de pago que firman, con su expediente adjunto».
--
-- LA LINEA QUEDA ASI: `solo_lectura` sirve para FIRMAR, no para mirar la
-- operacion. Lo que se firma --`pagos`, sus avisos, sus firmas y su
-- expediente-- se queda abierto. Lo que se opera pasa a pedir su modulo.
--
-- QUE NO SE TOCA, y conviene decirlo porque es donde estaria el fallo
-- silencioso: `pagos`, `firmas` y `pagos_notificaciones`. Los avisos son la
-- tripa de la solicitud --el imprimible oficial lista con ellos las
-- liquidaciones que cubre-- asi que cerrarlos dejaria la hoja firmada con un
-- bloque en blanco. Quien firma tiene que seguir viendo QUE cubre lo que
-- firma; lo que deja de ver es el resto de la caja chica que no va en esa
-- solicitud.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Caja chica, incluidos sus vouchers
-- ══════════════════════════════════════════════════════════════════════
--
-- Se pide el modulo. Se deja `admin`/`asistente` porque es el patron del
-- proyecto para una tabla financiera y porque quien opera caja chica puede
-- no tener la fila de modulo todavia --Zonia, cuando llegue, la tendra.

drop policy if exists caja_chica_liquidaciones_select on public.caja_chica_liquidaciones;
create policy caja_chica_liquidaciones_select on public.caja_chica_liquidaciones for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('caja_chica', 'observador')
  );

drop policy if exists caja_chica_vales_select on public.caja_chica_vales;
create policy caja_chica_vales_select on public.caja_chica_vales for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('caja_chica', 'observador')
  );

drop policy if exists vouchers_select on public.vouchers;
create policy vouchers_select on public.vouchers for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('caja_chica', 'observador')
  );

-- El detalle iba por otro camino --lo abria `finanzas:observador`, de la
-- fase 45-- y por ahi se colaba entero: 53 renglones y 13 vales. De poco
-- sirve cerrar la cabecera si el detalle sigue abierto; es el mismo descuido
-- que la fase 45 vino a arreglar, repetido por el otro lado.

drop policy if exists "liq_rows read" on public.caja_chica_liq_rows;
create policy "liq_rows read" on public.caja_chica_liq_rows for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('caja_chica', 'observador')
  );

drop policy if exists liq_vales_read on public.liquidacion_vales;
create policy liq_vales_read on public.liquidacion_vales for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('caja_chica', 'observador')
  );

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Reintegros y consumos de tarjeta
-- ══════════════════════════════════════════════════════════════════════
--
-- Son secciones de Finanzas que se OPERAN, no que se firmen. Se piden con
-- `editor`, que es la granularidad que ya existe: `observador` queda para
-- quien solo mira lo que firma --Lissa y Javier-- y `editor` para quien
-- trabaja el modulo.

drop policy if exists reintegros_select on public.reintegros;
create policy reintegros_select on public.reintegros for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('finanzas', 'editor')
  );

drop policy if exists tc_consumos_select on public.tc_consumos;
create policy tc_consumos_select on public.tc_consumos for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('finanzas', 'editor')
  );

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════
--
-- Con las sesiones reales y `set local role authenticated`. Importan las dos
-- mitades: que dejen de ver la operacion Y que NO pierdan lo que firman. Una
-- politica apretada de mas no da error --deja la pantalla vacia-- y eso no
-- se nota hasta que alguien tiene que firmar algo.

do $$
declare
  v_t    text;
  v_n    bigint;
  v_u    record;
  v_rep  text := '';
  v_mal  text := '';
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

    -- Lo que dejan de ver.
    foreach v_t in array array[
      'caja_chica_liquidaciones','caja_chica_vales','caja_chica_liq_rows',
      'liquidacion_vales','vouchers','reintegros','tc_consumos'
    ] loop
      begin execute format('select count(*) from public.%I', v_t) into v_n;
      exception when others then v_n := 0; end;
      if v_u.quien <> 'angeles' and v_n > 0 then
        v_mal := v_mal || format('%s sigue viendo %s (%s); ', v_u.quien, v_t, v_n);
      end if;
      if v_u.quien = 'angeles' then
        v_rep := v_rep || format('angeles.%s=%s ', v_t, v_n);
      end if;
    end loop;

    -- Lo que NO pueden perder.
    foreach v_t in array array['pagos','firmas','pagos_notificaciones'] loop
      begin execute format('select count(*) from public.%I', v_t) into v_n;
      exception when others then v_n := 0; end;
      v_rep := v_rep || format('%s.%s=%s ', v_u.quien, v_t, v_n);
      if v_n = 0 then
        v_mal := v_mal || format('%s perdio %s, que es lo que firma; ', v_u.quien, v_t);
      end if;
    end loop;

    perform set_config('role', 'postgres', true);
  end loop;

  perform set_config('request.jwt.claims', '', true);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

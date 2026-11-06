-- Fase 45 · Cerrar el detalle, que era lo que de verdad se veia
--
-- La migracion 000007 acoto `firmas` y `tarjetas_credito`. El barrido que se
-- hizo despues --consultar LAS 104 TABLAS con la sesion del usuario mas
-- restringido-- encontro que no eran las peores. Quedaban estas seis:
--
--   caja_chica_liq_rows   53 filas   el detalle de los gastos
--   cea_todos             40 filas   la lista de pendientes de la asistente
--   pagos_notificaciones  18 filas   avisos de pago, CON MONTO Y CONCEPTO
--   liquidacion_vales     13 filas   que vale entra en que liquidacion
--   firma_miembros         5 filas   a quien iba dirigido cada documento
--   cea_notas_entrega      2 filas   entregas fisicas
--
-- EL PATRON ES EL MISMO QUE DESTAPO LA FASE 44 CON LA AUDITORIA: la cabecera
-- protegida y el detalle no. Se acota `caja_chica_liquidaciones` y sus 53
-- renglones quedan abiertos. Se acota `firmas` y `firma_miembros` queda
-- abierta. `consumo_renglones` solo esta a salvo porque esta vacia --el dia
-- que tenga datos, se ven.
--
-- No parece decision de nadie: las politicas se escribieron tabla por tabla y
-- las de detalle heredaron la regla permisiva por omision. `liq_rows read`
-- llegaba al extremo de ser `USING (true)`, sin siquiera pedir sesion.
--
-- A CADA UNA SE LE PIDE EL MODULO DESDE EL QUE SE LEE, mirado en el codigo y
-- no inventado:
--
--   caja_chica_liq_rows   modules/cc-board/liquidaciones  -> caja_chica o finanzas
--   liquidacion_vales     modules/cc-board/liquidaciones  -> caja_chica o finanzas
--   cea_todos             modules/cea/todos               -> cea
--   firma_miembros        modules/cea/firmas              -> cea
--   cea_notas_entrega     modules/cea/notas-entrega       -> cea
--   pagos_notificaciones  modules/finanzas/pagos          -> finanzas
--
-- Solo se tocan las politicas de SELECT. Las de escritura se quedan como
-- estaban: esta migracion cierra lecturas, no cambia quien puede escribir.

-- ── El detalle de caja chica ───────────────────────────────────────────
--
-- `liq_rows read` era `USING (true)`: ni siquiera exigia sesion. Es la que
-- mas datos dejaba ver de las seis.

drop policy if exists "liq_rows read" on public.caja_chica_liq_rows;
create policy "liq_rows read" on public.caja_chica_liq_rows for select
  using (
    public.puede('caja_chica', 'observador')
    or public.puede('finanzas', 'observador')
  );

drop policy if exists liq_vales_read on public.liquidacion_vales;
create policy liq_vales_read on public.liquidacion_vales for select
  using (
    public.puede('caja_chica', 'observador')
    or public.puede('finanzas', 'observador')
  );

-- ── Lo de CEA ──────────────────────────────────────────────────────────

drop policy if exists cea_todos_read on public.cea_todos;
create policy cea_todos_read on public.cea_todos for select
  using (public.puede('cea', 'observador'));

drop policy if exists firma_miembros_read on public.firma_miembros;
create policy firma_miembros_read on public.firma_miembros for select
  using (public.puede('cea', 'observador'));

drop policy if exists cea_notas_entrega_read on public.cea_notas_entrega;
create policy cea_notas_entrega_read on public.cea_notas_entrega for select
  using (public.puede('cea', 'observador'));

-- ── Los avisos de pago ─────────────────────────────────────────────────
--
-- Se mantiene intacta `pagos_notif_combustible_read`, que deja ver los avisos
-- del combustible de AERONAVES a quien tenga ese modulo. Son dos reglas
-- distintas y conviven: la de abajo es la general.

drop policy if exists pagos_notif_read on public.pagos_notificaciones;
create policy pagos_notif_read on public.pagos_notificaciones for select
  using (public.puede('finanzas', 'observador'));

-- ── Comprobacion ───────────────────────────────────────────────────────
--
-- Con las tres sesiones reales y `set local role authenticated`: sin eso la
-- consulta corre como superusuario, RLS ni se aplica, y la prueba da verde
-- sin probar nada.
--
-- Importa tanto que Victor las pierda como que Lissa NO. Acotar de mas rompe
-- a quien si debia entrar, y eso no se nota hasta que ella abre la aplicacion.

do $$
declare
  v_tablas text[] := array[
    'caja_chica_liq_rows', 'liquidacion_vales', 'cea_todos',
    'firma_miembros', 'cea_notas_entrega', 'pagos_notificaciones'
  ];
  v_u      record;
  v_t      text;
  v_n      bigint;
  v_rep    text := '';
  v_mal    text := '';
begin
  for v_u in
    select id, email,
           case when rol = 'admin' then 'angeles'
                when email = 'larriaza@sion.com.gt' then 'lissa'
                when email = 'vmurillo@sion.com.gt' then 'victor'
                else 'otro' end as quien
      from public.usuarios where activo
  loop
    if v_u.quien = 'otro' then continue; end if;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u.id::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    foreach v_t in array v_tablas loop
      begin
        execute format('select count(*) from public.%I', v_t) into v_n;
      exception when others then
        v_n := -1;
      end;

      v_rep := v_rep || format('%s.%s=%s ', v_u.quien, v_t, v_n);

      if v_u.quien = 'victor' and v_n > 0 then
        v_mal := v_mal || format('Victor SIGUE viendo %s (%s); ', v_t, v_n);
      end if;
      -- Lissa y Angeles tienen que conservar lo suyo. Se mide contra cero
      -- solo donde hay datos: una tabla vacia no prueba nada.
      if v_u.quien <> 'victor' and v_n <= 0
         and v_t in ('caja_chica_liq_rows', 'cea_todos', 'firma_miembros',
                     'liquidacion_vales', 'pagos_notificaciones') then
        v_mal := v_mal || format('%s PERDIO %s; ', v_u.quien, v_t);
      end if;
    end loop;

    perform set_config('role', 'postgres', true);
  end loop;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || lecturas: %', v_mal, v_rep;
  end if;

  raise notice 'Cerrado || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

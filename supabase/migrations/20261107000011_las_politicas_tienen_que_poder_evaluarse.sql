-- Fase 54 · Una politica tiene que poder evaluarse, tambien para `anon`
--
-- LO ENCONTRO UN SONDEO, no una pantalla: una consulta sin sesion contra
-- `pagos_notificaciones` devolvia
--
--   401 · permission denied for function firma_mia_del_pago
--
-- en vez de una lista vacia. Y lo mismo pasaba desde la fase 45 con
-- `usa_catalogos_de_personas`, sin que nadie lo notara porque la aplicacion
-- siempre entra con sesion.
--
-- EL ERROR CONCEPTUAL ES MIO, y conviene dejarlo escrito porque lo voy a
-- repetir si no. Hay DOS clases de funcion y les corresponden permisos
-- opuestos:
--
--   · LAS QUE HACEN ALGO --`comb_borrar_solicitud`, `firma_firmar`,
--     `pago_avanzar_paso`, `envio_aceptar`. Son acciones; se invocan como
--     RPC. A `anon` se le quitan, y eso esta bien.
--
--   · LAS QUE RESPONDEN SI O NO dentro de una politica --`puede`,
--     `auth_rol`, `es_firmante`, `firma_mia_del_pago`... No se invocan: las
--     ejecuta Postgres al filtrar, CON EL ROL DE QUIEN CONSULTA. Si ese rol
--     no puede ejecutarlas, la consulta no devuelve «nada»: revienta.
--
-- Quitarselas a `anon` no cierra ninguna puerta --la respuesta para `anon`
-- es `false` de todas formas, porque `auth.uid()` es nulo-- y a cambio
-- convierte un «no hay filas» en un error. Por eso las que ya venian de
-- antes (`puede`, `auth_rol`, `es_admin`, `rango_permiso`) siempre
-- estuvieron concedidas: la convencion estaba bien y yo me la salte.

grant execute on function public.puede_ver_pago(uuid)                to anon;
grant execute on function public.pago_del_documento(text, uuid)      to anon;
grant execute on function public.es_estampa_de_firma(text)           to anon;
grant execute on function public.es_firmante(uuid)                   to anon;
grant execute on function public.firma_mia_del_pago(uuid)            to anon;
grant execute on function public.usa_catalogos_de_personas()         to anon;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion · y la regla, encodada
-- ══════════════════════════════════════════════════════════════════════
--
-- Se recorren TODAS las politicas de `public`, se busca en su texto el
-- nombre de cada funcion del esquema, y se exige que las que aparecen sean
-- ejecutables por `anon`. Asi la proxima vez que alguien --yo-- escriba una
-- politica apoyada en una funcion nueva y se olvide del grant, la migracion
-- no pasa en vez de dejar un 401 esperando a que alguien lo encuentre.

do $$
declare
  v_f    record;
  v_mal  text := '';
  v_usadas text := '';
begin
  for v_f in
    select p.oid, p.proname,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as firma
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     -- Cualquier tipo de retorno, no solo booleano: `pago_del_documento`
     -- devuelve un uuid y se usa dentro de una politica igual que las demas.
     -- Limitarlo a `boolean` dejaba justo esa fuera, que es como se escapan.
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    -- Aparece en alguna politica?
    if exists (
      select 1 from pg_policies
       where schemaname in ('public','storage')
         and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) like '%' || v_f.proname || '(%'
    ) then
      v_usadas := v_usadas || v_f.proname || ' ';
      if not has_function_privilege('anon', v_f.oid, 'execute') then
        v_mal := v_mal || format(
          '%s se usa en una politica y `anon` no puede ejecutarla: la consulta daria 401 en vez de vacio; ',
          v_f.proname);
      end if;
    end if;
  end loop;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: %', v_mal;
  end if;
  raise notice 'Funciones que evaluan politicas: %', v_usadas;
end $$;

NOTIFY pgrst, 'reload schema';

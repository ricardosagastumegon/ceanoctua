-- Fase 58 · La SP lleva el respaldo de TODAS sus liquidaciones
--
-- LO QUE ENCONTRO: SP-2026-0011 agrupa cuatro liquidaciones de caja chica
-- --CC-2026-0019, 0020, 0021 y 0022-- pero solo una de ellas resuelve a su
-- solicitud. Preguntarle al sistema «a que SP pertenece CC-2026-0021»
-- devuelve NADA.
--
-- POR QUE: una SP guarda su origen en dos lugares distintos y solo se estaba
-- leyendo uno.
--
--   · `pagos.origen_notificacion_id` es UNA columna, asi que cuando una SP
--     agrupa varios avisos solo puede apuntar a uno. Es el lado «uno».
--   · `pagos_notificaciones.pago_id` lo lleva cada aviso, asi que los cuatro
--     saben a que SP se fueron. Es el lado «varios», y es el que vale.
--
-- `pago_del_documento` unia solo por el primero. La pantalla del expediente
-- --`useOrigenes`-- ya leia por el segundo, asi que las dos no estaban
-- hablando de lo mismo: el expediente LISTA las cuatro liquidaciones, pero la
-- politica de `documentos` solo dejaba leer los adjuntos de una.
--
-- A QUIEN LE PEGABA: a quien firma. La politica dice
--
--   auth_rol() in ('admin','asistente')  OR  puede_ver_pago(pago_del_documento(...))
--
-- asi que la asistente y el admin veian todo de todas formas y el hueco no se
-- notaba. Lissa o Javier, abriendo SP-2026-0011 para firmarla, veian las
-- cuatro liquidaciones listadas y los adjuntos de UNA. Sin error, sin aviso:
-- el expediente simplemente llegaba sin parte de su respaldo.
--
-- EL ARREGLO: resolver por los dos caminos. Se deja el viejo porque las SP
-- creadas antes de que `pago_id` se guardara solo tienen ese.
--
-- Nota de costo: el `or` en el join no deja usar indice, y aqui da igual
-- --documentos 4 filas, avisos 22, pagos 11-- pero queda dicho por si algun
-- dia crecen: lo que lo arreglaria es un union all, no un indice.

create or replace function public.pago_del_documento(p_tipo text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id
    from public.pagos_notificaciones n
    join public.pagos p
      -- Los dos caminos: el aviso sabe a que SP se fue (lado «varios», el que
      -- sobrevive cuando una SP agrupa a varios), y la SP recuerda cual aviso
      -- la origino (lado «uno», el unico que tienen las SP viejas).
      on p.id = n.pago_id or p.origen_notificacion_id = n.id
   where p.deleted_at is null
     and (
       -- El camino de siempre: el documento cuelga del papel que origino la SP.
       (
         n.origen_id = p_id
         and n.origen_tipo = case p_tipo
               when 'comb_reporte'           then 'combustible_vehiculos'
               when 'caja_chica_liquidacion' then 'liquidacion'
               when 'consumo'                then 'consumo_tc'
               when 'avn_combustible'        then 'combustible'
               when 'avn_liquidacion'        then 'avn_liquidacion'
               else null
             end
       )
       -- El salto de dos: la foto cuelga del gasto, el gasto de la liquidacion.
       or (
         p_tipo = 'avn_liq_gasto'
         and n.origen_tipo = 'avn_liquidacion'
         and n.origen_id = (
           select g.liquidacion_id from public.avn_liquidacion_gastos g where g.id = p_id
         )
       )
     )
   order by p.created_at
   limit 1;
$$;

comment on function public.pago_del_documento(text, uuid) is
  'A que solicitud de pago pertenece un documento de origen. Resuelve por los '
  'dos enlaces: pagos_notificaciones.pago_id (vale cuando una SP agrupa varias) '
  'y pagos.origen_notificacion_id (lo unico que tienen las SP viejas).';

-- OJO: `anon` TAMBIEN. Una funcion usada como predicado de politica tiene que
-- ser ejecutable por anon, o la consulta devuelve 401 en vez de cero filas.
-- Esto ya se rompio una vez (fase 54) y se volvio a romper en la 57.
revoke execute on function public.pago_del_documento(text, uuid) from public;
grant  execute on function public.pago_del_documento(text, uuid) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal  text := '';
  v_rep  text := '';
  v_sp   uuid;
  v_n    int;
  r      record;
begin
  -- 1 · Las cuatro liquidaciones de SP-2026-0011 resuelven a SP-2026-0011.
  select id into v_sp from public.pagos where serial = 'SP-2026-0011' and deleted_at is null;
  if v_sp is null then
    v_rep := v_rep || 'SP-2026-0011 no existe (nada que comprobar ahi); ';
  else
    for r in
      select l.id, l.serial
        from public.caja_chica_liquidaciones l
        join public.pagos_notificaciones n
          on n.origen_tipo = 'liquidacion' and n.origen_id = l.id
       where n.pago_id = v_sp
    loop
      if public.pago_del_documento('caja_chica_liquidacion', r.id) is distinct from v_sp then
        v_mal := v_mal || format('%s no resuelve a SP-2026-0011; ', r.serial);
      else
        v_n := coalesce(v_n, 0) + 1;
      end if;
    end loop;
    v_rep := v_rep || format('liquidaciones de SP-2026-0011 que resuelven: %s; ', coalesce(v_n, 0));
    if coalesce(v_n, 0) < 2 then
      v_mal := v_mal || 'se esperaban al menos 2 liquidaciones agrupadas; ';
    end if;
  end if;

  -- 2 · Ninguna regresion: todo aviso con pago vivo tiene que resolver.
  select count(*) into v_n
    from public.pagos_notificaciones n
    join public.pagos p on p.id = n.pago_id and p.deleted_at is null
   where n.origen_tipo = 'liquidacion'
     and public.pago_del_documento('caja_chica_liquidacion', n.origen_id) is null;
  if v_n > 0 then
    v_mal := v_mal || format('%s avisos con pago vivo NO resuelven; ', v_n);
  end if;

  -- 3 · El salto de dos de la liquidacion del piloto sigue entero.
  select count(*) into v_n
    from public.avn_liquidacion_gastos g
    join public.pagos_notificaciones n
      on n.origen_tipo = 'avn_liquidacion' and n.origen_id = g.liquidacion_id
    join public.pagos p on (p.id = n.pago_id or p.origen_notificacion_id = n.id)
                       and p.deleted_at is null
   where public.pago_del_documento('avn_liq_gasto', g.id) is null;
  if v_n > 0 then
    v_mal := v_mal || format('%s gastos del piloto perdieron su SP; ', v_n);
  end if;

  -- 4 · Nada resuelve a una SP borrada.
  select count(*) into v_n
    from public.pagos_notificaciones n
    join public.pagos p on p.id = public.pago_del_documento(
           case n.origen_tipo
             when 'liquidacion'            then 'caja_chica_liquidacion'
             when 'combustible_vehiculos'  then 'comb_reporte'
             when 'consumo_tc'             then 'consumo'
             when 'combustible'            then 'avn_combustible'
             when 'avn_liquidacion'        then 'avn_liquidacion'
             else null end, n.origen_id)
   where p.deleted_at is not null;
  if v_n > 0 then
    v_mal := v_mal || format('%s documentos resuelven a una SP borrada; ', v_n);
  end if;

  -- 5 · Los permisos. anon TIENE que poder ejecutarla.
  if not has_function_privilege('anon', 'public.pago_del_documento(text, uuid)', 'execute') then
    v_mal := v_mal || 'anon NO puede ejecutar pago_del_documento (daria 401, no lista vacia); ';
  end if;
  if not has_function_privilege('authenticated', 'public.pago_del_documento(text, uuid)', 'execute') then
    v_mal := v_mal || 'authenticated no puede ejecutar pago_del_documento; ';
  end if;

  -- 6 · La politica de documentos la sigue usando.
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.documentos'::regclass
       and polname = 'documentos_read'
       and pg_get_expr(polqual, polrelid) like '%pago_del_documento%'
  ) then
    v_mal := v_mal || 'documentos_read ya no usa pago_del_documento; ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

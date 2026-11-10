-- Fase 59 · El camino de vuelta
--
-- LO QUE PASO. Ella quiso limpiar datos de prueba en Combustible y no pudo:
--
--   · «Borrar» en las solicitudes de vale fallaba con «No se pudo borrar.»,
--     sin decir por que. El motivo real: los tres vales viven en el control
--     CV-2026-0001, y `comb_borrar_solicitud` se niega --bien-- a sacarle un
--     renglon a un control que ya no esta abierto.
--   · El control CV-2026-0001 no tenia boton de borrar: solo se dibuja en
--     estado «abierto», y el esta en «enviado_a_pagos».
--   · Borro la solicitud de pago SP-2026-0018 y Victor la sigue viendo en su
--     bandeja, esperando recibirla. Un documento que ya no existe.
--
-- EL PATRON. Cada paso hacia adelante de esta cadena tiene su funcion en el
-- servidor --`comb_cerrar_reporte`, `comb_enviar_a_pagos`--, pero los pasos de
-- vuelta no existen o estan a medias. La cadena es de una sola direccion y
-- quien se equivoca a mitad se queda ahi:
--
--   abierto  --Cerrar-->  cerrado  --Enviar-->  enviado_a_pagos
--      ^                     ?                        |
--      |                     |                        |
--      +--- no habia --------+   <--- Revertir (desde Pagos, ya existe)
--
-- Esto agrega el eslabon que faltaba y completa el borrado de un pago.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Reabrir un control de vales
-- ══════════════════════════════════════════════════════════════════════
-- El inverso exacto de `comb_cerrar_reporte`: descongela el total y devuelve
-- los vales al estado del que salieron.
--
-- Cerrar los movio de 'documentada'/'despachada' a 'en_reporte'. El inverso
-- NO se acuerda de cual era cada uno: lo reconstruye de los datos del vale
-- --tiene factura, tiene despacho-- igual que lo hace el trigger
-- `comb_solicitudes_estado_factura`. Un estado que se guarda aparte es un
-- estado que se desincroniza; uno que se deduce, no.
--
-- Desde 'enviado_a_pagos' NO reabre, y es a proposito: ese camino de vuelta
-- ya existe y vive en otro lado. Ella lo pidio asi --«esta accion se podra
-- revertir unica y exclusivamente desde PAGOS»-- y tener dos puertas para lo
-- mismo es tener dos verdades.

create or replace function public.comb_reabrir_reporte(p_reporte uuid)
returns public.comb_reportes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rep public.comb_reportes;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'Solo el administrador puede reabrir un control de vales.';
  end if;

  select * into v_rep from public.comb_reportes
   where id = p_reporte and deleted_at is null for update;
  if not found then
    raise exception 'El control de vales no existe.';
  end if;

  if v_rep.estado = 'abierto' then
    raise exception 'El control % ya esta abierto.', v_rep.serial;
  end if;
  if v_rep.estado <> 'cerrado' then
    raise exception
      'El control % esta %. Para devolverlo, revierte el envio desde Pagos.',
      v_rep.serial, v_rep.estado;
  end if;

  update public.comb_reportes
     set estado = 'abierto',
         total = null,
         updated_by = auth.uid()
   where id = p_reporte
  returning * into v_rep;

  update public.comb_solicitudes s
     set estado = case
           when s.factura_id is not null then 'documentada'
           when s.monto      is not null then 'despachada'
           else s.estado
         end,
         updated_by = auth.uid()
   where s.reporte_id = p_reporte
     and s.deleted_at is null
     and s.estado = 'en_reporte';

  return v_rep;
end $$;

comment on function public.comb_reabrir_reporte(uuid) is
  'Inverso de comb_cerrar_reporte: devuelve el control a «abierto», descongela '
  'el total y reconstruye el estado de cada vale desde sus datos. Solo admin. '
  'No reabre un control ya enviado a Pagos: eso se revierte desde Pagos.';

revoke execute on function public.comb_reabrir_reporte(uuid) from public, anon;
grant  execute on function public.comb_reabrir_reporte(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Borrar una solicitud de pago devuelve lo que arrastro
-- ══════════════════════════════════════════════════════════════════════
-- Hasta ahora borrar una SP era un `update pagos set deleted_at = now()` desde
-- el cliente, y dejaba dos cosas vivas:
--
--   · el ENVIO al tesorero. Victor sigue viendo «SP-2026-0018 · esperando que
--     la recibas» de un documento que ya no existe, y no puede ni abrirlo ni
--     quitarselo de encima. La regla ya estaba escrita en
--     `comb_borrar_solicitud` --«un envio cuyo documento ya no existe es una
--     bandeja que el Tesorero no puede resolver ni quitarse de encima»-- pero
--     no se habia aplicado aqui.
--   · los AVISOS que la originaron, con su `pago_id` apuntando a una SP
--     muerta. El documento de origen queda creyendo que ya viaja en una
--     solicitud que no existe.
--
-- A DONDE VUELVE EL AVISO: a la bandeja, pendiente. No mas atras. Borrar la
-- solicitud deshace LA SOLICITUD, no el envio: el gasto se mando a Pagos y
-- sigue necesitando pagarse, asi que vuelve a la fila para entrar en otra. Si
-- ademas hay que deshacer el envio, ese boton ya existe y es el ↩ Revertir de
-- la bandeja. Dos pasos, cada uno con su significado, en vez de uno que
-- adivina cual de los dos querias.

create or replace function public.pago_borrar(p_pago uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_p public.pagos;
begin
  if public.auth_rol() not in ('admin', 'asistente') then
    raise exception 'No tiene permiso para borrar una solicitud de pago.';
  end if;

  select * into v_p from public.pagos
   where id = p_pago and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud de pago no existe o ya se habia borrado.';
  end if;

  update public.pagos
     set deleted_at = now()
   where id = p_pago;

  -- La bandeja del tesorero no puede quedar con un documento fantasma.
  update public.envios
     set deleted_at = now()
   where doc_tipo = 'pago'
     and doc_id = p_pago
     and deleted_at is null;

  -- Los avisos vuelven a la fila: el gasto sigue necesitando pagarse.
  update public.pagos_notificaciones
     set pago_id = null,
         procesado = false,
         procesado_at = null
   where pago_id = p_pago;

  -- Y el aviso que la origino, para las SP viejas que solo tienen ese enlace.
  update public.pagos_notificaciones
     set procesado = false,
         procesado_at = null
   where id = v_p.origen_notificacion_id
     and pago_id is null;
end $$;

comment on function public.pago_borrar(uuid) is
  'Borrado suave de una solicitud de pago que ademas retira su envio al '
  'tesorero y devuelve sus avisos a la bandeja, pendientes. El documento de '
  'origen no se toca: para deshacer tambien el envio esta el Revertir.';

revoke execute on function public.pago_borrar(uuid) from public, anon;
grant  execute on function public.pago_borrar(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Limpiar lo que el borrado viejo dejo colgando
-- ══════════════════════════════════════════════════════════════════════
-- Los envios vivos de solicitudes de pago ya borradas. Hoy hay uno
-- --SP-2026-0018, en la bandeja de Victor-- pero se escribe como regla y no
-- como un id a mano, por si hay mas de los que vimos.

update public.envios e
   set deleted_at = now()
 where e.doc_tipo = 'pago'
   and e.deleted_at is null
   and exists (
     select 1 from public.pagos p
      where p.id = e.doc_id and p.deleted_at is not null
   );

-- Y los avisos que quedaron apuntando a una SP muerta.
update public.pagos_notificaciones n
   set pago_id = null,
       procesado = false,
       procesado_at = null
 where n.pago_id is not null
   and exists (
     select 1 from public.pagos p
      where p.id = n.pago_id and p.deleted_at is not null
   );

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_fn  text;
  v_n   int;
begin
  -- Las dos funciones existen, y con los permisos de un ACTO: anon no.
  foreach v_fn in array array['comb_reabrir_reporte', 'pago_borrar'] loop
    if not exists (
      select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = v_fn
    ) then
      v_mal := v_mal || format('falta %s; ', v_fn);
    elsif has_function_privilege('anon', format('public.%s(uuid)', v_fn), 'execute') then
      v_mal := v_mal || format('anon puede ejecutar %s; ', v_fn);
    elsif not has_function_privilege('authenticated', format('public.%s(uuid)', v_fn), 'execute') then
      v_mal := v_mal || format('authenticated no puede ejecutar %s; ', v_fn);
    end if;
  end loop;

  -- Ningun envio vivo de un pago borrado.
  select count(*) into v_n
    from public.envios e join public.pagos p on p.id = e.doc_id
   where e.doc_tipo = 'pago' and e.deleted_at is null and p.deleted_at is not null;
  if v_n > 0 then
    v_mal := v_mal || format('%s envios de pagos borrados siguen vivos; ', v_n);
  end if;

  -- Ningun aviso apuntando a una SP muerta.
  select count(*) into v_n
    from public.pagos_notificaciones n join public.pagos p on p.id = n.pago_id
   where p.deleted_at is not null;
  if v_n > 0 then
    v_mal := v_mal || format('%s avisos apuntan a una SP borrada; ', v_n);
  end if;

  -- 'abierto' sigue siendo un estado valido para el control.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.comb_reportes'::regclass
       and pg_get_constraintdef(oid) like '%''abierto''%'
  ) then
    v_mal := v_mal || 'comb_reportes ya no acepta abierto; ';
  end if;

  select count(*) into v_n from public.pagos_notificaciones where not procesado;
  v_rep := format('avisos pendientes en la bandeja: %s; ', v_n);
  select count(*) into v_n from public.envios where deleted_at is null and estado = 'enviado';
  v_rep := v_rep || format('envios vivos esperando: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

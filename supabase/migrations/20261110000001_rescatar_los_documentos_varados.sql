-- Fase 58 · Rescatar los documentos que quedaron varados por la ✕ muda
--
-- QUE PASO. Hoy 2026-11-10 a las 18:05 UTC, antes de que el deploy del
-- Revertir llegara a produccion, se vaciaron tres avisos de la bandeja con el
-- boton viejo --la ✕ de «Marcar como procesada»--, que hacia una sola cosa:
--
--   update pagos_notificaciones set procesado = true
--
-- Para la liquidacion de caja chica eso era exactamente lo correcto: enviarla
-- a Pagos no le cambia nada, asi que no habia nada que deshacerle. Pero los
-- otros dos avisos SI movian el estado de su documento al enviarse, y la ✕ no
-- lo sabia:
--
--   LP-2026-0006  avn_liquidaciones.estado = 'Enviada a SP'      <- quedo asi
--   CV-2026-0001  comb_reportes.estado     = 'enviado_a_pagos'   <- quedo asi
--                 + notificacion_id apuntando a un aviso ya procesado
--
-- Los dos quedaron SIN aviso en la bandeja y SIN solicitud de pago: varados.
-- La pantalla no ofrece reabrir desde «Enviada a SP», y el Revertir nuevo los
-- rechaza --y debe rechazarlos-- porque exige que el aviso siga pendiente.
-- Sin esta migracion no hay forma de sacarlos desde la app.
--
-- Es exactamente la trampa que `pago_notificacion_revertir` existe para
-- evitar. Lo que no se pudo evitar es que la ✕ alcanzara a dispararla una vez
-- mas antes de desaparecer. El rastro quedo porque el trigger de auditoria de
-- `pagos_notificaciones` --que no existia hasta la 20261108000005-- se aplico
-- unos minutos antes. Sin ese trigger esto habria sido invisible.
--
-- LA INVARIANTE que esto encodea, y que hasta ahora nadie vigilaba:
--
--   Un documento esta en estado «enviado» SOLO SI tiene al menos un aviso que
--   sigue pendiente en la bandeja, o que ya viaja en una solicitud de pago
--   viva. Cualquier otro caso es un documento varado.
--
-- El rescate se escribe como consulta sobre esa invariante y no con los dos
-- seriales a mano: asi arregla estos dos y cualquier otro que haya quedado
-- igual sin que lo hayamos visto.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Liquidaciones de aeronaves varadas
-- ══════════════════════════════════════════════════════════════════════
-- Vuelve al estado anterior al envio: 'Revisada' si la cargo un piloto
-- --porque paso por revision-- y 'Cerrada' si la cargo quien opera. La misma
-- regla que usa pago_notificacion_revertir, para que no haya dos verdades.

update public.avn_liquidaciones l
   set estado = case when l.origen = 'piloto' then 'Revisada' else 'Cerrada' end,
       updated_at = now()
 where l.deleted_at is null
   and l.estado = 'Enviada a SP'
   and not exists (
     select 1
       from public.pagos_notificaciones n
       left join public.pagos p on p.id = n.pago_id and p.deleted_at is null
      where n.origen_tipo = 'avn_liquidacion'
        and n.origen_id = l.id
        and (not n.procesado or p.id is not null)
   );

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Controles de combustible de vehiculos varados
-- ══════════════════════════════════════════════════════════════════════
-- Suelta tambien el `notificacion_id`: apunta a un aviso que ya no representa
-- nada, y dejarlo puesto haria que el control crea que sigue enviado.

update public.comb_reportes r
   set estado = 'cerrado',
       notificacion_id = null
 where r.estado = 'enviado_a_pagos'
   and not exists (
     select 1
       from public.pagos_notificaciones n
       left join public.pagos p on p.id = n.pago_id and p.deleted_at is null
      where n.origen_tipo = 'combustible_vehiculos'
        and n.origen_id = r.id
        and (not n.procesado or p.id is not null)
   );

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion · la invariante, de aqui en adelante
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_n   int;
begin
  select count(*) into v_n
    from public.avn_liquidaciones l
   where l.deleted_at is null
     and l.estado = 'Enviada a SP'
     and not exists (
       select 1 from public.pagos_notificaciones n
         left join public.pagos p on p.id = n.pago_id and p.deleted_at is null
        where n.origen_tipo = 'avn_liquidacion' and n.origen_id = l.id
          and (not n.procesado or p.id is not null)
     );
  if v_n > 0 then
    v_mal := v_mal || format('%s liquidaciones de aeronaves siguen varadas; ', v_n);
  end if;

  select count(*) into v_n
    from public.comb_reportes r
   where r.estado = 'enviado_a_pagos'
     and not exists (
       select 1 from public.pagos_notificaciones n
         left join public.pagos p on p.id = n.pago_id and p.deleted_at is null
        where n.origen_tipo = 'combustible_vehiculos' and n.origen_id = r.id
          and (not n.procesado or p.id is not null)
     );
  if v_n > 0 then
    v_mal := v_mal || format('%s controles de combustible siguen varados; ', v_n);
  end if;

  -- Y que el rescate no haya soltado un documento que SI estaba bien enviado.
  select count(*) into v_n
    from public.pagos_notificaciones n
    join public.pagos p on p.id = n.pago_id and p.deleted_at is null
    join public.avn_liquidaciones l
      on l.id = n.origen_id and n.origen_tipo = 'avn_liquidacion'
   where l.estado <> 'Enviada a SP' and l.deleted_at is null;
  if v_n > 0 then
    v_mal := v_mal || format('%s liquidaciones en una SP viva se salieron de «Enviada a SP»; ', v_n);
  end if;

  select count(*) into v_n from public.pagos_notificaciones where not procesado;
  v_rep := v_rep || format('avisos pendientes en la bandeja: %s; ', v_n);
  select count(*) into v_n from public.avn_liquidaciones
   where estado = 'Enviada a SP' and deleted_at is null;
  v_rep := v_rep || format('liquidaciones de aeronaves en «Enviada a SP»: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

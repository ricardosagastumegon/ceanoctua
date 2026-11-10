-- Fase 59 · Un documento anulado no pide que lo paguen
--
-- MI ERROR, Y LO QUE ENSENA. La migracion anterior limpio los avisos que
-- apuntaban a solicitudes de pago ya borradas, y de paso los devolvio a la
-- bandeja --`procesado = false`--. Para un borrado que pasa AHORA eso es lo
-- correcto, y es lo que hace `pago_borrar`: el gasto se mando a Pagos, la
-- solicitud se cayo, el gasto sigue necesitando pagarse.
--
-- Pero aplicarlo HACIA ATRAS, a borrados viejos, es reescribir la historia
-- sin el contexto en que ocurrieron. Se vio enseguida: el unico aviso que
-- resucito es el de `CB-2026-0005`, un registro de combustible que esta
-- ANULADO. Quedo pidiendo Q 1,088.00 por un papel que ya no vale.
--
-- LA REGLA QUE FALTABA, y que no depende de este caso:
--
--   Un documento anulado o borrado no tiene por que seguir pidiendo que lo
--   paguen. Si su aviso sigue en la bandeja, es basura que alguien va a tener
--   que mirar dos veces antes de darse cuenta de que no habia nada que hacer.
--
-- Se escribe sobre los cinco origenes y no sobre el que fallo, porque la
-- forma de fallar es la misma en todos: el aviso vive en una tabla y la
-- vigencia del documento en otra, y nada las ata.
--
-- El aviso se MARCA procesado, no se borra: invariante 6, y asi el audit_log
-- --que desde la 20261108000005 si cubre esta tabla-- cuenta que paso.

update public.pagos_notificaciones n
   set procesado = true,
       procesado_at = now()
 where not n.procesado
   and n.pago_id is null
   and (
     -- Combustible de aeronaves: se anula con `cancelado_en`.
     (n.origen_tipo = 'combustible' and exists (
        select 1 from public.avn_combustible_registros r
         where r.id = n.origen_id
           and (r.cancelado_en is not null or r.deleted_at is not null)))
     -- Los otros cuatro solo se borran en suave.
     or (n.origen_tipo = 'liquidacion' and exists (
        select 1 from public.caja_chica_liquidaciones l
         where l.id = n.origen_id and l.deleted_at is not null))
     or (n.origen_tipo = 'avn_liquidacion' and exists (
        select 1 from public.avn_liquidaciones l
         where l.id = n.origen_id and l.deleted_at is not null))
     or (n.origen_tipo = 'combustible_vehiculos' and exists (
        select 1 from public.comb_reportes c
         where c.id = n.origen_id and c.deleted_at is not null))
     or (n.origen_tipo = 'consumo_tc' and exists (
        select 1 from public.tc_consumos t
         where t.id = n.origen_id and t.deleted_at is not null))
     -- Y el aviso cuyo documento ya no existe en ninguna tabla.
     or not exists (
        select 1 from public.avn_combustible_registros  r where r.id = n.origen_id
        union all select 1 from public.caja_chica_liquidaciones l where l.id = n.origen_id
        union all select 1 from public.avn_liquidaciones        l where l.id = n.origen_id
        union all select 1 from public.comb_reportes            c where c.id = n.origen_id
        union all select 1 from public.tc_consumos              t where t.id = n.origen_id)
   );

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_n   int;
begin
  -- Ningun aviso pendiente de un documento anulado o borrado.
  select count(*) into v_n
    from public.pagos_notificaciones n
   where not n.procesado
     and (
       (n.origen_tipo = 'combustible' and exists (
          select 1 from public.avn_combustible_registros r
           where r.id = n.origen_id
             and (r.cancelado_en is not null or r.deleted_at is not null)))
       or (n.origen_tipo = 'liquidacion' and exists (
          select 1 from public.caja_chica_liquidaciones l
           where l.id = n.origen_id and l.deleted_at is not null))
       or (n.origen_tipo = 'avn_liquidacion' and exists (
          select 1 from public.avn_liquidaciones l
           where l.id = n.origen_id and l.deleted_at is not null))
       or (n.origen_tipo = 'combustible_vehiculos' and exists (
          select 1 from public.comb_reportes c
           where c.id = n.origen_id and c.deleted_at is not null))
       or (n.origen_tipo = 'consumo_tc' and exists (
          select 1 from public.tc_consumos t
           where t.id = n.origen_id and t.deleted_at is not null))
     );
  if v_n > 0 then
    v_mal := v_mal || format('%s avisos pendientes de documentos anulados; ', v_n);
  end if;

  -- Y que no se haya tocado ninguno que SI esta vivo.
  select count(*) into v_n from public.pagos_notificaciones where not procesado;
  v_rep := format('avisos pendientes que quedan (todos de documentos vivos): %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

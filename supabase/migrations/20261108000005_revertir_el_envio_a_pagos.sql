-- Fase 58 · Revertir el envio a Pagos, y que el documento vuelva entero
--
-- LO QUE PIDIO: «si ya se envio a pagos, ese boton ya no esta disponible.
-- Esta accion se podra revertir unica y exclusivamente desde PAGOS con un
-- boton de REVERTIR, que devolvera la liquidacion a LIQUIDACIONES, dejandola
-- tal cual estaba antes de haberse enviado a pagos, revertira la notificacion
-- desapareciendola.»
--
-- POR QUE NO ALCANZA CON BORRAR EL AVISO: «tal cual estaba» no es lo mismo
-- para los cinco origenes que caen en esa bandeja. Dos de ellos ademas MUEVEN
-- el estado del documento al enviarlo:
--
--   origen_tipo              que cambia al enviar          hay que deshacer
--   ----------------------   ---------------------------   ----------------
--   liquidacion (caja chica) nada                          nada
--   consumo_tc               nada                          nada
--   combustible (aeronaves)  nada                          nada
--   combustible_vehiculos    comb_reportes.estado =        volver a 'cerrado'
--                            'enviado_a_pagos' + notif_id  y soltar el notif_id
--   avn_liquidacion          avn_liquidaciones.estado =    volver a 'Revisada'
--                            'Enviada a SP'                (piloto) o 'Cerrada'
--                                                          (operacion)
--
-- Un boton que solo borrara el aviso dejaria la liquidacion del piloto
-- congelada en «Enviada a SP» sin aviso y sin camino de vuelta: la pantalla
-- no ofrece reabrir desde ese estado. Seria construir la trampa en vez del
-- boton. Por eso esto es una funcion y no un update desde el cliente: la
-- regla de que deshacer vive donde no se puede saltar.
--
-- El aviso se MARCA, no se borra: la invariante 6 dice que
-- `pagos_notificaciones` se marca procesada, y asi el audit_log puede contar
-- que paso. Que es lo que trae el otro arreglo de aqui abajo.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · La bandeja no estaba auditada
-- ══════════════════════════════════════════════════════════════════════
-- Regla 0: toda mutacion queda registrada. `pagos_notificaciones` no tenia
-- NINGUN trigger, asi que enviar a Pagos, descartar un aviso o revertirlo no
-- dejaban rastro de quien ni cuando. Se nota justo ahora, al darle a alguien
-- un boton para deshacer.

drop trigger if exists audit_pagos_notificaciones on public.pagos_notificaciones;
create trigger audit_pagos_notificaciones
  after insert or update or delete on public.pagos_notificaciones
  for each row execute function public.audit_trigger();

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Revertir
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.pago_notificacion_revertir(p_aviso uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n   record;
  rol text := coalesce(public.auth_rol()::text, '');
begin
  if rol not in ('admin', 'asistente') then
    raise exception 'Solo quien administra Pagos puede revertir un envio.';
  end if;

  select * into n from public.pagos_notificaciones where id = p_aviso;
  if not found then
    raise exception 'Ese aviso ya no existe.';
  end if;

  -- Lo que ya es solicitud de pago no se deshace desde aqui. Sacarle un
  -- origen a una SP emitida la deja sin cuadrar; eso se anula en Pagos.
  if n.pago_id is not null then
    raise exception 'Ese aviso ya forma parte de una solicitud de pago. Se anula desde Pagos.';
  end if;
  if n.procesado then
    raise exception 'Ese aviso ya no esta pendiente: no hay envio que revertir.';
  end if;

  -- Deshacer lo que el envio cambio en el documento de origen.
  if n.origen_tipo = 'avn_liquidacion' then
    update public.avn_liquidaciones
       set estado = case when origen = 'piloto' then 'Revisada' else 'Cerrada' end,
           updated_at = now()
     where id = n.origen_id
       and estado = 'Enviada a SP';

  elsif n.origen_tipo = 'combustible_vehiculos' then
    update public.comb_reportes
       set estado = 'cerrado',
           notificacion_id = null,
           updated_by = auth.uid()
     where id = n.origen_id
       and estado = 'enviado_a_pagos';
  end if;
  -- caja chica, consumo_tc y el combustible de aeronaves no cambian nada al
  -- enviarse, asi que no hay nada que deshacerles.

  update public.pagos_notificaciones
     set procesado = true,
         procesado_at = now()
   where id = p_aviso;
end $$;

comment on function public.pago_notificacion_revertir(uuid) is
  'Deshace un envio a Pagos todavia pendiente: saca el aviso de la bandeja y '
  'devuelve el documento de origen al estado en que estaba antes de enviarse. '
  'Lo que ya es solicitud de pago no se toca.';

-- Esto es un ACTO, no un predicado de politica: `anon` NO debe poder
-- ejecutarlo. (Supabase concede a `authenticated` por omision; se revoca todo
-- y se concede a mano para no depender de eso.)
revoke execute on function public.pago_notificacion_revertir(uuid) from public, anon;
grant  execute on function public.pago_notificacion_revertir(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_n   int;
begin
  -- 1 · El trigger de auditoria quedo puesto.
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'pagos_notificaciones'
       and t.tgname = 'audit_pagos_notificaciones' and not t.tgisinternal
  ) then
    v_mal := v_mal || 'pagos_notificaciones sigue sin auditoria; ';
  end if;

  -- 2 · La funcion existe.
  if not exists (
    select 1 from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname = 'pago_notificacion_revertir'
  ) then
    v_mal := v_mal || 'falta pago_notificacion_revertir; ';
  end if;

  -- 3 · Los permisos, al reves que los de un predicado de politica.
  if has_function_privilege('anon', 'public.pago_notificacion_revertir(uuid)', 'execute') then
    v_mal := v_mal || 'anon puede revertir envios; ';
  end if;
  if not has_function_privilege('authenticated', 'public.pago_notificacion_revertir(uuid)', 'execute') then
    v_mal := v_mal || 'authenticated no puede revertir; ';
  end if;

  -- 4 · Los estados de vuelta son validos segun los CHECK que ya existen.
  --     Si alguien estrecha un CHECK, esto lo dice aqui y no en produccion.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.avn_liquidaciones'::regclass
       and conname = 'avn_liquidaciones_estado_chk'
       and pg_get_constraintdef(oid) like '%''Revisada''%'
       and pg_get_constraintdef(oid) like '%''Cerrada''%'
  ) then
    v_mal := v_mal || 'avn_liquidaciones ya no acepta Revisada/Cerrada; ';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.comb_reportes'::regclass
       and conname = 'comb_reportes_estado_check'
       and pg_get_constraintdef(oid) like '%''cerrado''%'
  ) then
    v_mal := v_mal || 'comb_reportes ya no acepta cerrado; ';
  end if;

  -- 5 · Que no se haya quedado fuera un origen nuevo. Si aparece uno que esta
  --     en la tabla y no en la lista de la funcion, hay que decidir si cambia
  --     estado al enviarse --y esta comprobacion es donde se nota--.
  select count(distinct origen_tipo) into v_n
    from public.pagos_notificaciones
   where origen_tipo not in (
     'liquidacion', 'consumo_tc', 'combustible',
     'combustible_vehiculos', 'avn_liquidacion'
   );
  if v_n > 0 then
    v_mal := v_mal || format('%s origenes de aviso que revertir no contempla; ', v_n);
  end if;

  select count(*) into v_n from public.pagos_notificaciones where not procesado;
  v_rep := v_rep || format('avisos pendientes hoy: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

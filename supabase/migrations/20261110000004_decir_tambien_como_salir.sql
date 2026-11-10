-- Fase 59 · Decir tambien como salir
--
-- LO QUE SE VIO. Con los mensajes ya llegando a la pantalla --fase 59, punto
-- 1-- ella intento borrar un vale de prueba y leyo:
--
--   «La SV-2026-0021 esta en un control de vales ya cerrado. Borrarla
--    descuadraria un total que ya salio.»
--
-- El motivo es correcto y el candado tambien: un control cerrado tiene su
-- total congelado, y sacarle un renglon por detras deja el papel diciendo una
-- cosa y sus vales otra. Pero el mensaje la deja parada: sabe por que no
-- puede, no sabe que hacer. Y lo que hay que hacer son dos clics en otra
-- pestaña --Reabrir el control-- que nadie adivina desde aqui.
--
-- Ademas el texto miente en el caso mas comun. Dice «un total que ya salio»,
-- y en 'cerrado' el total NO ha salido a ningun lado: esta congelado,
-- esperando. El que ya salio es 'enviado_a_pagos'. Son dos situaciones con
-- dos salidas distintas, y el mensaje las trataba como una.
--
--   cerrado          -> Reabrir el control (Combustible > Control de vales)
--   enviado_a_pagos  -> Revertir el envio (Finanzas > Pagos), y luego reabrir
--
-- LA REGLA: un mensaje de error que solo dice que no se puede es medio
-- mensaje. El que lo lee no esta auditando el sistema, esta tratando de
-- terminar algo.

create or replace function public.comb_borrar_solicitud(p_solicitud uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_s      public.comb_solicitudes;
  v_rep    public.comb_reportes;
  v_salida text;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión.';
  end if;
  if public.auth_rol() <> 'admin' then
    raise exception 'Solo el administrador puede borrar una solicitud de vale.';
  end if;

  select * into v_s from public.comb_solicitudes
   where id = p_solicitud and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud no existe o ya se había borrado.';
  end if;

  if v_s.reporte_id is not null then
    select * into v_rep from public.comb_reportes where id = v_s.reporte_id;

    if v_rep.estado is distinct from 'abierto' then
      v_salida := case v_rep.estado
        when 'cerrado' then
          'Reabre el control desde «Control de vales» y vuelve a intentarlo.'
        when 'enviado_a_pagos' then
          'Primero revierte el envío desde Finanzas → Pagos, y después reabre el control.'
        else
          'Ese control ya llegó a tesorería; su total respalda un pago en curso.'
      end;

      raise exception
        'La % está dentro del control %, que está %. Sacarla dejaría el total congelado (Q %) diciendo una cosa y sus vales otra. %',
        coalesce(v_s.serial, 'solicitud'),
        coalesce(v_rep.serial, 'de vales'),
        v_rep.estado,
        coalesce(v_rep.total, 0),
        v_salida;
    end if;
  end if;

  update public.envios
     set deleted_at = now()
   where doc_tipo = 'comb_solicitud'
     and doc_id = p_solicitud
     and estado = 'enviado'
     and deleted_at is null;

  update public.comb_solicitudes
     set deleted_at = now(),
         reporte_id = null,
         updated_by = auth.uid()
   where id = p_solicitud;
end $$;

comment on function public.comb_borrar_solicitud(uuid) is
  'Borrado suave de una solicitud de vale. Solo admin. Retira el envio '
  'pendiente y se niega si ya entro en un control que no esta abierto, '
  'diciendo cual es el control y como devolverlo.';

revoke execute on function public.comb_borrar_solicitud(uuid) from public, anon;
grant  execute on function public.comb_borrar_solicitud(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion · el texto desplegado, no una copia del texto
-- ══════════════════════════════════════════════════════════════════════
-- Lo que cambio aqui es un MENSAJE, asi que la comprobacion tiene que mirar
-- un mensaje. Provocarlo de verdad no se puede: la migracion corre sin
-- sesion y `comb_borrar_solicitud` exige una antes de llegar al candado
-- --el primer intento devolvio «Hace falta una sesion», que es la prueba de
-- que no medimos nada--. Y reproducir el format aqui seria comprobar mi
-- copia contra si misma: si el texto de la funcion cambia y el de la prueba
-- no, la prueba sigue pasando.
--
-- Asi que se lee el cuerpo REAL de la funcion tal como quedo en el servidor.

do $$
declare
  v_mal  text := '';
  v_rep  text := '';
  v_def  text;
  v_n    int;
begin
  select pg_get_functiondef(oid) into v_def from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'comb_borrar_solicitud';

  if v_def is null then
    v_mal := v_mal || 'no existe comb_borrar_solicitud; ';
  else
    if v_def like '%ya salio%' then
      v_mal := v_mal || 'sigue diciendo «un total que ya salio»; ';
    end if;
    if v_def not like '%Reabre el control%' then
      v_mal := v_mal || 'no ofrece reabrir el control; ';
    end if;
    if v_def not like '%revierte el env%o%' then
      v_mal := v_mal || 'no ofrece revertir el envio; ';
    end if;
    if v_def not like '%v_rep.serial%' then
      v_mal := v_mal || 'no nombra el control en el mensaje; ';
    end if;
  end if;

  -- Y que el candado SIGA siendo un candado: esto arreglo el texto, no la
  -- regla. Un vale dentro de un control no abierto tiene que seguir sin
  -- poder borrarse.
  if v_def not like '%estado is distinct from ''abierto''%' then
    v_mal := v_mal || 'EL CANDADO SE PERDIO: ya no exige que el control este abierto; ';
  end if;

  -- Permisos de un acto: anon no.
  if has_function_privilege('anon', 'public.comb_borrar_solicitud(uuid)', 'execute') then
    v_mal := v_mal || 'anon puede borrar solicitudes; ';
  end if;
  if not has_function_privilege('authenticated', 'public.comb_borrar_solicitud(uuid)', 'execute') then
    v_mal := v_mal || 'authenticated no puede borrar solicitudes; ';
  end if;

  select count(*) into v_n
    from public.comb_solicitudes s join public.comb_reportes r on r.id = s.reporte_id
   where s.deleted_at is null and r.deleted_at is null and r.estado <> 'abierto';
  v_rep := format('vales hoy trabados por un control no abierto: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

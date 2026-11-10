-- Fase 59 · Un envio no sobrevive a su documento
--
-- LO QUE SE VIO. Ella borro los tres vales de prueba, y Victor los sigue
-- viendo en «Lo ultimo que resolviste»: SV-2026-0021, SV-2026-0018 y
-- SV-2026-0002, de documentos que ya no existen.
--
-- POR QUE. `comb_borrar_solicitud` retira el envio solo si esta PENDIENTE:
--
--     where doc_tipo = 'comb_solicitud' and doc_id = p_solicitud
--       and estado = 'enviado'          <--  aqui
--
-- La intencion era buena --no dejarle al tesorero una bandeja que no puede
-- resolver-- pero se quedo corta: el envio ya resuelto tambien sigue vivo, y
-- el historial de tesoreria lee `estado <> 'enviado'`. Justo el complemento.
--
-- LA REGLA, que vale para los seis tipos de documento y no solo para este:
--
--   Un envio es la sombra de un documento. Si el documento se borra, su
--   sombra se va con el --en la bandeja y en el historial--. Lo que paso de
--   verdad queda en `audit_log`, que es el archivo; los tableros son listas
--   de trabajo, no archivos.
--
-- Esto ya se aplico a `pago` en 20261110000002. Aqui se generaliza.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Borrar la solicitud se lleva TODOS sus envios
-- ══════════════════════════════════════════════════════════════════════

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

  -- TODOS sus envios, no solo el pendiente. El ya resuelto seguia vivo y
  -- aparecia en «Lo ultimo que resolviste» de un documento que ya no existe.
  update public.envios
     set deleted_at = now()
   where doc_tipo = 'comb_solicitud'
     and doc_id = p_solicitud
     and deleted_at is null;

  update public.comb_solicitudes
     set deleted_at = now(),
         reporte_id = null,
         updated_by = auth.uid()
   where id = p_solicitud;
end $$;

comment on function public.comb_borrar_solicitud(uuid) is
  'Borrado suave de una solicitud de vale. Solo admin. Se lleva todos sus '
  'envíos --pendientes y resueltos-- y se niega si ya entró en un control que '
  'no está abierto, diciendo cuál es el control y cómo devolverlo.';

revoke execute on function public.comb_borrar_solicitud(uuid) from public, anon;
grant  execute on function public.comb_borrar_solicitud(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Y que no vuelva a pasar por otra puerta
-- ══════════════════════════════════════════════════════════════════════
-- Las seis clases de documento pueden borrarse por caminos distintos --una
-- funcion, un update desde el cliente, una migracion-- y cada uno tendria que
-- acordarse de sus envios. Acordarse es justo lo que falla.
--
-- Un trigger sobre cada tabla de origen seria seis triggers que mantener. En
-- su lugar, el envio se apaga al mirarlo: la vista que leen los tableros ya
-- excluye los documentos borrados, y la limpieza de abajo arregla lo que
-- quedo. Asi una puerta nueva no puede dejar basura.

create or replace view public.envios_vivos as
  select e.*
    from public.envios e
   where e.deleted_at is null
     and case e.doc_tipo
           when 'comb_solicitud'  then exists (select 1 from public.comb_solicitudes         d where d.id = e.doc_id and d.deleted_at is null)
           when 'comb_reporte'    then exists (select 1 from public.comb_reportes            d where d.id = e.doc_id and d.deleted_at is null)
           when 'pago'            then exists (select 1 from public.pagos                    d where d.id = e.doc_id and d.deleted_at is null)
           when 'cc_vale'         then exists (select 1 from public.caja_chica_vales         d where d.id = e.doc_id and d.deleted_at is null)
           when 'cc_liquidacion'  then exists (select 1 from public.caja_chica_liquidaciones d where d.id = e.doc_id and d.deleted_at is null)
           when 'avn_liquidacion' then exists (select 1 from public.avn_liquidaciones        d where d.id = e.doc_id and d.deleted_at is null)
           else true
         end;

comment on view public.envios_vivos is
  'Los envíos cuyo documento de origen sigue existiendo. Un envío es la sombra '
  'de un documento: si el documento se borra, su sombra se va con él. Lo que '
  'pasó de verdad queda en audit_log.';

-- La vista hereda la RLS de `envios` --security_invoker-- en vez de saltarsela.
alter view public.envios_vivos set (security_invoker = true);

grant select on public.envios_vivos to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Limpiar los que quedaron
-- ══════════════════════════════════════════════════════════════════════

update public.envios e
   set deleted_at = now()
 where e.deleted_at is null
   and not exists (select 1 from public.envios_vivos v where v.id = e.id);

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_def text;
  v_n   int;
begin
  select pg_get_functiondef(oid) into v_def from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'comb_borrar_solicitud';

  -- Ya no se queda solo con el pendiente.
  if v_def like '%and estado = ''enviado''%' then
    v_mal := v_mal || 'comb_borrar_solicitud sigue retirando solo el envio pendiente; ';
  end if;
  -- Y el candado del control sigue donde estaba: esto no lo afloja.
  if v_def not like '%estado is distinct from ''abierto''%' then
    v_mal := v_mal || 'EL CANDADO SE PERDIO: ya no exige que el control este abierto; ';
  end if;
  -- Ni el mensaje que acabamos de arreglar.
  if v_def not like '%Reabre el control%' then
    v_mal := v_mal || 'se perdio el mensaje que dice como salir; ';
  end if;

  -- Ningun envio vivo de un documento borrado.
  select count(*) into v_n
    from public.envios e
   where e.deleted_at is null
     and not exists (select 1 from public.envios_vivos v where v.id = e.id);
  if v_n > 0 then
    v_mal := v_mal || format('%s envios siguen vivos sin documento; ', v_n);
  end if;

  -- La vista no debe saltarse la RLS de envios.
  if not exists (
    select 1 from pg_class c
     where c.relname = 'envios_vivos' and c.relnamespace = 'public'::regnamespace
       and 'security_invoker=true' = any(c.reloptions)
  ) then
    v_mal := v_mal || 'envios_vivos no es security_invoker: se saltaria la RLS; ';
  end if;

  -- Y que no se haya llevado por delante los envios buenos.
  select count(*) into v_n from public.envios_vivos;
  v_rep := format('envios que siguen en pie: %s; ', v_n);
  select count(*) into v_n from public.envios_vivos where estado = 'enviado';
  v_rep := v_rep || format('de ellos, pendientes: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

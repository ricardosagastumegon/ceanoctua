-- Fase 55 · El vale de caja chica cuenta en que va
--
-- LO QUE ENCONTRO: «hay 4 liquidaciones que conformaron 1 SP, esta SP ya fue
-- procesada y pagada [...] pero el estatus tanto de los vales que dieron su
-- origen, como de las liquidaciones [...] siguen sin cambiar a pagadas».
--
-- Cierto: los cuatro vales de la SP-2026-0011 siguen en «Asignado a
-- Liquidacion» con su solicitud en el ultimo paso. Nadie recorria la cadena.
--
-- EL CICLO, en sus palabras y en este orden:
--
--   Creado                  al crearlo
--   Solicitado              al enviarselo a Victor por el sistema
--   Acreditado              cuando Victor confirma que entrego el dinero
--   Pendiente de Liquidar   al meterlo en una liquidacion
--   Liquidado               cuando la liquidacion llega a Pagos, se genera
--                           la SP y se manda a firma
--   Pendiente de Reintegro  cuando esa SP se le manda a Victor
--   Reintegrado             cuando la SP se confirma pagada. Fin.
--
-- QUE SE PUEDE ENGANCHAR HOY Y QUE NO. Los cuatro ultimos saltos cuelgan de
-- cosas que ya ocurren --meter el vale en una liquidacion, mandar la SP a
-- firma, mandarsela a Victor, marcarla pagada-- y quedan automaticos. Los dos
-- primeros (`Solicitado`, `Acreditado`) dependen de mandarle un vale de
-- dinero a Victor, que es un flujo que todavia no existe: `envios` ya admite
-- el tipo `cc_vale` pero nadie lo usa. Su funcion de despacho queda escrita
-- aqui, lista, y se activara sola el dia que esa pantalla exista.
--
-- SOLO SE AVANZA, NUNCA SE RETROCEDE por accidente. Un vale reintegrado al
-- que le toque otra vez la cascada no vuelve a «Liquidado»: el orden esta
-- escrito y las funciones lo respetan. La unica marcha atras es deliberada
-- --sacar el vale de su liquidacion-- y esa si lo devuelve.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · El orden del ciclo
-- ══════════════════════════════════════════════════════════════════════
--
-- En una funcion y no repartido en comparaciones sueltas: el dia que se
-- añada un paso hay UN sitio donde ponerlo. Lo que no es del ciclo --anulado,
-- cancelado-- devuelve -1 y por tanto nunca avanza ni se pisa.

create or replace function public.cc_orden_vale(p_estado text)
returns int
language sql
immutable
as $$
  select case p_estado
    when 'Creado'                 then 0
    when 'Aprobado'               then 0   -- etiqueta vieja, mismo momento
    when 'Solicitado'             then 1
    when 'Acreditado'             then 2
    when 'Pendiente de Liquidar'  then 3
    when 'Asignado a Liquidación' then 3   -- etiqueta vieja
    when 'EnLiquidacion'          then 3   -- etiqueta vieja
    when 'Liquidado'              then 4
    when 'Pendiente de Reintegro' then 5
    when 'Pagado'                 then 5   -- etiqueta vieja
    when 'Reintegrado'            then 6
    else -1
  end;
$$;

comment on function public.cc_orden_vale(text) is
  'La posicion de un estado en el ciclo del vale. -1 para lo que esta fuera (anulado, cancelado): asi nunca avanza ni se pisa.';

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Mover los vales que cuelgan de una solicitud de pago
-- ══════════════════════════════════════════════════════════════════════
--
-- El camino es pago -> aviso -> liquidacion -> vales, y hay que recorrerlo
-- entero porque entre el vale y el pago no hay columna que los una: lo que
-- los une es la liquidacion que los agrupo.
--
-- `security definer` porque la llaman funciones que ya corren asi, y porque
-- el Tesorero --que dispara uno de los saltos al aceptar la SP-- no lee caja
-- chica ni debe.

create or replace function public.cc_vales_al_estado(p_pago uuid, p_estado text)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_n int;
begin
  update public.caja_chica_vales v
     set estado = p_estado::vale_status,
         updated_at = now()
   where v.deleted_at is null
     -- Solo hacia adelante. Un vale ya reintegrado no vuelve atras porque
     -- alguien reabra un paso, y uno anulado no se resucita.
     and public.cc_orden_vale(v.estado::text) >= 0
     and public.cc_orden_vale(v.estado::text) < public.cc_orden_vale(p_estado)
     and v.id in (
       select lv.vale_id
         from public.pagos p
         join public.pagos_notificaciones n
           on n.id = p.origen_notificacion_id or n.pago_id = p.id
         join public.caja_chica_liquidaciones l
           on l.id = n.origen_id and n.origen_tipo = 'liquidacion'
         join public.liquidacion_vales lv on lv.liquidacion_id = l.id
        where p.id = p_pago and l.deleted_at is null
     );

  get diagnostics v_n = row_count;
  return v_n;
end $$;

comment on function public.cc_vales_al_estado(uuid, text) is
  'Mueve al estado dado los vales que llegan a esa solicitud de pago por sus liquidaciones. Solo avanza; nunca retrocede.';

-- Y de `authenticated` tambien. Supabase concede por omision a ese rol toda
-- funcion nueva del esquema, asi que quitarsela solo a `public` y `anon` deja
-- la puerta abierta --es el mismo despiste de los dos caminos que ya aparecio
-- con el catalogo de tarjetas. Nadie la llama de fuera: la invocan funciones
-- que ya corren como dueño.
revoke execute on function public.cc_vales_al_estado(uuid, text) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Al entrar en una liquidacion · «Pendiente de Liquidar»
-- ══════════════════════════════════════════════════════════════════════
--
-- Y al salir, la marcha atras: es la unica deliberada, asi que es la unica
-- que se permite. Vuelve a «Acreditado» si ya le habian dado el dinero, y a
-- «Creado» si no --no se puede saber mas, y suponer de mas seria peor.

create or replace function public.cc_vale_en_liquidacion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    update public.caja_chica_vales
       set estado = 'Pendiente de Liquidar'::vale_status, updated_at = now()
     where id = new.vale_id
       and deleted_at is null
       and public.cc_orden_vale(estado::text) between 0 and 2;
    return new;
  end if;

  update public.caja_chica_vales
     set estado = case
           when estado_previo = 'Acreditado' then 'Acreditado'::vale_status
           else 'Creado'::vale_status
         end,
         updated_at = now()
   where id = old.vale_id
     and deleted_at is null
     and public.cc_orden_vale(estado::text) = 3;
  return old;
end $$;

drop trigger if exists cc_vale_en_liquidacion on public.liquidacion_vales;
create trigger cc_vale_en_liquidacion
  after insert or delete on public.liquidacion_vales
  for each row execute function public.cc_vale_en_liquidacion();

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Los saltos que dispara la solicitud de pago
-- ══════════════════════════════════════════════════════════════════════
--
-- Se enganchan DENTRO de las funciones que ya mueven la solicitud, y no en
-- triggers sobre `pagos`: asi el salto del vale ocurre en el mismo acto que
-- lo justifica y no como un efecto suelto que alguien pueda disparar
-- cambiando una columna a mano.

create or replace function public.pago_avanzar_paso(
  p_pago  uuid,
  p_desde int,
  p_total int
)
returns public.pagos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_p      public.pagos;
  v_fechas text[];
  v_sig    int;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesion.';
  end if;
  if public.auth_rol() not in ('admin','asistente') then
    raise exception 'No tiene permiso para mover una solicitud de pago.';
  end if;

  select * into v_p from public.pagos
   where id = p_pago and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud de pago no existe.';
  end if;

  if v_p.step_idx <> p_desde then
    return v_p;
  end if;

  v_sig := v_p.step_idx + 1;
  if v_sig > p_total - 1 then
    return v_p;
  end if;

  v_fechas := coalesce(v_p.step_dates, array[]::text[]);
  v_fechas[v_sig + 1] := to_char(current_date, 'YYYY-MM-DD');

  update public.pagos
     set step_idx = v_sig,
         step_dates = v_fechas,
         status = case when v_sig = p_total - 1 then 'Pagado'::pago_estado else v_p.status end,
         updated_by = auth.uid()
   where id = p_pago
  returning * into v_p;

  -- Paso 1 = «En Solicitud de Firma». Que la solicitud salga a firma es lo
  -- que convierte el gasto en liquidado: ya esta documentado y en camino.
  if v_sig = 1 then
    perform public.cc_vales_al_estado(p_pago, 'Liquidado');
  end if;
  -- Y el ultimo paso cierra el ciclo tambien por aqui, no solo cuando lo
  -- marca el Tesorero: la SP puede llegar a pagada por los dos caminos.
  if v_sig = p_total - 1 then
    perform public.cc_vales_al_estado(p_pago, 'Reintegrado');
  end if;

  return v_p;
end $$;

-- Cuando el Tesorero ACEPTA la solicitud, el vale queda esperando su
-- reintegro. Se engancha en la funcion de despacho del envio, que es la que
-- ya corre en ese momento.
create or replace function public.envio_despacho_pago(e public.envios)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_p      public.pagos;
  v_fechas text[];
begin
  select * into v_p from public.pagos
   where id = e.doc_id and deleted_at is null for update;
  if not found then
    return;
  end if;

  -- Paso 4 = «Procesado»: el Tesorero la recibio y la tiene.
  if v_p.step_idx < 4 then
    v_fechas := coalesce(v_p.step_dates, array[]::text[]);
    v_fechas[5] := to_char(current_date, 'YYYY-MM-DD');
    update public.pagos
       set step_idx = 4, step_dates = v_fechas
     where id = v_p.id;
  end if;

  perform public.cc_vales_al_estado(v_p.id, 'Pendiente de Reintegro');
end $$;

-- Y al marcarla pagada, se cierra.
create or replace function public.pago_marcar_pagado(p_pago uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_p public.pagos;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesion.';
  end if;

  select * into v_p from public.pagos
   where id = p_pago and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud de pago no existe.';
  end if;

  update public.pagos
     set status = 'Pagado'::pago_estado,
         step_idx = greatest(step_idx, 5)
   where id = p_pago;

  -- Deja rastro en el envio: el Tesorero no lee `pagos`, y sin esto una SP
  -- aceptada y una pagada se le ven iguales.
  update public.envios
     set datos = coalesce(datos, '{}'::jsonb)
               || jsonb_build_object('pagado_at', to_char(now(), 'YYYY-MM-DD'))
   where doc_tipo = 'pago' and doc_id = p_pago
     and estado = 'aceptado' and deleted_at is null;

  perform public.cc_vales_al_estado(p_pago, 'Reintegrado');
end $$;

-- ══════════════════════════════════════════════════════════════════════
-- 5 · El vale de dinero que se le pide a Victor
-- ══════════════════════════════════════════════════════════════════════
--
-- Esta pantalla todavia no existe. La funcion se deja escrita porque
-- `envio_aceptar` busca `envio_despacho_{doc_tipo}` y la llama SI EXISTE: el
-- dia que se mande el primer vale, el salto a «Acreditado» ya estara puesto
-- y nadie tendra que acordarse de volver aqui.

create or replace function public.envio_despacho_cc_vale(e public.envios)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.caja_chica_vales
     set estado = 'Acreditado'::vale_status, updated_at = now()
   where id = e.doc_id
     and deleted_at is null
     and public.cc_orden_vale(estado::text) between 0 and 1;
end $$;

comment on function public.envio_despacho_cc_vale(public.envios) is
  'El Tesorero confirma que entrego el dinero del vale. La llama `envio_aceptar` sola, cuando exista la pantalla que manda vales.';

revoke execute on function public.envio_despacho_cc_vale(public.envios) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 6 · Lo que ya estaba mal
-- ══════════════════════════════════════════════════════════════════════
--
-- Primero la etiqueta vieja pasa a la del ciclo --son el mismo momento-- y
-- despues se recorre cada solicitud de pago aplicando el estado que le
-- corresponde por donde va. Se hace en orden ascendente de paso para que,
-- si una SP esta pagada, el vale acabe en «Reintegrado» y no a medias.

update public.caja_chica_vales
   set estado = 'Pendiente de Liquidar'::vale_status
 where deleted_at is null and estado::text in ('Asignado a Liquidación', 'EnLiquidacion');

do $$
declare
  v_p record;
  v_n int := 0;
begin
  for v_p in
    select id, step_idx, status from public.pagos
     where deleted_at is null order by step_idx
  loop
    if v_p.step_idx >= 1 then
      v_n := v_n + public.cc_vales_al_estado(v_p.id, 'Liquidado');
    end if;
    if v_p.step_idx >= 4 then
      v_n := v_n + public.cc_vales_al_estado(v_p.id, 'Pendiente de Reintegro');
    end if;
    if v_p.step_idx >= 5 or v_p.status = 'Pagado' then
      v_n := v_n + public.cc_vales_al_estado(v_p.id, 'Reintegrado');
    end if;
  end loop;
  raise notice 'Vales puestos al dia: %', v_n;
end $$;

-- ══════════════════════════════════════════════════════════════════════
-- 7 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_n   int;
  v_rep text := '';
begin
  -- Lo que motivo la fase: los cuatro vales de la SP-2026-0011, que esta
  -- pagada, tienen que estar reintegrados.
  select count(*) into v_n
    from public.pagos p
    join public.pagos_notificaciones n on n.id = p.origen_notificacion_id or n.pago_id = p.id
    join public.caja_chica_liquidaciones l on l.id = n.origen_id and n.origen_tipo='liquidacion'
    join public.liquidacion_vales lv on lv.liquidacion_id = l.id
    join public.caja_chica_vales v on v.id = lv.vale_id
   where p.serial = 'SP-2026-0011' and v.estado::text <> 'Reintegrado';
  if v_n > 0 then
    v_mal := v_mal || format('%s vales de la SP-2026-0011 siguen sin reintegrar; ', v_n);
  end if;

  -- Y que no quede ninguno con la etiqueta vieja.
  select count(*) into v_n from public.caja_chica_vales
   where deleted_at is null and estado::text in ('Asignado a Liquidación','EnLiquidacion');
  if v_n > 0 then
    v_mal := v_mal || format('%s vales con la etiqueta vieja; ', v_n);
  end if;

  select string_agg(estado::text || '=' || c::text, ' ' order by estado::text) into v_rep
    from (select estado, count(*) c from public.caja_chica_vales
           where deleted_at is null group by estado) x;

  -- Las funciones de despacho no son para nadie: las llama `envio_aceptar`.
  -- Ni el despacho ni el motor de estados se pueden disparar por fuera: los
  -- llaman funciones que ya corren como dueño, en el acto que los justifica.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('envio_despacho_cc_vale','cc_vales_al_estado')
       and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute'))
  ) then
    v_mal := v_mal || 'el motor de estados del vale se puede disparar por fuera; ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

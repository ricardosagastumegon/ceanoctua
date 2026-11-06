-- Fase 46 · Combustible: trazabilidad en el formulario y un control que se
-- llena solo
--
-- Cinco cosas que la usuaria encontro al usarlo el 6 nov 2026. Las tres
-- primeras son de datos y van aqui; las otras dos son de pantalla.
--
--   1. «Vale a» era texto libre. Escribir el nombre a mano es exactamente
--      donde se pierde la trazabilidad: «Jose Rufino», «J. Rufino» y «Jose
--      Rufino Ruiz» son tres personas distintas para la base y una sola en
--      la vida real. Pasa a ser una lista.
--
--   2. «Solicitado por» solo ofrecia la planilla. Quien pide el vale para un
--      empleado suele ser un gerente, y los gerentes estan en Personal JD
--      --de las 10 personas de JD, seis no estan en `empleados` (invariante
--      4: `personas` es la UNICA fuente de Personal JD).
--
--   3. EL CONTROL DE VALES SALIA EN BLANCO. Entrar en el control era un paso
--      manual escondido detras de un boton, y ademas solo aceptaba
--      solicitudes ya despachadas. La usuaria creo CV-2026-0001 del 1 al 15
--      de noviembre, creo SV-2026-0002 con fecha 6 de noviembre, y el control
--      siguio diciendo cero. Tenia razon: si el vale cae en la quincena, el
--      cuadro de esa quincena es su sitio y no hay nada que decidir.
--
-- EL CRITERIO DE LA ASIGNACION AUTOMATICA. La fecha del vale manda. Si hay un
-- control ABIERTO cuyo periodo la contiene, el vale entra. Lo que NO hace:
--   · no toca un control cerrado --su total esta congelado y el papel que ya
--     se imprimio tiene que seguir cuadrando;
--   · no vuelve a meter lo que se saco a mano, para eso esta
--     `excluir_del_control`. Sin esa marca, «Quitar» y el automatismo se
--     pelearian y ganaria siempre el automatismo.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Quien pide y para quien, con nombre y apellido
-- ══════════════════════════════════════════════════════════════════════
--
-- Se guardan las DOS cosas: el vinculo (para contar, filtrar y auditar) y el
-- texto (`vale_a`), que es lo que se imprimio ese dia. Si alguien corrige un
-- nombre en el catalogo dentro de dos anios, el papel emitido no cambia. Es
-- el mismo criterio del `snapshot` de `envios`.

alter table public.comb_solicitudes
  add column if not exists vale_a_empleado_id uuid references public.empleados(id),
  add column if not exists vale_a_persona_id  uuid references public.personas(id),
  add column if not exists solicitado_por_persona_id uuid references public.personas(id);

comment on column public.comb_solicitudes.vale_a is
  'El nombre tal como se imprimio. Lo escribe el formulario desde el vinculo; se conserva para que el papel emitido no cambie si luego se corrige el catalogo.';

alter table public.comb_solicitudes
  drop constraint if exists comb_solicitudes_vale_a_una_fuente;
alter table public.comb_solicitudes
  add constraint comb_solicitudes_vale_a_una_fuente
  check (num_nonnulls(vale_a_empleado_id, vale_a_persona_id) <= 1);

alter table public.comb_solicitudes
  drop constraint if exists comb_solicitudes_solicitante_una_fuente;
alter table public.comb_solicitudes
  add constraint comb_solicitudes_solicitante_una_fuente
  check (num_nonnulls(solicitado_por_id, solicitado_por_persona_id) <= 1);

-- ══════════════════════════════════════════════════════════════════════
-- 2 · La marca de «este no va en el control»
-- ══════════════════════════════════════════════════════════════════════

alter table public.comb_solicitudes
  add column if not exists excluir_del_control boolean not null default false;

comment on column public.comb_solicitudes.excluir_del_control is
  'La puso una persona al sacar el vale del control a mano. Mientras este en true, el automatismo no lo vuelve a meter.';

-- ══════════════════════════════════════════════════════════════════════
-- 3 · El vale busca su control
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.comb_solicitud_al_control()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_estado  text;
  v_abierto uuid;
begin
  -- Lo anulado y lo borrado no entra en ningun cuadro, pero tampoco se saca
  -- del que ya tenia: el historial se mira por `deleted_at`, no vaciando
  -- columnas.
  if new.deleted_at is not null or new.estado = 'anulada' then
    return new;
  end if;

  if new.excluir_del_control then
    new.reporte_id := null;
    return new;
  end if;

  if new.reporte_id is not null then
    -- Ojo al `deleted_at`: un control borrado conserva su `estado`, asi que
    -- mirar solo el estado dejaria el vale colgado de un control que ya no
    -- existe --y por tanto fuera del control vivo de su quincena.
    select estado into v_estado
      from public.comb_reportes
     where id = new.reporte_id and deleted_at is null;

    -- Cerrado, en tesoreria o pagado: no se toca. El total esta congelado.
    if v_estado is not null and v_estado <> 'abierto' then
      return new;
    end if;

    -- Sigue abierto y la fecha cae dentro: se queda donde esta.
    if exists (
      select 1 from public.comb_reportes r
       where r.id = new.reporte_id
         and r.deleted_at is null
         and new.fecha between r.periodo_ini and r.periodo_fin
    ) then
      return new;
    end if;

    -- O le corrigieron la fecha, o borraron el control. En los dos casos
    -- toca volver a buscarle sitio.
    new.reporte_id := null;
  end if;

  select r.id into v_abierto
    from public.comb_reportes r
   where r.estado = 'abierto'
     and r.deleted_at is null
     and new.fecha between r.periodo_ini and r.periodo_fin
   order by r.periodo_ini desc
   limit 1;

  new.reporte_id := v_abierto;
  return new;
end $$;

comment on function public.comb_solicitud_al_control() is
  'Mete el vale en el control de vales ABIERTO cuyo periodo contiene su fecha. No toca controles cerrados ni lo que se saco a mano.';

drop trigger if exists comb_solicitudes_al_control on public.comb_solicitudes;
create trigger comb_solicitudes_al_control
  before insert or update on public.comb_solicitudes
  for each row execute function public.comb_solicitud_al_control();

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Y el control recoge los vales que ya existian
-- ══════════════════════════════════════════════════════════════════════
--
-- Los dos sentidos hacen falta porque el orden real varia: unos dias crea el
-- control primero y otros los vales. Con un solo sentido, la mitad de los
-- dias el cuadro sale en blanco --que es justo lo que paso.

create or replace function public.comb_reporte_recoge()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.estado <> 'abierto' or new.deleted_at is not null then
    return new;
  end if;

  update public.comb_solicitudes s
     set reporte_id = new.id
   where s.reporte_id is null
     and s.deleted_at is null
     and not s.excluir_del_control
     and s.estado <> 'anulada'
     and s.fecha between new.periodo_ini and new.periodo_fin;

  return new;
end $$;

comment on function public.comb_reporte_recoge() is
  'Al crear un control de vales, recoge los vales sueltos de su periodo.';

drop trigger if exists comb_reportes_recoge on public.comb_reportes;
create trigger comb_reportes_recoge
  after insert on public.comb_reportes
  for each row execute function public.comb_reporte_recoge();

-- ══════════════════════════════════════════════════════════════════════
-- 5 · Lo que ya estaba suelto
-- ══════════════════════════════════════════════════════════════════════

update public.comb_solicitudes s
   set reporte_id = r.id
  from public.comb_reportes r
 where s.reporte_id is null
   and s.deleted_at is null
   and not s.excluir_del_control
   and s.estado <> 'anulada'
   and r.estado = 'abierto'
   and r.deleted_at is null
   and s.fecha between r.periodo_ini and r.periodo_fin;

-- ══════════════════════════════════════════════════════════════════════
-- 6 · Cerrar un control, diciendo QUE falta
-- ══════════════════════════════════════════════════════════════════════
--
-- Antes decia «hay solicitudes sin monto» y ahi te las apanabas. Ahora las
-- nombra: con el correlativo delante se sabe si hay que capturarle el
-- despacho o sacarla de la quincena.

create or replace function public.comb_cerrar_reporte(p_reporte uuid)
returns public.comb_reportes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rep    public.comb_reportes;
  v_total  numeric(14,2);
  v_n      int;
  v_faltan text;
begin
  if public.auth_rol() not in ('admin','asistente') then
    raise exception 'No tiene permiso para cerrar un control de vales.';
  end if;

  select * into v_rep from public.comb_reportes
   where id = p_reporte and deleted_at is null for update;

  if not found then
    raise exception 'El control de vales no existe.';
  end if;
  if v_rep.estado <> 'abierto' then
    raise exception 'El control % ya esta %; no se puede cerrar de nuevo.',
      v_rep.serial, v_rep.estado;
  end if;

  select coalesce(sum(monto), 0), count(*) into v_total, v_n
    from public.comb_solicitudes
   where reporte_id = p_reporte and deleted_at is null;

  if v_n = 0 then
    raise exception 'El control % no tiene ningun vale; no hay que cerrar.', v_rep.serial;
  end if;

  select string_agg(coalesce(serial, '(sin correlativo)'), ', ' order by fecha)
    into v_faltan
    from public.comb_solicitudes
   where reporte_id = p_reporte and deleted_at is null and monto is null;

  if v_faltan is not null then
    raise exception
      'Falta el despacho de: %. Capturalo, o sacalos del control, antes de cerrar.',
      v_faltan;
  end if;

  update public.comb_reportes
     set estado = 'cerrado', total = v_total, updated_by = auth.uid()
   where id = p_reporte
  returning * into v_rep;

  update public.comb_solicitudes
     set estado = 'en_reporte', updated_by = auth.uid()
   where reporte_id = p_reporte and deleted_at is null
     and estado in ('documentada','despachada');

  return v_rep;
end $$;

comment on function public.comb_cerrar_reporte(uuid) is
  'Cierra un control de vales: calcula el total en el servidor y lo congela. Si falta algun despacho, nombra cuales.';

-- ══════════════════════════════════════════════════════════════════════
-- 7 · Borrar una solicitud · solo el administrador
-- ══════════════════════════════════════════════════════════════════════
--
-- La politica de escritura de la tabla deja a admin y asistente. Borrar es
-- otra cosa: lo pidio la duena del sistema para su propio usuario, y en una
-- tabla financiera deshacer no es un tramite de todos los dias.
--
-- Hace dos cosas mas que el update suelto que habia en el cliente:
--   · retira el envio pendiente, si lo hubiera. Un envio cuyo documento ya no
--     existe es una bandeja que el Tesorero no puede resolver ni quitarse de
--     encima;
--   · se niega si el vale entro en un control ya cerrado. Ese total ya viajo
--     a Pagos; borrarle un renglon por detras es descuadrar un papel firmado.

create or replace function public.comb_borrar_solicitud(p_solicitud uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_s      public.comb_solicitudes;
  v_estado text;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesion.';
  end if;
  if public.auth_rol() <> 'admin' then
    raise exception 'Solo el administrador puede borrar una solicitud de vale.';
  end if;

  select * into v_s from public.comb_solicitudes
   where id = p_solicitud and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud no existe o ya se habia borrado.';
  end if;

  if v_s.reporte_id is not null then
    select estado into v_estado from public.comb_reportes where id = v_s.reporte_id;
    if v_estado is distinct from 'abierto' then
      raise exception
        'La % esta en un control de vales ya %. Borrarla descuadraria un total que ya salio.',
        coalesce(v_s.serial, 'solicitud'), v_estado;
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
  'Borrado suave de una solicitud de vale. Solo admin. Retira el envio pendiente y se niega si ya entro en un control cerrado.';

revoke execute on function public.comb_borrar_solicitud(uuid) from public, anon;
grant  execute on function public.comb_borrar_solicitud(uuid) to authenticated;

-- Las dos de trigger tampoco. No es que se pudieran llamar --una funcion que
-- devuelve `trigger` no la expone PostgREST ni la deja invocar el SQL--, pero
-- la regla de la fase 45 es que NINGUNA funcion `security definer` le queda
-- abierta a `anon`, y una regla con excepciones que hay que recordar deja de
-- servir para revisar. Disparar el trigger no pasa por este permiso: se
-- comprueba al crearlo, no al ejecutarlo.
revoke execute on function public.comb_solicitud_al_control() from public, anon;
revoke execute on function public.comb_reporte_recoge()       from public, anon;

-- Y de paso las dos del correlativo, que venian abiertas de la fase 45 por
-- el mismo descuido. Asi la comprobacion de abajo puede decir «ninguna» en
-- vez de llevar una lista de excepciones.
revoke execute on function public.comb_solicitudes_set_serial() from public, anon;
revoke execute on function public.comb_reportes_set_serial()    from public, anon;

-- ══════════════════════════════════════════════════════════════════════
-- 8 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  c text;
begin
  foreach c in array array[
    'vale_a_empleado_id','vale_a_persona_id','solicitado_por_persona_id',
    'excluir_del_control'
  ] loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='comb_solicitudes' and column_name=c
    ) then
      v_mal := v_mal || format('falta la columna %s; ', c);
    end if;
  end loop;

  foreach c in array array['comb_solicitudes_al_control','comb_reportes_recoge'] loop
    if not exists (
      select 1 from pg_trigger g where g.tgname = c and not g.tgisinternal
    ) then
      v_mal := v_mal || format('falta el trigger %s; ', c);
    end if;
  end loop;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='comb_borrar_solicitud'
  ) then
    v_mal := v_mal || 'falta comb_borrar_solicitud; ';
  end if;

  -- Ninguna funcion del modulo, sin excepciones que haya que recordar.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'comb\_%'
       and has_function_privilege('anon', p.oid, 'execute')
  ) then
    v_mal := v_mal || format('anon todavia ejecuta: %s; ', (
      select string_agg(p.proname, ', ')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'comb\_%'
         and has_function_privilege('anon', p.oid, 'execute')));
  end if;

  -- Lo que motivo la fase: el vale del 6 de noviembre tiene que haber caido
  -- en CV-2026-0001 (1 al 15 de noviembre).
  if exists (
    select 1 from public.comb_solicitudes s
     where s.deleted_at is null and s.estado <> 'anulada'
       and not s.excluir_del_control and s.reporte_id is null
       and exists (
         select 1 from public.comb_reportes r
          where r.estado = 'abierto' and r.deleted_at is null
            and s.fecha between r.periodo_ini and r.periodo_fin)
  ) then
    v_mal := v_mal || 'quedaron vales sueltos con su control abierto; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

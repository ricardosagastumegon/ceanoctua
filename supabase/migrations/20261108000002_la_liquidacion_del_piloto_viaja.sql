-- Fase 57 · La liquidacion del piloto viaja, y llega con todo
--
-- Lo que ella pidio, en sus palabras: «Desde el usuario y Rol del piloto al
-- cerrarse la liquidacion, en lugar de "enviar a pagos" el siguiente paso sea
-- "Enviar A:" Zonia o Mi, y ya al recibirla nosotros y revisarla entonces si:
-- ENVIAR A PAGOS. Si la liquidacion es llenada y creada por mi o por Zonia,
-- entonces si tendra que tener "ENVIAR A PAGOS" tal como funciona la otra».
--
-- NO HACE FALTA INVENTAR EL ENVIO. `envios` ya es exactamente eso --
-- destinatario, copia congelada de lo que debe ver quien recibe, aceptar o
-- rechazar, y cascada automatica al aceptar-- y es la misma tuberia por la que
-- el control de vales llega a Victor. Aqui solo se enchufa un documento mas.
--
-- Y LO QUE MAS IMPORTABA: «sin importar desde donde se origine, cuando avance
-- en el proceso esta liquidacion debe de avanzar con toooodas las imagenes o
-- pdfs adjuntos, hasta su destino final». Eso tiene una trampa concreta: las
-- fotos NO cuelgan de la liquidacion, cuelgan de CADA GASTO. La cadena que
-- lleva adjuntos hasta la SP resuelve el documento en un solo salto, y aqui
-- hacen falta dos: foto -> gasto -> liquidacion -> SP. Sin eso, Javier y
-- Victor abririan el expediente y lo verian VACIO, sin ningun error --la misma
-- forma del fallo de las estampas de firma--. El punto 7 es ese salto.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · De donde nacio y quien la hizo
-- ══════════════════════════════════════════════════════════════════════
--
-- El camino depende del origen, asi que el origen se graba AL CREARLA y no se
-- deduce despues mirando quien tiene la pantalla abierta. Un dato que se
-- recalcula cada vez que alguien mira es un dato que cambia de respuesta.

alter table public.avn_liquidaciones
  add column if not exists origen text not null default 'operacion';
alter table public.avn_liquidaciones
  add column if not exists creada_por uuid references public.usuarios(id);

alter table public.avn_liquidaciones drop constraint if exists avn_liquidaciones_origen_chk;
alter table public.avn_liquidaciones add constraint avn_liquidaciones_origen_chk
  check (origen in ('piloto', 'operacion'));

comment on column public.avn_liquidaciones.origen is
  'piloto: la lleno un piloto y pasa por revision antes de Pagos. operacion: la llenaron la asistente o la presidencia y va directo a Pagos.';

create or replace function public.avn_liquidacion_marcar_origen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.creada_por := coalesce(new.creada_por, auth.uid());
  -- Si quien la crea es un piloto del catalogo, es suya y tiene que pasar por
  -- revision. Lo decide la base, no la pantalla: el boton de «Enviar a Pagos»
  -- no se le dibuja al piloto, pero tampoco se le concede si lo intentara.
  new.origen := case
    when public.avn_piloto_de_usuario() is not null then 'piloto'
    else 'operacion'
  end;
  return new;
end $function$;

revoke execute on function public.avn_liquidacion_marcar_origen() from public, anon, authenticated;

drop trigger if exists avn_liquidaciones_origen on public.avn_liquidaciones;
create trigger avn_liquidaciones_origen
  before insert on public.avn_liquidaciones
  for each row execute function public.avn_liquidacion_marcar_origen();

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Los dos estados que faltaban
-- ══════════════════════════════════════════════════════════════════════

alter table public.avn_liquidaciones drop constraint if exists avn_liquidaciones_estado_chk;
alter table public.avn_liquidaciones add constraint avn_liquidaciones_estado_chk
  check (estado in (
    'Borrador', 'Cerrada', 'En revision', 'Revisada', 'Enviada a SP', 'Reembolsada'
  ));

-- ══════════════════════════════════════════════════════════════════════
-- 3 · `envios` admite un documento mas
-- ══════════════════════════════════════════════════════════════════════

alter table public.envios drop constraint if exists envios_doc_tipo_check;
alter table public.envios add constraint envios_doc_tipo_check
  check (doc_tipo in (
    'comb_solicitud',
    'comb_reporte',
    'pago',
    'cc_vale',
    'cc_liquidacion',
    'avn_liquidacion'   -- la liquidacion del piloto, a revision
  ));

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Mandarla a revision
-- ══════════════════════════════════════════════════════════════════════
--
-- El acto es crear el envio --la pantalla reutiliza el mismo camino que ya
-- usa el control de vales-- y el estado lo mueve este trigger. Asi no hay dos
-- maneras de mandarla: si existe el envio, el estado le corresponde, y no
-- pueden quedar en desacuerdo.

create or replace function public.avn_liq_sale_a_revision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado text;
  v_origen text;
  v_serial text;
begin
  if new.doc_tipo <> 'avn_liquidacion' then
    return new;
  end if;

  select estado, origen, serial into v_estado, v_origen, v_serial
    from public.avn_liquidaciones where id = new.doc_id and deleted_at is null;

  if v_estado is null then
    raise exception 'Esa liquidacion no existe.';
  end if;
  if v_estado <> 'Cerrada' then
    raise exception 'La liquidacion % esta en «%»: solo se manda a revisar una recien cerrada.',
      v_serial, v_estado;
  end if;
  if v_origen <> 'piloto' then
    raise exception 'La liquidacion % no la hizo un piloto; va directo a Pagos.', v_serial;
  end if;

  update public.avn_liquidaciones
     set estado = 'En revision', updated_at = now()
   where id = new.doc_id;

  return new;
end $function$;

revoke execute on function public.avn_liq_sale_a_revision() from public, anon, authenticated;

drop trigger if exists avn_liq_sale_a_revision on public.envios;
create trigger avn_liq_sale_a_revision
  after insert on public.envios
  for each row execute function public.avn_liq_sale_a_revision();

-- ══════════════════════════════════════════════════════════════════════
-- 5 · Aceptarla, y devolverla
-- ══════════════════════════════════════════════════════════════════════
--
-- Aceptar la deja lista para Pagos. `envio_aceptar` busca
-- `envio_despacho_{doc_tipo}` y la llama sola, asi que basta con que exista.

create or replace function public.envio_despacho_avn_liquidacion(e public.envios)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.avn_liquidaciones
     set estado = 'Revisada', updated_at = now()
   where id = e.doc_id
     and estado = 'En revision';
end $function$;

comment on function public.envio_despacho_avn_liquidacion(public.envios) is
  'Quien revisa acepta la liquidacion del piloto: queda lista para mandarse a Pagos.';

revoke execute on function public.envio_despacho_avn_liquidacion(public.envios) from public, anon, authenticated;

-- DEVOLVERLA la regresa a borrador, en la pantalla del piloto, con la nota de
-- por que. `envio_rechazar` NO dispara cascada a proposito --un documento
-- rechazado no mueve nada-- asi que esto va por trigger y no por despacho.
--
-- Ella eligio las dos cosas: devolver Y poder corregir. Devolver es para lo
-- de fondo; corregir, para lo menor. Lo segundo lo habilita el punto 8.

create or replace function public.avn_liq_devuelta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.doc_tipo <> 'avn_liquidacion'
     or new.estado <> 'rechazado'
     or old.estado = 'rechazado' then
    return new;
  end if;

  update public.avn_liquidaciones
     set estado = 'Borrador',
         cerrada_en = null,
         cerrada_por = null,
         notas = concat_ws(
           ' · ',
           nullif(notas, ''),
           'Devuelta el ' || to_char(now(), 'DD/MM/YYYY')
             || coalesce(': ' || nullif(new.nota, ''), '.')
         ),
         updated_at = now()
   where id = new.doc_id
     and estado = 'En revision';

  return new;
end $function$;

revoke execute on function public.avn_liq_devuelta() from public, anon, authenticated;

drop trigger if exists avn_liq_devuelta on public.envios;
create trigger avn_liq_devuelta
  after update on public.envios
  for each row execute function public.avn_liq_devuelta();

-- ══════════════════════════════════════════════════════════════════════
-- 6 · Enviarla a Pagos
-- ══════════════════════════════════════════════════════════════════════

alter table public.pagos_notificaciones
  drop constraint if exists pagos_notificaciones_origen_tipo_check;
alter table public.pagos_notificaciones
  add constraint pagos_notificaciones_origen_tipo_check
  check (origen_tipo in (
    'liquidacion', 'consumo_tc', 'combustible', 'combustible_vehiculos',
    'avn_liquidacion'
  ));

create or replace function public.avn_liquidacion_enviar_a_pagos(p_liq uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l public.avn_liquidaciones;
  v_piloto text;
  v_matricula text;
  v_notif uuid;
begin
  select * into l from public.avn_liquidaciones
   where id = p_liq and deleted_at is null;

  if l.id is null then
    raise exception 'Esa liquidacion no existe.';
  end if;

  -- El estado exigido depende del origen. Es la regla entera en una linea.
  if l.origen = 'piloto' and l.estado <> 'Revisada' then
    raise exception
      'La liquidacion % esta en «%». La que llena un piloto va a Pagos despues de revisarse.',
      l.serial, l.estado;
  end if;
  if l.origen = 'operacion' and l.estado <> 'Cerrada' then
    raise exception 'La liquidacion % esta en «%»; solo va a Pagos una cerrada.',
      l.serial, l.estado;
  end if;

  -- Sin reembolso no hay nada que pagar. Mandar una SP de cero seria crear
  -- trabajo para quien firma y para el tesorero sobre un papel vacio.
  if coalesce(l.piloto_gtq, 0) <= 0 then
    raise exception
      'La liquidacion % no tiene nada que reembolsarle al piloto: todos los gastos los pago la empresa.',
      l.serial;
  end if;

  select p.nombre into v_piloto from public.avn_pilotos p where p.id = l.piloto_id;
  select a.matricula into v_matricula from public.avn_aeronaves a where a.id = l.aeronave_id;

  insert into public.pagos_notificaciones (origen_tipo, origen_id, resumen, monto, moneda)
  values (
    'avn_liquidacion',
    l.id,
    concat_ws(' · ',
      'Reembolso al piloto ' || coalesce(v_piloto, ''),
      coalesce(v_matricula, '') || ' ' || coalesce(l.ruta, ''),
      l.serial),
    l.piloto_gtq,
    'GTQ'
  )
  returning id into v_notif;

  update public.avn_liquidaciones
     set estado = 'Enviada a SP', updated_at = now()
   where id = p_liq;

  return v_notif;
end $function$;

comment on function public.avn_liquidacion_enviar_a_pagos(uuid) is
  'Crea el aviso en Pagos por el reembolso al piloto. Exige «Revisada» si la hizo un piloto, «Cerrada» si la hizo la operacion.';

revoke execute on function public.avn_liquidacion_enviar_a_pagos(uuid) from public, anon;
grant  execute on function public.avn_liquidacion_enviar_a_pagos(uuid) to authenticated;

-- Y quien la mande tiene que poder crear ese aviso.
drop policy if exists pagos_notif_avn_liq_insert on public.pagos_notificaciones;
create policy pagos_notif_avn_liq_insert on public.pagos_notificaciones for insert
  with check (
    origen_tipo = 'avn_liquidacion'
    and (public.puede('aeronaves', 'editor') or public.puede('avn_liquidacion', 'editor'))
  );

-- ══════════════════════════════════════════════════════════════════════
-- 7 · El salto de dos, para que llegue CON TODO
-- ══════════════════════════════════════════════════════════════════════
--
-- Aqui esta lo que habria fallado en silencio. Los demas origenes cuelgan sus
-- adjuntos de si mismos: el control de vales tiene los suyos, el consumo los
-- suyos. La liquidacion del piloto NO: cada foto cuelga de su gasto, porque es
-- la factura DE ESE RENGLON --que es justo lo que hace bueno al formato--.
--
-- Asi que para este origen el camino tiene un salto mas, y se resuelve aqui
-- dentro en vez de pedirle a cada politica que lo sepa.

create or replace function public.pago_del_documento(p_tipo text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id
    from public.pagos_notificaciones n
    join public.pagos p on p.origen_notificacion_id = n.id
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
  'La solicitud de pago a la que llega un documento de origen. Para la liquidacion del piloto da el salto extra foto->gasto->liquidacion. Solo resuelve el camino; quien concede es puede_ver_pago.';

-- OJO: `anon` TAMBIEN. Esta funcion vive dentro de `documentos_read`, y una
-- funcion que aparece en una politica y que `anon` no puede ejecutar devuelve
-- 401 en vez de una lista vacia. La fase 54 lo concedio despues de perder una
-- tarde buscandolo; recrear la funcion aqui con el `revoke ... from anon` de
-- costumbre LO DESHIZO, y la comprobacion de abajo --que lo excluia a mano--
-- dejo pasar el fallo. Se arregla lo uno y lo otro.
revoke execute on function public.pago_del_documento(text, uuid) from public;
grant  execute on function public.pago_del_documento(text, uuid) to anon, authenticated;

-- Y la politica deja pasar por ese camino, no solo por el de quien opera.
-- Sin esta linea Javier firmaria sin poder abrir las facturas del viaje.
drop policy if exists documentos_read on public.documentos;
create policy documentos_read on public.documentos for select
  using (
    case entidad_tipo
      when 'pago' then public.puede_ver_pago(entidad_id)
      when 'firmas' then exists (
        select 1 from public.firmas f where f.id = entidad_id)
      when 'vouchers' then exists (
        select 1 from public.vouchers v where v.id = entidad_id)
      when 'avn_liq_gasto' then
        public.avn_liq_gasto_visible(entidad_id)
        or public.puede_ver_pago(public.pago_del_documento('avn_liq_gasto', entidad_id))
      else
        public.auth_rol() in ('admin','asistente')
        or public.puede_ver_pago(public.pago_del_documento(entidad_tipo, entidad_id))
    end
  );

-- ══════════════════════════════════════════════════════════════════════
-- 8 · Quien revisa, corrige
-- ══════════════════════════════════════════════════════════════════════
--
-- Decision suya, con las dos opciones delante: «Devolver al piloto y puede ser
-- tambien corregirla nosotras mismas, porque pueden pasar las dos cosas,
-- entonces a Zonia y a mi ponos la misma habilitacion».
--
-- Mientras no haya salido hacia Pagos, quien revisa puede tocarla. Una vez
-- que salio, no: ahi ya hay gente firmando lo que dice. El admin conserva la
-- salida de emergencia, que queda en `audit_log` como todo lo demas.

create or replace function public.avn_liquidacion_abierta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado text;
  v_rol text := coalesce(public.auth_rol()::text, '');
  v_liq uuid := case when tg_op = 'DELETE' then old.liquidacion_id else new.liquidacion_id end;
begin
  select estado into v_estado from public.avn_liquidaciones where id = v_liq;

  if v_estado = 'Borrador' or v_rol = 'admin' then
    return coalesce(new, old);
  end if;

  if v_estado in ('Cerrada', 'En revision', 'Revisada') and v_rol = 'asistente' then
    return coalesce(new, old);
  end if;

  raise exception
    'La liquidacion esta en «%» y sus gastos no se pueden cambiar desde aqui.', v_estado;
end $function$;

revoke execute on function public.avn_liquidacion_abierta() from public, anon, authenticated;

-- Lo mismo para la cabecera.
create or replace function public.avn_liquidacion_cabecera_abierta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rol text := coalesce(public.auth_rol()::text, '');
begin
  if old.estado = 'Borrador' or v_rol = 'admin' then
    return new;
  end if;

  if old.estado in ('Cerrada', 'En revision', 'Revisada') and v_rol = 'asistente' then
    return new;
  end if;

  if (new.aeronave_id, new.piloto_id, new.ruta, new.fecha_inicio, new.fecha_fin,
      new.motivo, new.pasajeros, new.tc_gtq_usd, new.tc_usd_gtq)
      is distinct from
     (old.aeronave_id, old.piloto_id, old.ruta, old.fecha_inicio, old.fecha_fin,
      old.motivo, old.pasajeros, old.tc_gtq_usd, old.tc_usd_gtq)
  then
    raise exception
      'La liquidacion % esta en «%» y sus datos ya no se pueden cambiar.',
      old.serial, old.estado;
  end if;

  return new;
end $function$;

revoke execute on function public.avn_liquidacion_cabecera_abierta() from public, anon, authenticated;

-- Y subir o quitar una foto mientras se revisa, tambien.
drop policy if exists documentos_write on public.documentos;
create policy documentos_write on public.documentos for all
  using (
    public.auth_rol() in ('admin','asistente')
    or (entidad_tipo = 'avn_liq_gasto' and public.avn_liq_gasto_visible(entidad_id))
  )
  with check (
    public.auth_rol() in ('admin','asistente')
    or (entidad_tipo = 'avn_liq_gasto' and public.avn_liq_gasto_visible(entidad_id))
  );

-- ══════════════════════════════════════════════════════════════════════
-- 9 · Quien puede recibirla
-- ══════════════════════════════════════════════════════════════════════
--
-- Ella y Zonia: quien opera y no es piloto. Se resuelve por lo que la persona
-- ES y no por una lista de nombres, para que el dia que exista el usuario de
-- Zonia aparezca solo y nadie tenga que acordarse de agregarlo.

create or replace function public.avn_liq_revisores()
returns table (id uuid, nombre text, rol text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select u.id, u.nombre, u.rol::text
    from public.usuarios u
   where u.rol in ('admin', 'asistente')
     and coalesce(u.activo, true)
     and not exists (
       select 1 from public.avn_pilotos p
        where p.usuario_id = u.id and p.deleted_at is null
     )
   order by u.nombre;
$$;

comment on function public.avn_liq_revisores() is
  'A quien le puede mandar un piloto su liquidacion: quien opera y no es piloto.';

revoke execute on function public.avn_liq_revisores() from public, anon;
grant  execute on function public.avn_liq_revisores() to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_def text;
  f text;
  v_n int;
begin
  -- Los estados nuevos entraron y los viejos siguen.
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.avn_liquidaciones'::regclass
     and conname = 'avn_liquidaciones_estado_chk';
  foreach f in array array['Borrador','Cerrada','En revision','Revisada','Enviada a SP','Reembolsada'] loop
    if v_def not like '%''' || f || '''%' then
      v_mal := v_mal || format('el CHECK de estado perdio «%s»; ', f);
    end if;
  end loop;

  -- `envios` no perdio ningun tipo al añadir el nuevo.
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.envios'::regclass and conname = 'envios_doc_tipo_check';
  foreach f in array array['comb_solicitud','comb_reporte','pago','cc_vale','cc_liquidacion','avn_liquidacion'] loop
    if v_def not like '%''' || f || '''%' then
      v_mal := v_mal || format('el CHECK de doc_tipo perdio «%s»; ', f);
    end if;
  end loop;

  -- Ni `pagos_notificaciones`. Este CHECK ya se reescribio tres veces y cada
  -- vez es la ocasion de perder un origen vivo sin que nadie lo note.
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.pagos_notificaciones'::regclass
     and conname = 'pagos_notificaciones_origen_tipo_check';
  foreach f in array array['liquidacion','consumo_tc','combustible','combustible_vehiculos','avn_liquidacion'] loop
    if v_def not like '%''' || f || '''%' then
      v_mal := v_mal || format('el CHECK de origen de Pagos perdio «%s»; ', f);
    end if;
  end loop;

  -- Y que no haya ninguna fila viva con un origen que el CHECK ya no admite.
  select count(*) into v_n from public.pagos_notificaciones
   where origen_tipo not in ('liquidacion','consumo_tc','combustible','combustible_vehiculos','avn_liquidacion');
  if v_n > 0 then
    v_mal := v_mal || format('%s avisos de Pagos tienen un origen fuera del CHECK; ', v_n);
  end if;

  -- Los triggers del viaje.
  foreach f in array array['avn_liquidaciones_origen','avn_liq_sale_a_revision','avn_liq_devuelta'] loop
    if not exists (select 1 from pg_trigger where tgname = f and not tgisinternal) then
      v_mal := v_mal || format('falta el trigger %s; ', f);
    end if;
  end loop;

  -- El despacho tiene que llamarse EXACTAMENTE asi o `envio_aceptar` no lo
  -- encuentra, y la liquidacion se quedaria en «En revision» para siempre sin
  -- que nada avise.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'envio_despacho_avn_liquidacion'
  ) then
    v_mal := v_mal || 'falta envio_despacho_avn_liquidacion: el envio se aceptaria sin mover nada; ';
  end if;

  -- Las de politica, ejecutables por anon. SIN EXCEPCIONES A MANO: la primera
  -- version de esta migracion excluia `pago_del_documento` de la lista «porque
  -- va detras de otra condicion», y asi se colo que recrear la funcion le
  -- habia quitado el permiso que la fase 54 le dio. Una lista de excepciones
  -- en una comprobacion es una comprobacion que no comprueba.
  foreach f in array array[
    'avn_piloto_de_usuario','avn_liq_gasto_visible','pago_del_documento','puede_ver_pago'
  ] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f
         and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then
      v_mal := v_mal || format('anon no puede ejecutar %s: las politicas daran 401; ', f);
    end if;
  end loop;

  foreach f in array array[
    'avn_liquidacion_marcar_origen','avn_liq_sale_a_revision','avn_liq_devuelta',
    'envio_despacho_avn_liquidacion','avn_liquidacion_abierta','avn_liquidacion_cabecera_abierta'
  ] loop
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f
         and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    ) then
      v_mal := v_mal || format('%s sigue siendo ejecutable desde la app; ', f);
    end if;
  end loop;

  select count(*) into v_n from pg_policies
   where schemaname = 'public' and tablename = 'documentos' and cmd = 'SELECT';
  if v_n <> 1 then
    v_mal := v_mal || format('documentos tiene %s politicas de lectura, se esperaba 1; ', v_n);
  end if;

  select count(*) into v_n from public.avn_liquidaciones where deleted_at is null;
  v_rep := v_rep || format('liquidaciones vivas: %s ', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

-- Fase 56 · Aeronaves · La liquidacion del piloto
--
-- Sustituye el PDF que ella describio como «HORRIBLE, poco legible, NADA
-- entendible». Las cuentas de ese papel estaban bien --cuadran al centavo--
-- pero el formato fallaba en cuatro sitios, y cada uno se resuelve aqui con
-- una decision de modelo, no de pantalla:
--
--   1. LAS DESCRIPCIONES NO CORRESPONDIAN A SUS FILAS. Iban en un bloque
--      suelto al final, en otro orden: para saber que era cada gasto habia
--      que multiplicar galones por precio y buscar el que cuadrara. Aqui el
--      concepto vive EN la fila, porque es una columna de la fila.
--
--   2. UNA COLUMNA HACIA DOS TRABAJOS. «TARJETA / EFECTIVO / CREDITO» llevaba
--      una X que ademas decia «(EMPRESA)» o «(FM)», y los subtotales sumaban
--      por quien pagaba, no por el medio. De ahi nacia todo lo demas. Aqui
--      son dos columnas: `pagado_por` y `medio`.
--
--   3. HABIA DOS TIPOS DE CAMBIO EN EL MISMO PAPEL Y NO LO DECIA --7.53 para
--      lo nacido en quetzales y 7.91 para lo nacido en dolares; se deducian
--      dividiendo--. Aqui cada gasto guarda SU moneda de origen y SU tipo de
--      cambio, y el equivalente lo calcula la base.
--
--   4. EL REEMBOLSO AL PILOTO ERA UNA NOTA EN PROSA al pie. Aqui es la suma
--      de las lineas que pago el piloto, mantenida por un trigger.
--
-- NO SE CREA CATALOGO DE PILOTOS: `avn_pilotos` ya existe desde la fase de
-- vuelos y es global --no cuelga de ninguna aeronave--. Lo unico que le
-- faltaba era poder atarse a un usuario, para el dia que el piloto entre.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Un modulo propio para el piloto
-- ══════════════════════════════════════════════════════════════════════
--
-- El piloto NO debe tener «aeronaves» entero --ahi estan la flota, los
-- certificados, el estado de cuenta y el combustible de la empresa--. Solo
-- su liquidacion. Eso pide una llave de modulo aparte.
--
-- Reescribir este CHECK a mano es donde se cae un modulo sin que nadie lo
-- note hasta que alguien no puede entrar, asi que la comprobacion del final
-- los cuenta uno por uno.

alter table public.usuario_modulos
  drop constraint if exists usuario_modulos_modulo_chk;

alter table public.usuario_modulos
  add constraint usuario_modulos_modulo_chk
  check (modulo = any (array[
    'dashboard', 'tt', 'cea', 'finanzas', 'caja_chica', 'miel_sj', 'admin',
    'combustible', 'tesoreria', 'aeronaves', 'avn_liquidacion',
    -- Las sub-vistas por miembro de junta.
    'maa', 'ja', 'la', 'jm', 'aa', 'eg', 'pe'
  ]));

-- ══════════════════════════════════════════════════════════════════════
-- 2 · El piloto, atado a su usuario
-- ══════════════════════════════════════════════════════════════════════

alter table public.avn_pilotos
  add column if not exists usuario_id uuid references public.usuarios(id);

create unique index if not exists avn_pilotos_usuario_uniq
  on public.avn_pilotos (usuario_id) where usuario_id is not null;

comment on column public.avn_pilotos.usuario_id is
  'El usuario con el que entra este piloto, si tiene. Null para los que solo existen en el catalogo.';

-- Quien es piloto, ve lo suyo. Quien no lo es --ella, Zonia, un admin-- lo ve
-- todo. Devuelve null para el segundo caso, que es como la politica
-- distingue los dos sin preguntar por roles.
create or replace function public.avn_piloto_de_usuario()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id from public.avn_pilotos p
   where p.usuario_id = auth.uid() and p.deleted_at is null
   limit 1;
$$;

comment on function public.avn_piloto_de_usuario() is
  'El piloto del catalogo atado al usuario de la sesion, o null si no es piloto.';

-- ══════════════════════════════════════════════════════════════════════
-- 3 · El correlativo
-- ══════════════════════════════════════════════════════════════════════

create sequence if not exists public.avn_liquidacion_seq;

create or replace function public.avn_liquidacion_next_serial()
returns text
language plpgsql
as $function$
declare
  y int := extract(year from current_date)::int;
  n bigint;
begin
  n := nextval('public.avn_liquidacion_seq');
  return 'LP-' || y::text || '-' || lpad(n::text, 4, '0');
end;
$function$;

create or replace function public.avn_liquidacion_set_serial()
returns trigger
language plpgsql
as $function$
begin
  if new.serial is null or new.serial = '' then
    new.serial := public.avn_liquidacion_next_serial();
  end if;
  return new;
end;
$function$;

-- ══════════════════════════════════════════════════════════════════════
-- 4 · La liquidacion
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.avn_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  serial text,

  aeronave_id uuid not null references public.avn_aeronaves(id),
  piloto_id   uuid not null references public.avn_pilotos(id),

  ruta text,
  fecha_inicio date not null,
  fecha_fin    date not null,
  motivo text,
  pasajeros text,

  -- Los dos tipos de cambio del viaje, declarados. El papel viejo los tenia
  -- y no los decia: se sacaban dividiendo Q entre $ linea por linea.
  tc_gtq_usd numeric(12,4),
  tc_usd_gtq numeric(12,4),

  estado text not null default 'Borrador',

  -- Los lleva el trigger a partir de las lineas. Un total escrito a mano se
  -- desincroniza en cuanto alguien edita un renglon --la misma leccion del
  -- total del registro de combustible--.
  total_gtq    numeric(14,2) not null default 0,
  total_usd    numeric(14,2) not null default 0,
  empresa_gtq  numeric(14,2) not null default 0,
  piloto_gtq   numeric(14,2) not null default 0,
  piloto_usd   numeric(14,2) not null default 0,

  notas text,
  cerrada_en timestamptz,
  cerrada_por uuid references public.usuarios(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.avn_liquidaciones drop constraint if exists avn_liquidaciones_estado_chk;
alter table public.avn_liquidaciones add constraint avn_liquidaciones_estado_chk
  check (estado in ('Borrador', 'Cerrada', 'Enviada a SP', 'Reembolsada'));

alter table public.avn_liquidaciones drop constraint if exists avn_liquidaciones_fechas_chk;
alter table public.avn_liquidaciones add constraint avn_liquidaciones_fechas_chk
  check (fecha_fin >= fecha_inicio);

alter table public.avn_liquidaciones drop constraint if exists avn_liquidaciones_tc_chk;
alter table public.avn_liquidaciones add constraint avn_liquidaciones_tc_chk
  check (coalesce(tc_gtq_usd, 1) > 0 and coalesce(tc_usd_gtq, 1) > 0);

create unique index if not exists avn_liquidaciones_serial_uniq
  on public.avn_liquidaciones (serial) where serial is not null;
create index if not exists avn_liquidaciones_piloto_idx
  on public.avn_liquidaciones (piloto_id, fecha_inicio desc) where deleted_at is null;
create index if not exists avn_liquidaciones_aeronave_idx
  on public.avn_liquidaciones (aeronave_id, fecha_inicio desc) where deleted_at is null;

drop trigger if exists avn_liquidaciones_serial on public.avn_liquidaciones;
create trigger avn_liquidaciones_serial
  before insert on public.avn_liquidaciones
  for each row execute function public.avn_liquidacion_set_serial();

drop trigger if exists avn_liquidaciones_updated on public.avn_liquidaciones;
create trigger avn_liquidaciones_updated
  before update on public.avn_liquidaciones
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- 5 · Los gastos
-- ══════════════════════════════════════════════════════════════════════
--
-- `monto` es lo que COBRARON, en la moneda en que lo cobraron. Los dos
-- equivalentes los calcula la base, asi que no hay forma de que queden
-- distintos de sus factores ni de que alguien teclee uno de los dos mal.

create table if not exists public.avn_liquidacion_gastos (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null
    references public.avn_liquidaciones(id) on delete cascade,

  orden integer not null default 0,
  fecha date not null,
  categoria text not null,
  proveedor text not null,
  detalle text,

  documento text,
  -- Declarar que no hay documento es un acto deliberado, no un descuido: de
  -- eso depende poder cerrar. Una comida de Q50 sin factura es legitima; una
  -- factura que nadie subio, no, y sin esta bandera no se distinguen.
  sin_documento boolean not null default false,

  pagado_por text not null,
  medio text not null,

  moneda text not null default 'GTQ',
  monto numeric(14,2) not null,
  tipo_cambio numeric(12,4) not null,

  monto_gtq numeric(14,2) generated always as (
    case when moneda = 'GTQ' then monto else round(monto * tipo_cambio, 2) end
  ) stored,
  monto_usd numeric(14,2) generated always as (
    case when moneda = 'USD' then monto else round(monto / tipo_cambio, 2) end
  ) stored,

  -- El vale, cuando el proveedor es el de contrato y el registro ya existe.
  -- NULLABLE A PROPOSITO: ella fue explicita en que «no siempre ira amarrado
  -- a un vale que ya se haya ingresado» --en Mundo Maya y en Key West el
  -- proveedor es otro--. Obligarlo convertiria el caso normal en un bloqueo.
  registro_combustible_id uuid references public.avn_combustible_registros(id),
  galones numeric(12,3),
  precio_unitario numeric(12,4),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.avn_liquidacion_gastos drop constraint if exists avn_liq_gastos_categoria_chk;
alter table public.avn_liquidacion_gastos add constraint avn_liq_gastos_categoria_chk
  check (categoria in (
    'Combustible', 'Servicios aeroportuarios', 'Hotel y transporte',
    'Alimentacion', 'Tramites', 'Otros'
  ));

alter table public.avn_liquidacion_gastos drop constraint if exists avn_liq_gastos_pagado_chk;
alter table public.avn_liquidacion_gastos add constraint avn_liq_gastos_pagado_chk
  check (pagado_por in ('empresa', 'piloto'));

alter table public.avn_liquidacion_gastos drop constraint if exists avn_liq_gastos_medio_chk;
alter table public.avn_liquidacion_gastos add constraint avn_liq_gastos_medio_chk
  check (medio in ('Tarjeta', 'Efectivo', 'Credito', 'Transferencia'));

alter table public.avn_liquidacion_gastos drop constraint if exists avn_liq_gastos_moneda_chk;
alter table public.avn_liquidacion_gastos add constraint avn_liq_gastos_moneda_chk
  check (moneda in ('GTQ', 'USD'));

-- El tipo de cambio divide en una columna calculada: un cero reventaria el
-- insert con un error de division, no con uno que explique nada.
alter table public.avn_liquidacion_gastos drop constraint if exists avn_liq_gastos_montos_chk;
alter table public.avn_liquidacion_gastos add constraint avn_liq_gastos_montos_chk
  check (monto > 0 and tipo_cambio > 0);

create index if not exists avn_liq_gastos_liq_idx
  on public.avn_liquidacion_gastos (liquidacion_id, orden, fecha);

drop trigger if exists avn_liq_gastos_updated on public.avn_liquidacion_gastos;
create trigger avn_liq_gastos_updated
  before update on public.avn_liquidacion_gastos
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- 6 · Los totales los lleva la base
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.avn_liquidacion_recalcular()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_liq uuid := coalesce(new.liquidacion_id, old.liquidacion_id);
begin
  update public.avn_liquidaciones l
     set total_gtq   = coalesce(t.total_gtq, 0),
         total_usd   = coalesce(t.total_usd, 0),
         empresa_gtq = coalesce(t.empresa_gtq, 0),
         piloto_gtq  = coalesce(t.piloto_gtq, 0),
         piloto_usd  = coalesce(t.piloto_usd, 0),
         updated_at  = now()
    from (
      select sum(monto_gtq) as total_gtq,
             sum(monto_usd) as total_usd,
             sum(monto_gtq) filter (where pagado_por = 'empresa') as empresa_gtq,
             sum(monto_gtq) filter (where pagado_por = 'piloto')  as piloto_gtq,
             sum(monto_usd) filter (where pagado_por = 'piloto')  as piloto_usd
        from public.avn_liquidacion_gastos
       where liquidacion_id = v_liq
    ) t
   where l.id = v_liq;

  return coalesce(new, old);
end $function$;

comment on function public.avn_liquidacion_recalcular() is
  'Mantiene los totales de la liquidacion a partir de sus gastos. El reembolso al piloto es piloto_gtq.';

revoke execute on function public.avn_liquidacion_recalcular() from public, anon, authenticated;

drop trigger if exists avn_liq_gastos_totales on public.avn_liquidacion_gastos;
create trigger avn_liq_gastos_totales
  after insert or update or delete on public.avn_liquidacion_gastos
  for each row execute function public.avn_liquidacion_recalcular();

-- ══════════════════════════════════════════════════════════════════════
-- 7 · Una liquidacion cerrada no se sigue editando
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.avn_liquidacion_abierta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado text;
  v_liq uuid := coalesce(
    case when tg_op = 'DELETE' then old.liquidacion_id else new.liquidacion_id end,
    old.liquidacion_id
  );
begin
  select estado into v_estado from public.avn_liquidaciones where id = v_liq;

  -- `coalesce` a proposito: `auth_rol()` nulo --sin sesion, o un script-- da
  -- NULL al comparar, y un `if` con NULL no entra. El guarda se desactivaria
  -- justo para quien menos identificado esta. Sin sesion no es admin.
  if v_estado is distinct from 'Borrador' and coalesce(public.auth_rol()::text, '') <> 'admin' then
    raise exception
      'La liquidacion ya esta en «%» y sus gastos no se pueden cambiar. Hay que reabrirla.', v_estado;
  end if;

  return coalesce(new, old);
end $function$;

revoke execute on function public.avn_liquidacion_abierta() from public, anon, authenticated;

drop trigger if exists avn_liq_gastos_solo_abierta on public.avn_liquidacion_gastos;
create trigger avn_liq_gastos_solo_abierta
  before insert or update or delete on public.avn_liquidacion_gastos
  for each row execute function public.avn_liquidacion_abierta();

-- Y la cabecera tampoco. Los totales y el estado quedan fuera de la
-- comparacion porque los mueven los triggers y las funciones de abajo.
create or replace function public.avn_liquidacion_cabecera_abierta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.estado <> 'Borrador'
     and coalesce(public.auth_rol()::text, '') <> 'admin'
     and (new.aeronave_id, new.piloto_id, new.ruta, new.fecha_inicio, new.fecha_fin,
          new.motivo, new.pasajeros, new.tc_gtq_usd, new.tc_usd_gtq)
         is distinct from
         (old.aeronave_id, old.piloto_id, old.ruta, old.fecha_inicio, old.fecha_fin,
          old.motivo, old.pasajeros, old.tc_gtq_usd, old.tc_usd_gtq)
  then
    raise exception
      'La liquidacion % ya esta en «%» y sus datos no se pueden cambiar. Hay que reabrirla.',
      old.serial, old.estado;
  end if;
  return new;
end $function$;

revoke execute on function public.avn_liquidacion_cabecera_abierta() from public, anon, authenticated;

drop trigger if exists avn_liquidaciones_solo_abierta on public.avn_liquidaciones;
create trigger avn_liquidaciones_solo_abierta
  before update on public.avn_liquidaciones
  for each row execute function public.avn_liquidacion_cabecera_abierta();

-- ══════════════════════════════════════════════════════════════════════
-- 8 · Cerrar y reabrir
-- ══════════════════════════════════════════════════════════════════════
--
-- La foto de la factura NO estorba mientras se captura --ella fue explicita:
-- «no sera condicionante para seguir agregando consumos»-- pero SI para
-- cerrar. Cerrar es el acto que dice «esto ya es el respaldo»; sin los
-- documentos no lo es.
--
-- Y NOMBRA LO QUE FALTA. Un «faltan documentos» a secas obliga a revisar la
-- lista entera a ojo; es la misma leccion que dejo el cierre del control de
-- vales de combustible, que ahora enumera los vales que no llegaron.

create or replace function public.avn_liquidacion_cerrar(p_liq uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado text;
  v_serial text;
  v_n int;
  v_faltan text;
begin
  select estado, serial into v_estado, v_serial
    from public.avn_liquidaciones where id = p_liq and deleted_at is null;

  if v_estado is null then
    raise exception 'Esa liquidacion no existe.';
  end if;
  if v_estado <> 'Borrador' then
    raise exception 'La liquidacion % ya estaba en «%».', v_serial, v_estado;
  end if;

  select count(*) into v_n
    from public.avn_liquidacion_gastos where liquidacion_id = p_liq;
  if v_n = 0 then
    raise exception 'La liquidacion % no tiene ningun gasto.', v_serial;
  end if;

  select string_agg(
           to_char(g.fecha, 'DD/MM') || ' · ' || g.proveedor
           || coalesce(' · ' || g.documento, ''),
           '; ' order by g.orden, g.fecha)
    into v_faltan
    from public.avn_liquidacion_gastos g
   where g.liquidacion_id = p_liq
     and not g.sin_documento
     and not exists (
       select 1 from public.documentos d
        where d.entidad_tipo = 'avn_liq_gasto' and d.entidad_id = g.id
     );

  if v_faltan is not null then
    raise exception
      'Faltan los documentos de: %. Subilos, o marcalos como «sin documento» si de verdad no hay.',
      v_faltan;
  end if;

  update public.avn_liquidaciones
     set estado = 'Cerrada', cerrada_en = now(), cerrada_por = auth.uid(), updated_at = now()
   where id = p_liq;
end $function$;

comment on function public.avn_liquidacion_cerrar(uuid) is
  'Cierra la liquidacion. Exige al menos un gasto y, de cada uno, su documento o la marca de que no lo hay.';

revoke execute on function public.avn_liquidacion_cerrar(uuid) from public, anon;
grant  execute on function public.avn_liquidacion_cerrar(uuid) to authenticated;

create or replace function public.avn_liquidacion_reabrir(p_liq uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado text;
  v_serial text;
begin
  if coalesce(public.auth_rol()::text, '') <> 'admin' then
    raise exception 'Solo un administrador puede reabrir una liquidacion.';
  end if;

  select estado, serial into v_estado, v_serial
    from public.avn_liquidaciones where id = p_liq and deleted_at is null;

  if v_estado is null then
    raise exception 'Esa liquidacion no existe.';
  end if;
  if v_estado = 'Borrador' then
    raise exception 'La liquidacion % ya estaba abierta.', v_serial;
  end if;
  if v_estado = 'Reembolsada' then
    raise exception 'La liquidacion % ya se reembolso; reabrirla cambiaria algo que ya se pago.', v_serial;
  end if;

  update public.avn_liquidaciones
     set estado = 'Borrador', cerrada_en = null, cerrada_por = null, updated_at = now()
   where id = p_liq;
end $function$;

comment on function public.avn_liquidacion_reabrir(uuid) is
  'Devuelve la liquidacion a borrador. Solo admin, y nunca una ya reembolsada.';

revoke execute on function public.avn_liquidacion_reabrir(uuid) from public, anon;
grant  execute on function public.avn_liquidacion_reabrir(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 9 · Quien ve y quien escribe
-- ══════════════════════════════════════════════════════════════════════
--
-- Tres puertas y una regla de privacidad:
--   · «aeronaves» y «finanzas» ven todas --son quienes operan y quienes
--     pagan--.
--   · «avn_liquidacion» es la llave del piloto: entra solo a esto.
--   · Y si quien entra ES un piloto del catalogo, ve LO SUYO. Si no lo es
--     --ella, Zonia-- ve todo. Es la misma regla que ya rige el resto: cada
--     quien ve lo que le toca, sin que nadie tenga que acordarse de filtrar.

alter table public.avn_liquidaciones enable row level security;
alter table public.avn_liquidacion_gastos enable row level security;

drop policy if exists avn_liquidaciones_read on public.avn_liquidaciones;
create policy avn_liquidaciones_read on public.avn_liquidaciones for select
  using (
    public.puede('aeronaves', 'observador')
    or public.puede('finanzas', 'observador')
    or (
      public.puede('avn_liquidacion', 'observador')
      and (
        public.avn_piloto_de_usuario() is null
        or piloto_id = public.avn_piloto_de_usuario()
      )
    )
  );

drop policy if exists avn_liquidaciones_write on public.avn_liquidaciones;
create policy avn_liquidaciones_write on public.avn_liquidaciones for all
  using (
    public.puede('aeronaves', 'editor')
    or (
      public.puede('avn_liquidacion', 'editor')
      and (
        public.avn_piloto_de_usuario() is null
        or piloto_id = public.avn_piloto_de_usuario()
      )
    )
  )
  with check (
    public.puede('aeronaves', 'editor')
    or (
      public.puede('avn_liquidacion', 'editor')
      and (
        public.avn_piloto_de_usuario() is null
        or piloto_id = public.avn_piloto_de_usuario()
      )
    )
  );

-- Los gastos heredan de su liquidacion en vez de repetir la regla: si manana
-- cambia quien ve una liquidacion, sus gastos cambian con ella y no hay dos
-- sitios que puedan quedar diciendo cosas distintas. El `exists` consulta la
-- tabla CON sus politicas puestas --esta funcion no es definer-- asi que
-- pregunta, no copia.
drop policy if exists avn_liq_gastos_read on public.avn_liquidacion_gastos;
create policy avn_liq_gastos_read on public.avn_liquidacion_gastos for select
  using (
    exists (select 1 from public.avn_liquidaciones l where l.id = liquidacion_id)
  );

drop policy if exists avn_liq_gastos_write on public.avn_liquidacion_gastos;
create policy avn_liq_gastos_write on public.avn_liquidacion_gastos for all
  using (
    exists (
      select 1 from public.avn_liquidaciones l
       where l.id = liquidacion_id
         and (
           public.puede('aeronaves', 'editor')
           or (
             public.puede('avn_liquidacion', 'editor')
             and (
               public.avn_piloto_de_usuario() is null
               or l.piloto_id = public.avn_piloto_de_usuario()
             )
           )
         )
    )
  )
  with check (
    exists (
      select 1 from public.avn_liquidaciones l
       where l.id = liquidacion_id
         and (
           public.puede('aeronaves', 'editor')
           or (
             public.puede('avn_liquidacion', 'editor')
             and (
               public.avn_piloto_de_usuario() is null
               or l.piloto_id = public.avn_piloto_de_usuario()
             )
           )
         )
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- 10 · Las fotos de las facturas
-- ══════════════════════════════════════════════════════════════════════
--
-- Van al bucket `documentos` con su fila en `documentos`, que es el sitio
-- que YA viaja hasta la solicitud de pago. La alternativa --un `archivo_path`
-- en la linea-- es la que produjo que el mismo vale de combustible acabara
-- subido dos veces y que el del formulario nunca llegara a la SP.
--
-- Hace falta abrir tres cosas, porque hasta hoy subir y leer adjuntos era de
-- admin y asistente, y el piloto no es ninguno de los dos.

-- Invoker a proposito: le pregunta a la politica de los gastos en vez de
-- reescribirla. Es el mismo truco de `puede_ver_pago`.
create or replace function public.avn_liq_gasto_visible(p_gasto uuid)
returns boolean
language sql
stable
security invoker
set search_path to 'public'
as $$
  select exists (
    select 1 from public.avn_liquidacion_gastos g where g.id = p_gasto
  );
$$;

comment on function public.avn_liq_gasto_visible(uuid) is
  'Si quien pregunta alcanza el gasto. No copia la regla: consulta la tabla con sus politicas.';

drop policy if exists documentos_read on public.documentos;
create policy documentos_read on public.documentos for select
  using (
    case entidad_tipo
      when 'pago' then public.puede_ver_pago(entidad_id)
      when 'firmas' then exists (
        select 1 from public.firmas f where f.id = entidad_id)
      when 'vouchers' then exists (
        select 1 from public.vouchers v where v.id = entidad_id)
      when 'avn_liq_gasto' then public.avn_liq_gasto_visible(entidad_id)
      else
        public.auth_rol() in ('admin','asistente')
        or public.puede_ver_pago(public.pago_del_documento(entidad_tipo, entidad_id))
    end
  );

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

-- El bucket. Al subir todavia no existe la fila de `documentos`, asi que
-- aqui no se puede preguntar por ella: se concede por modulo, y la carpeta
-- del nombre acota donde puede escribir.
drop policy if exists "documentos insert" on storage.objects;
create policy "documentos insert" on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and (
      public.auth_rol() in ('admin','asistente')
      or (
        public.puede('avn_liquidacion', 'editor')
        and storage.objects.name like 'avn_liq_gasto/%'
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- 11 · Auditoria
-- ══════════════════════════════════════════════════════════════════════

drop trigger if exists audit_avn_liquidaciones on public.avn_liquidaciones;
create trigger audit_avn_liquidaciones
  after insert or update or delete on public.avn_liquidaciones
  for each row execute function public.audit_trigger();

drop trigger if exists audit_avn_liq_gastos on public.avn_liquidacion_gastos;
create trigger audit_avn_liq_gastos
  after insert or update or delete on public.avn_liquidacion_gastos
  for each row execute function public.audit_trigger();

-- ══════════════════════════════════════════════════════════════════════
-- 12 · Las politicas tienen que poder evaluarse
-- ══════════════════════════════════════════════════════════════════════
--
-- Una funcion que aparece en una politica y que `anon` no puede ejecutar
-- devuelve 401 en vez de una lista vacia. Costo una tarde encontrarlo en la
-- fase 50 y quedo como regla; estas dos son nuevas y les toca.

grant execute on function public.avn_piloto_de_usuario() to anon, authenticated;
grant execute on function public.avn_liq_gasto_visible(uuid) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_def text;
  m text;
  v_n int;
  f text;
begin
  -- El CHECK de modulos no perdio ninguno.
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.usuario_modulos'::regclass
     and conname = 'usuario_modulos_modulo_chk';
  foreach m in array array[
    'dashboard','tt','cea','finanzas','caja_chica','miel_sj','admin',
    'combustible','tesoreria','aeronaves','avn_liquidacion',
    'maa','ja','la','jm','aa','eg','pe'
  ] loop
    if v_def not like '%''' || m || '''%' then
      v_mal := v_mal || format('el CHECK de modulos perdio «%s»; ', m);
    end if;
  end loop;

  -- RLS puesto en las dos tablas nuevas.
  foreach f in array array['avn_liquidaciones','avn_liquidacion_gastos'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = f and c.relrowsecurity
    ) then
      v_mal := v_mal || format('%s sin RLS; ', f);
    end if;
    select count(*) into v_n from pg_policies
     where schemaname = 'public' and tablename = f;
    if v_n <> 2 then
      v_mal := v_mal || format('%s tiene %s politicas, se esperaban 2; ', f, v_n);
    end if;
    if not exists (
      select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = f and t.tgname = 'audit_' ||
         case f when 'avn_liquidaciones' then 'avn_liquidaciones' else 'avn_liq_gastos' end
    ) then
      v_mal := v_mal || format('%s sin auditoria; ', f);
    end if;
  end loop;

  -- Las dos funciones de politica, ejecutables por anon. Si no, 401.
  foreach f in array array['avn_piloto_de_usuario','avn_liq_gasto_visible'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f
         and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then
      v_mal := v_mal || format('anon no puede ejecutar %s: las politicas daran 401; ', f);
    end if;
  end loop;

  -- Y las que HACEN algo, cerradas. Supabase concede por omision a
  -- `authenticated` toda funcion nueva del esquema: revocar solo de `public`
  -- y `anon` no basta. Esto ya se escapo una vez.
  foreach f in array array[
    'avn_liquidacion_recalcular','avn_liquidacion_abierta','avn_liquidacion_cabecera_abierta'
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

  -- Las columnas calculadas estan y son calculadas.
  foreach f in array array['monto_gtq','monto_usd'] loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'avn_liquidacion_gastos'
         and column_name = f and is_generated = 'ALWAYS'
    ) then
      v_mal := v_mal || format('%s no quedo como columna calculada; ', f);
    end if;
  end loop;

  select count(*) into v_n from pg_policies
   where schemaname = 'public' and tablename = 'documentos' and cmd = 'SELECT';
  if v_n <> 1 then
    v_mal := v_mal || format('documentos tiene %s politicas de lectura, se esperaba 1; ', v_n);
  end if;

  -- Se prueba el correlativo y se devuelve la secuencia a su sitio: una
  -- secuencia NO retrocede sola al fallar una transaccion, y un registro
  -- cuyo primer numero es el 0002 invita a buscar el 0001 toda la vida.
  -- Solo se reinicia si todavia no hay ninguna liquidacion.
  v_rep := v_rep || format('serial de prueba: %s ', public.avn_liquidacion_next_serial());
  if not exists (select 1 from public.avn_liquidaciones) then
    perform setval('public.avn_liquidacion_seq', 1, false);
    v_rep := v_rep || '(secuencia devuelta al 1) ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

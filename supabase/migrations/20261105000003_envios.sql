-- Fase 45 · `envios`: la frontera entre usuarios
--
-- La usuaria fijo la regla el 5 nov 2026:
--
--   «cada usuario es independiente... yo no tendria porque ver lo que el tenga
--    en su usuario ni lo que hace... podremos enviarnos y recibir documentos o
--    avisos, pero cada quien en su rol y perfil.»
--
-- Y el encuadre que la explica:
--
--   «este sistema es para mi, y estoy dando acceso a las personas con las
--    cuales tengo comunicacion mas frecuente para agilizar los procedimientos.
--    En el camino les ayudo creandoles modulos para que ellos se faciliten el
--    trabajo, pero no es algo que me concierna ni que deba de ver. Solo les
--    estoy dando la herramienta.»
--
-- CEA deja de ser «una organizacion con varios usuarios» y pasa a ser «la
-- herramienta de una persona, que presta espacios a otras». Esta tabla es la
-- unica puerta entre esos espacios.
--
--
-- POR QUE UN `snapshot` Y NO UNA REFERENCIA VIVA
--
-- La tentacion es guardar `doc_id` y que el destinatario lea el documento. Eso
-- exige darle lectura sobre la tabla de origen, y ahi se acaba el aislamiento:
-- RLS concede por tabla, no por fila enviada. Se verifico que el rol
-- `solo_lectura` --el que este plan iba a darle al Tesorero-- concede lectura
-- sobre SEIS tablas financieras completas: pagos, caja_chica_vales,
-- caja_chica_liquidaciones, tc_consumos, vouchers y reintegros. Su pantalla
-- habria mostrado solo su bandeja; su sesion habria leido todo.
--
-- Asi que el envio lleva una COPIA CONGELADA de lo que el destinatario
-- necesita ver. Se basta a si mismo. El destinatario no lee ninguna tabla de
-- negocio ajena: lee `envios`, y nada mas.
--
-- Beneficio secundario, y no menor: queda constancia inmutable de que se le
-- enseño exactamente, aunque el documento original cambie despues.
--
--
-- POR QUE NO SE REUTILIZA `firmas`
--
-- `firmas` es el circuito de firma de la JUNTA DIRECTIVA, y ademas sigue el
-- recorrido del papel (`recepcion`, `entregado`, `quien_recibe`). El Tesorero
-- no es la junta y lo suyo no es una firma: es una recepcion. Mezclarlos
-- ensuciaria la trazabilidad de lo que si es una firma, que es justamente lo
-- que la fase 44 acaba de poner bajo auditoria.

-- ── El rol ─────────────────────────────────────────────────────────────
--
-- Hace falta un rol que NO caiga en `('admin','asistente','solo_lectura')`,
-- porque esas tres son las que abren las seis tablas financieras. `tesoreria`
-- no concede lectura sobre ninguna tabla de negocio: todo lo que su usuario ve
-- entra por `envios`.
--
-- Va primero y solo en esta migracion porque un valor nuevo de enum no se
-- puede USAR en la misma transaccion en que se agrega.

do $$
begin
  if not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'app_rol' and e.enumlabel = 'tesoreria'
  ) then
    alter type public.app_rol add value 'tesoreria';
  end if;
end $$;

-- ── Los modulos nuevos ─────────────────────────────────────────────────
--
-- Aditivo: no se quita ninguno de los que ya estaban.

alter table public.usuario_modulos
  drop constraint if exists usuario_modulos_modulo_chk;
alter table public.usuario_modulos
  add constraint usuario_modulos_modulo_chk
  check (modulo = any (array[
    'dashboard','tt','cea','finanzas','caja_chica','miel_sj','admin',
    'combustible','tesoreria',
    'maa','ja','la','jm','aa','eg','pe'
  ]));

-- ── La tabla ───────────────────────────────────────────────────────────

create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  serial text unique,

  destinatario_id uuid not null references public.usuarios(id) on delete cascade,

  -- Que clase de documento viaja. El CHECK es lo que permite derivar de aqui
  -- el nombre de la funcion de cascada sin riesgo de inyeccion (ver
  -- `envio_aceptar`).
  doc_tipo text not null check (doc_tipo in (
    'comb_solicitud',   -- solicitud de vale de combustible -> emite el vale
    'comb_reporte',     -- control de vales de la quincena
    'pago',             -- solicitud de pago ya firmada
    'cc_vale',          -- vale de dinero de caja chica        (fase siguiente)
    'cc_liquidacion'    -- liquidacion de caja chica           (fase siguiente)
  )),
  doc_id uuid not null,

  estado text not null default 'enviado'
    check (estado in ('enviado','aceptado','rechazado')),

  -- COPIA CONGELADA de lo que el destinatario debe ver para decidir. Es lo
  -- que hace innecesario darle lectura sobre la tabla de origen.
  snapshot jsonb not null default '{}'::jsonb,

  -- Lo que el destinatario llena AL ACEPTAR. Para una solicitud de vale:
  -- {"vale_num": "094311", "vale_fecha": "2026-10-01"}.
  datos jsonb not null default '{}'::jsonb,

  nota text,

  enviado_at timestamptz not null default now(),
  enviado_por uuid,
  resuelto_at timestamptz,
  resuelto_por uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

comment on table public.envios is
  'La unica puerta entre espacios de usuario. Un documento viaja a un usuario, el lo acepta, y su aceptacion mueve el estado del documento de origen.';
comment on column public.envios.snapshot is
  'Copia congelada de lo que el destinatario necesita ver. Evita concederle lectura sobre la tabla de origen, que RLS solo sabe dar entera.';
comment on column public.envios.datos is
  'Lo que el destinatario aporta al aceptar. Ej: el numero de vale que entrego.';

-- Un mismo documento no se envia dos veces a la vez al mismo destinatario.
create unique index if not exists envios_doc_destinatario_vivo_idx
  on public.envios (doc_tipo, doc_id, destinatario_id)
  where deleted_at is null and estado = 'enviado';

-- La consulta que hace la bandeja, y es la unica que hace.
create index if not exists envios_bandeja_idx
  on public.envios (destinatario_id, estado)
  where deleted_at is null;

create index if not exists envios_doc_idx
  on public.envios (doc_tipo, doc_id)
  where deleted_at is null;

-- ── Correlativo ────────────────────────────────────────────────────────

create sequence if not exists public.envios_seq;

create or replace function public.envios_next_serial()
returns text
language plpgsql
as $$
declare
  y int := extract(year from current_date)::int;
  n bigint;
begin
  n := nextval('public.envios_seq');
  return 'EN-' || y::text || '-' || lpad(n::text, 4, '0');
end $$;

create or replace function public.envios_set_serial()
returns trigger
language plpgsql
as $$
begin
  if new.serial is null or new.serial = '' then
    new.serial := public.envios_next_serial();
  end if;
  return new;
end $$;

drop trigger if exists envios_set_serial on public.envios;
create trigger envios_set_serial
  before insert on public.envios
  for each row execute function public.envios_set_serial();

drop trigger if exists set_updated_at_envios on public.envios;
create trigger set_updated_at_envios
  before update on public.envios
  for each row execute function public.set_updated_at();

drop trigger if exists audit_envios on public.envios;
create trigger audit_envios
  after insert or update or delete on public.envios
  for each row execute function public.audit_trigger();

-- ── RLS ────────────────────────────────────────────────────────────────
--
-- Esta es la parte que de verdad importa. El destinatario lee LOS SUYOS. No
-- los de otro, no los que el remitente mando a un tercero. Y no escribe nada:
-- su unico acto pasa por `envio_aceptar`, que es `security definer`.

alter table public.envios enable row level security;

drop policy if exists envios_read on public.envios;
create policy envios_read on public.envios for select
  using (
    destinatario_id = auth.uid()
    or public.auth_rol() in ('admin','asistente')
  );

drop policy if exists envios_write on public.envios;
create policy envios_write on public.envios for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- ── El acto de aceptar ─────────────────────────────────────────────────
--
-- `security definer` por la misma razon que el trigger de la fase 43: el
-- destinatario NO DEBE poder escribir la tabla, solo ejecutar un acto
-- concreto y acotado. Las comprobaciones de aqui dentro son la seguridad.
--
-- La cascada no vive aqui. Se busca una funcion llamada
-- `envio_despacho_{doc_tipo}` y se la llama si existe. Asi cada modulo trae
-- la suya sin tocar esta, y un `doc_tipo` que solo necesite acuse de recibo
-- --sin mover nada-- simplemente no define ninguna.
--
-- El nombre se arma a partir de `doc_tipo`, que esta restringido por CHECK: no
-- hay forma de meter ahi algo que no sea uno de los cinco valores.

create or replace function public.envio_aceptar(
  p_envio uuid,
  p_datos jsonb default '{}'::jsonb,
  p_nota  text  default null
)
returns public.envios
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_envio public.envios;
  v_fn    text;
begin
  select * into v_envio
    from public.envios
   where id = p_envio and deleted_at is null
     for update;

  if not found then
    raise exception 'El envio no existe o fue retirado.';
  end if;

  -- Solo el destinatario acepta lo suyo. El admin puede hacerlo en su nombre
  -- --para registrar lo que se resolvio por telefono-- y `audit_log` guarda
  -- quien lo hizo de verdad, porque `resuelto_por` es `auth.uid()`.
  if v_envio.destinatario_id <> auth.uid() and not public.es_admin() then
    raise exception 'Este envio no es suyo.';
  end if;

  if v_envio.estado <> 'enviado' then
    raise exception 'El envio % ya fue %; no se puede aceptar de nuevo.',
      v_envio.serial, v_envio.estado;
  end if;

  update public.envios
     set estado       = 'aceptado',
         resuelto_at  = now(),
         resuelto_por = auth.uid(),
         datos        = coalesce(p_datos, '{}'::jsonb),
         nota         = coalesce(p_nota, nota),
         updated_by   = auth.uid()
   where id = p_envio
  returning * into v_envio;

  v_fn := 'envio_despacho_' || v_envio.doc_tipo;

  if exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn
  ) then
    execute format('select public.%I($1)', v_fn) using v_envio;
  end if;

  return v_envio;
end $$;

comment on function public.envio_aceptar(uuid, jsonb, text) is
  'El destinatario acepta un envio. Despacha a envio_despacho_{doc_tipo} si esa funcion existe. security definer: el destinatario no escribe tablas, solo ejecuta este acto.';

-- Rechazar es el mismo acto con el signo contrario, y NO dispara cascada: un
-- documento rechazado no mueve nada, se devuelve.

create or replace function public.envio_rechazar(
  p_envio uuid,
  p_nota  text default null
)
returns public.envios
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_envio public.envios;
begin
  select * into v_envio
    from public.envios
   where id = p_envio and deleted_at is null
     for update;

  if not found then
    raise exception 'El envio no existe o fue retirado.';
  end if;

  if v_envio.destinatario_id <> auth.uid() and not public.es_admin() then
    raise exception 'Este envio no es suyo.';
  end if;

  if v_envio.estado <> 'enviado' then
    raise exception 'El envio % ya fue %.', v_envio.serial, v_envio.estado;
  end if;

  update public.envios
     set estado       = 'rechazado',
         resuelto_at  = now(),
         resuelto_por = auth.uid(),
         nota         = coalesce(p_nota, nota),
         updated_by   = auth.uid()
   where id = p_envio
  returning * into v_envio;

  return v_envio;
end $$;

comment on function public.envio_rechazar(uuid, text) is
  'El destinatario devuelve un envio sin aceptarlo. No dispara cascada a proposito: lo rechazado no mueve nada.';

-- ── Comprobacion ───────────────────────────────────────────────────────

do $$
declare
  v_falta text := '';
begin
  if not exists (select 1 from pg_class where relname = 'envios' and relnamespace = 'public'::regnamespace) then
    v_falta := v_falta || 'tabla envios; ';
  end if;

  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'envios' and c.relrowsecurity
  ) then
    v_falta := v_falta || 'RLS sin habilitar en envios; ';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'envios') <> 2 then
    v_falta := v_falta || 'envios no tiene sus 2 politicas; ';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('envio_aceptar','envio_rechazar')
     having count(*) = 2
  ) then
    v_falta := v_falta || 'faltan las funciones de aceptar/rechazar; ';
  end if;

  if not exists (
    select 1 from pg_trigger g
      join pg_class c on c.oid = g.tgrelid
     where c.relname = 'envios' and g.tgname = 'audit_envios' and not g.tgisinternal
  ) then
    v_falta := v_falta || 'envios sin trigger de auditoria; ';
  end if;

  if v_falta <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_falta;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

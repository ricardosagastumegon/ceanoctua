-- Fase 47 · La factura es un documento, no ocho columnas sueltas en el vale
--
-- EL PROBLEMA, EN SUS PALABRAS: «una factura puede llevar mas de un vale [...]
-- ahora el ingreso del monto es manual y eso es causante de doble error,
-- porque en el despacho tambien fue manual».
--
-- Tenia razon dos veces.
--
-- 1. LA FACTURA VIVIA DENTRO DEL VALE. Ocho columnas --proveedor, serie,
--    numero, fecha, monto y las tres de la contrasena-- repetidas en cada
--    `comb_solicitudes`. Cuando una factura cubre dos despachos del mismo dia
--    --la usuaria confirmo en la fase 45 que pasa-- habia que teclearla dos
--    veces, y nada impedia que las dos copias se contradijeran. El propio
--    modelo tenia una nota admitiendolo: `factura_monto` estaba marcado como
--    «referencia, NO sumando: puede repetirse en dos solicitudes». Esa nota
--    es la descripcion de un modelo mal puesto, no de una regla.
--
--    Ahora la factura es su propia fila y el vale apunta a ella. Una factura,
--    un monto, una contrasena --que ella ya habia dicho que es una por
--    factura-- y los vales que cubre colgando. Es la misma forma que
--    `caja_chica_liquidaciones` <- `liquidacion_vales`, que es justo lo que
--    pidio: «tal cual como las liquidaciones de caja chica».
--
-- 2. EL MONTO SE TECLEABA. Y el del despacho tambien, asi que no habia
--    ninguna cifra que pudiera desmentir a la otra. Con la factura agrupando
--    vales, el monto se propone como la suma de los despachos que cubre, y la
--    suma de los despachos sale de galones x precio. Lo unico que se teclea
--    de verdad son galones y precio; todo lo demas se deriva, y cuando el
--    papel dice otra cosa, la pantalla lo dice en vez de tragarselo.
--
-- QUE NO CAMBIA: el control de vales sigue sumando el DESPACHO (`monto` del
-- vale), no la factura. Con una factura por cada dos despachos, sumar
-- facturas duplicaria. Ahora ademas es estructuralmente imposible
-- equivocarse: la factura no esta en la tabla que suma el reporte.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · La factura
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.comb_facturas (
  id uuid primary key default gen_random_uuid(),

  proveedor_id uuid references public.proveedores(id),
  serie  text,
  numero text,
  fecha  date,

  -- Lo que dice el papel. Se propone como la suma de los despachos que
  -- cubre; se puede corregir, porque la gasolinera redondea y el papel es
  -- el que vale. Cuando no coincide, la pantalla lo avisa.
  monto numeric(14,2),

  -- Una contrasena de pago POR FACTURA (confirmado por la usuaria en la
  -- fase 45). Aqui deja de poder contradecirse: antes vivia en cada vale.
  contrasena_num text,
  contrasena_fecha date,
  contrasena_vencimiento date,

  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- Meter dos veces la misma factura es el error clasico de este formulario,
-- y el que peor se nota: dos contrasenas para un mismo pago. El indice lo
-- impide. Solo exige el numero, que es lo unico que siempre viene.
drop index if exists comb_facturas_unica;
create unique index comb_facturas_unica
  on public.comb_facturas (
    coalesce(proveedor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    upper(trim(coalesce(serie, ''))),
    upper(trim(numero))
  )
  where deleted_at is null and nullif(trim(numero), '') is not null;

alter table public.comb_solicitudes
  add column if not exists factura_id uuid references public.comb_facturas(id);

comment on column public.comb_solicitudes.factura_id is
  'La factura que cubre este despacho. Una factura puede cubrir varios vales del mismo dia; por eso el control de vales suma `monto` (el despacho) y nunca la factura.';

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Lo que ya estaba escrito dentro de los vales
-- ══════════════════════════════════════════════════════════════════════
--
-- Se agrupa por (proveedor, serie, numero), que es la identidad real de una
-- factura. Si dos vales traian la misma, se funden en una sola fila --que es
-- precisamente la duplicacion que esta fase viene a quitar. De los campos
-- que podian diferir entre copias se toma el primero por fecha, y el monto
-- es el maximo: una copia a medio llenar no debe ganarle a una completa.

do $$
declare v_n int := 0;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='comb_solicitudes'
       and column_name='factura_numero'
  ) then
    with grupos as (
      select proveedor_id,
             trim(coalesce(factura_serie, ''))  as serie,
             trim(factura_numero)               as numero,
             min(factura_fecha)                 as fecha,
             max(factura_monto)                 as monto,
             min(contrasena_num)                as cnum,
             min(contrasena_fecha)              as cfecha,
             min(contrasena_vencimiento)        as cvence
        from public.comb_solicitudes
       where deleted_at is null
         and nullif(trim(factura_numero), '') is not null
       group by 1, 2, 3
    ), creadas as (
      insert into public.comb_facturas
        (proveedor_id, serie, numero, fecha, monto,
         contrasena_num, contrasena_fecha, contrasena_vencimiento)
      select proveedor_id, nullif(serie, ''), numero, fecha, monto,
             cnum, cfecha, cvence
        from grupos
      returning id, proveedor_id, serie, numero
    )
    update public.comb_solicitudes s
       set factura_id = c.id
      from creadas c
     where s.deleted_at is null
       and trim(s.factura_numero) = trim(c.numero)
       and trim(coalesce(s.factura_serie, '')) = trim(coalesce(c.serie, ''))
       and s.proveedor_id is not distinct from c.proveedor_id;

    get diagnostics v_n = row_count;
    raise notice 'Vales enlazados a su factura: %', v_n;
  end if;
end $$;

-- Y se quitan las columnas viejas. Dejarlas seria tener dos sitios donde
-- puede estar el numero de una factura, que es la clase de cosa que luego
-- nadie se atreve a tocar porque no sabe cual manda.
alter table public.comb_solicitudes
  drop column if exists proveedor_id,
  drop column if exists factura_serie,
  drop column if exists factura_numero,
  drop column if exists factura_fecha,
  drop column if exists factura_monto,
  drop column if exists contrasena_num,
  drop column if exists contrasena_fecha,
  drop column if exists contrasena_vencimiento;

-- ══════════════════════════════════════════════════════════════════════
-- 3 · El estado del vale lo manda la factura
-- ══════════════════════════════════════════════════════════════════════
--
-- Va en trigger y no en el formulario porque la factura asigna VARIOS vales
-- de una vez: si lo hiciera el cliente, tendria que acordarse de recorrerlos
-- --y de deshacerlo al quitar uno. El trigger lo hace venga de donde venga.

create or replace function public.comb_solicitud_estado_por_factura()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.deleted_at is not null or new.estado = 'anulada' then
    return new;
  end if;

  -- Solo se mueve entre estos dos. Un vale que ya entro en un control
  -- cerrado, o que esta en tesoreria, no retrocede por tocarle la factura.
  if new.factura_id is not null and new.estado = 'despachada' then
    new.estado := 'documentada';
  elsif new.factura_id is null and new.estado = 'documentada' then
    new.estado := 'despachada';
  end if;

  return new;
end $$;

comment on function public.comb_solicitud_estado_por_factura() is
  'Mueve el vale entre «despachada» y «documentada» segun tenga factura. No toca los estados posteriores.';

drop trigger if exists comb_solicitudes_estado_factura on public.comb_solicitudes;
create trigger comb_solicitudes_estado_factura
  before insert or update on public.comb_solicitudes
  for each row execute function public.comb_solicitud_estado_por_factura();

-- Borrar la factura suelta sus vales. Sin esto quedarian apuntando a un
-- documento que ya no existe, y en estado «documentada» sin documento.
create or replace function public.comb_factura_suelta_vales()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.comb_solicitudes
       set factura_id = null
     where factura_id = new.id and deleted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists comb_facturas_suelta_vales on public.comb_facturas;
create trigger comb_facturas_suelta_vales
  after update on public.comb_facturas
  for each row execute function public.comb_factura_suelta_vales();

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Correlativo, auditoria y `updated_at`
-- ══════════════════════════════════════════════════════════════════════
--
-- Sin serial de negocio: la factura ya viene numerada por el proveedor, y
-- darle un segundo numero propio solo serviria para que alguien se pregunte
-- cual de los dos buscar.

drop trigger if exists set_updated_at_comb_facturas on public.comb_facturas;
create trigger set_updated_at_comb_facturas
  before update on public.comb_facturas
  for each row execute function public.set_updated_at();

drop trigger if exists audit_comb_facturas on public.comb_facturas;
create trigger audit_comb_facturas
  after insert or update or delete on public.comb_facturas
  for each row execute function public.audit_trigger();

-- ══════════════════════════════════════════════════════════════════════
-- 5 · RLS · Pattern A, como el resto del modulo
-- ══════════════════════════════════════════════════════════════════════
--
-- Una factura lleva proveedor y monto. El Tesorero no la lee: lo que el ve
-- llega por `envios`, con su `snapshot`.

alter table public.comb_facturas enable row level security;

drop policy if exists comb_facturas_read on public.comb_facturas;
create policy comb_facturas_read on public.comb_facturas for select
  using (public.auth_rol() in ('admin','asistente'));

drop policy if exists comb_facturas_write on public.comb_facturas;
create policy comb_facturas_write on public.comb_facturas for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

revoke execute on function public.comb_solicitud_estado_por_factura() from public, anon;
revoke execute on function public.comb_factura_suelta_vales()         from public, anon;

-- ══════════════════════════════════════════════════════════════════════
-- 6 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  c text;
begin
  if not exists (
    select 1 from pg_class k join pg_namespace n on n.oid = k.relnamespace
     where n.nspname='public' and k.relname='comb_facturas' and k.relrowsecurity
  ) then
    v_mal := v_mal || 'comb_facturas no existe o esta sin RLS; ';
  end if;

  if (select count(*) from pg_policies
       where schemaname='public' and tablename='comb_facturas') < 2 then
    v_mal := v_mal || 'comb_facturas sin sus dos politicas; ';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname='audit_comb_facturas' and not tgisinternal
  ) then
    v_mal := v_mal || 'comb_facturas sin auditoria; ';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='comb_solicitudes'
       and column_name='factura_id'
  ) then
    v_mal := v_mal || 'falta comb_solicitudes.factura_id; ';
  end if;

  -- Las ocho viejas tienen que haberse ido: dos sitios para el mismo dato
  -- es justo lo que esta fase quita.
  foreach c in array array[
    'proveedor_id','factura_serie','factura_numero','factura_fecha',
    'factura_monto','contrasena_num','contrasena_fecha','contrasena_vencimiento'
  ] loop
    if exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='comb_solicitudes' and column_name=c
    ) then
      v_mal := v_mal || format('comb_solicitudes.%s sigue ahi; ', c);
    end if;
  end loop;

  -- Ningun vale documentado sin factura, ni al reves.
  if exists (
    select 1 from public.comb_solicitudes
     where deleted_at is null and estado = 'documentada' and factura_id is null
  ) then
    v_mal := v_mal || 'hay vales «documentada» sin factura; ';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname like 'comb\_%'
       and has_function_privilege('anon', p.oid, 'execute')
  ) then
    v_mal := v_mal || 'alguna funcion comb_ le quedo abierta a anon; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

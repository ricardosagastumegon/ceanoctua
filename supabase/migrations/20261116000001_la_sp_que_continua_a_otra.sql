-- Fase 60 · La solicitud que continúa a otra
--
-- LO QUE PIDIÓ. «Al crear una SP no tengo dónde colocar la información para
-- rellenar ANTICIPOS PREVIOS. Este pago es el 50% restante de una factura,
-- pero no tengo dónde ingresar el monto del primer anticipo; además, al poner
-- el monto total del proyecto tuve que poner que iba a pagar el 100% de ese
-- monto. Tiene que quedar registro de que hubo un anticipo previo, es más,
-- sería ideal que una SP pudiera encadenarse con otra para cerrarla.»
--
-- SU CASO REAL, que es el que guió el diseño:
--
--   SP-2026-0009  02/11  Q 2,520  Anticipo sin factura  cot 5,040  PAGADO
--   SP-2026-0035  16/11  Q 2,520  Anticipo con factura  cot 5,040  programado
--
-- Las dos existen, con la misma cotización, y suman exactamente el total.
--
-- DOS COSAS ESTABAN MAL, Y LA SEGUNDA NO SE VEÍA:
--
--   1. «Anticipos previos» estaba CLAVADO EN CERO en el imprimible
--      --`const previos = 0`--. No es que faltara el campo: el papel no podía
--      decir otra cosa aunque se capturara.
--
--   2. `pct_anticipo` es un número tecleado que duplica algo que el sistema ya
--      sabe, y YA ESTABA MAL EN 2 DE 14: SP-2026-0007 guarda 0% cuando lo real
--      es 100%, y SP-2026-0035 guarda 100% cuando lo real es 50%. El papel ni
--      lo mira: cuando hay cotización calcula `monto / cotización`. Por eso la
--      hoja imprimió 50% mientras la base decía 100%.
--
-- LA DECISIÓN: ENCADENAR, NO TECLEAR. Una SP puede apuntar a la anterior, y
-- «anticipos previos» es la SUMA de la cadena. Nunca se escribe a mano, así
-- que no puede contradecir a la SP de la que sale. Pedirle que vuelva a
-- teclear Q 2,520 --que ya está en SP-2026-0009-- sería crear la segunda copia
-- que después se separa, que es exactamente lo que le pasó al porcentaje.
--
-- LA COTIZACIÓN NO SE COMPARTE, SE HEREDA. Ella lo advirtió: «un monto
-- cotizado puede variar». Así que cada SP conserva la suya --se propone la de
-- la anterior, pero es editable-- y los porcentajes de los tres renglones
-- salen contra la cotización DE ESA hoja. Es como funciona el formato oficial:
-- «Monto total de compra o proyecto» se declara en cada papel. Si la cadena
-- cambia de cotización, la pantalla lo dice en vez de callarlo.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · El enlace
-- ══════════════════════════════════════════════════════════════════════

alter table public.pagos
  add column if not exists sp_anterior_id uuid references public.pagos(id);

comment on column public.pagos.sp_anterior_id is
  'La solicitud de pago que esta continúa. De aquí sale «anticipos previos»: '
  'la suma de la cadena, calculada, nunca tecleada.';

create index if not exists pagos_sp_anterior_idx
  on public.pagos(sp_anterior_id) where sp_anterior_id is not null;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Que la cadena no se muerda la cola
-- ══════════════════════════════════════════════════════════════════════
-- Sin esto, un A→B→A deja la suma recursiva dando vueltas para siempre. No es
-- un caso rebuscado: basta con corregir un enlace al revés.

create or replace function public.pagos_cadena_sin_ciclos()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_n  int := 0;
begin
  if new.sp_anterior_id is null then
    return new;
  end if;
  if new.sp_anterior_id = new.id then
    raise exception 'Una solicitud no puede continuarse a sí misma.';
  end if;

  v_id := new.sp_anterior_id;
  while v_id is not null and v_n < 50 loop
    if v_id = new.id then
      raise exception
        'Esa cadena se muerde la cola: % ya viene de esta misma solicitud.',
        coalesce(new.serial, 'la solicitud');
    end if;
    select sp_anterior_id into v_id from public.pagos where id = v_id;
    v_n := v_n + 1;
  end loop;

  if v_n >= 50 then
    raise exception 'La cadena de solicitudes es demasiado larga; revisa los enlaces.';
  end if;
  return new;
end $$;

drop trigger if exists pagos_cadena_sin_ciclos on public.pagos;
create trigger pagos_cadena_sin_ciclos
  before insert or update of sp_anterior_id on public.pagos
  for each row execute function public.pagos_cadena_sin_ciclos();

-- ══════════════════════════════════════════════════════════════════════
-- 3 · La cadena, para la hoja y para la pantalla
-- ══════════════════════════════════════════════════════════════════════
-- Devuelve las solicitudes ANTERIORES, de la más reciente a la más vieja. La
-- pantalla las lista y suma sus montos; el papel solo necesita la suma.
--
-- Va gatillada por `puede_ver_pago`: es SECURITY DEFINER para poder recorrer
-- la cadena entera --quien firma no lee `pagos` suelto-- pero no puede volverse
-- una puerta para leer montos ajenos. Quien no puede ver la SP raíz no recibe
-- nada, ni un error que confirme que existe.

create or replace function public.pago_cadena(p_pago uuid)
returns table (
  id       uuid,
  serial   text,
  fecha    date,
  monto    numeric,
  moneda   text,
  status   text,
  cotizacion numeric,
  nivel    int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with recursive cadena as (
    select p.sp_anterior_id as ancestro, 1 as nivel
      from public.pagos p
     where p.id = p_pago
       and public.puede_ver_pago(p_pago)
    union all
    select a.sp_anterior_id, c.nivel + 1
      from cadena c
      join public.pagos a on a.id = c.ancestro
     where c.ancestro is not null
       and c.nivel < 50
  )
  select a.id, a.serial, a.fecha, a.monto, a.moneda::text, a.status::text,
         a.cotizacion, c.nivel
    from cadena c
    join public.pagos a on a.id = c.ancestro
   where a.deleted_at is null
   order by c.nivel;
$$;

comment on function public.pago_cadena(uuid) is
  'Las solicitudes de pago anteriores en la cadena, de la más reciente a la '
  'más vieja. «Anticipos previos» es la suma de sus montos. Solo responde a '
  'quien puede ver la solicitud raíz.';

-- Es una lectura que hace la app con sesión, no un predicado de política:
-- `anon` no entra. (Supabase concede a `authenticated` por omisión; se revoca
-- todo y se concede a mano para no depender de eso.)
revoke execute on function public.pago_cadena(uuid) from public, anon;
grant  execute on function public.pago_cadena(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 4 · El porcentaje deja de ser un dato tecleado
-- ══════════════════════════════════════════════════════════════════════
-- Se pone al día con lo que el papel ya imprime. No cambia nada de lo que se
-- ve --el imprimible calcula `monto / cotización` desde hace fases-- pero deja
-- de haber dos versiones del mismo número, una de las cuales miente.
--
-- La columna se conserva: las SP sin cotización no tienen de dónde calcularlo.

update public.pagos
   set pct_anticipo = round(monto / cotizacion * 100, 2)
 where deleted_at is null
   and cotizacion is not null
   and cotizacion > 0
   and (pct_anticipo is null
        or abs(pct_anticipo - monto / cotizacion * 100) > 0.005);

update public.pagos
   set pct_pendiente = greatest(0, 100 - pct_anticipo)
 where deleted_at is null
   and pct_anticipo is not null
   and (pct_pendiente is null or pct_pendiente is distinct from greatest(0, 100 - pct_anticipo));

-- ══════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_n   int;
  v_a   uuid;
  v_b   uuid;
begin
  -- La columna, el índice y el disparador.
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='pagos' and column_name='sp_anterior_id'
  ) then
    v_mal := v_mal || 'falta sp_anterior_id; ';
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname='pagos' and t.tgname='pagos_cadena_sin_ciclos' and not t.tgisinternal
  ) then
    v_mal := v_mal || 'falta el disparador contra ciclos; ';
  end if;

  -- Permisos de una lectura con sesión: anon no.
  if has_function_privilege('anon', 'public.pago_cadena(uuid)', 'execute') then
    v_mal := v_mal || 'anon puede leer la cadena de pagos; ';
  end if;
  if not has_function_privilege('authenticated', 'public.pago_cadena(uuid)', 'execute') then
    v_mal := v_mal || 'authenticated no puede leer la cadena; ';
  end if;

  -- El candado contra ciclos, PROBADO de verdad y no solo presente: se enlazan
  -- dos solicitudes reales al derecho, se intenta cerrarlo al revés, y se
  -- deshace todo. Un disparador que existe y no salta no sirve de nada.
  select id into v_a from public.pagos where serial = 'SP-2026-0009';
  select id into v_b from public.pagos where serial = 'SP-2026-0035';
  if v_a is not null and v_b is not null then
    update public.pagos set sp_anterior_id = v_a where id = v_b;
    begin
      update public.pagos set sp_anterior_id = v_b where id = v_a;
      v_mal := v_mal || 'EL CANDADO NO SALTO: se pudo cerrar un ciclo; ';
    exception when others then
      v_rep := v_rep || 'el candado contra ciclos salta; ';
    end;
    -- Y la cadena suma lo que debe mientras el enlace existe.
    select coalesce(sum(monto), 0) into v_n from public.pago_cadena(v_b);
    if v_n <> 2520 then
      v_mal := v_mal || format('la cadena de SP-2026-0035 sumo %s y no 2520; ', v_n);
    end if;
    update public.pagos set sp_anterior_id = null where id in (v_a, v_b);
  else
    v_rep := v_rep || 'no estan las dos SP de prueba: candado no medido; ';
  end if;

  -- Ningun porcentaje separado de su monto.
  select count(*) into v_n
    from public.pagos
   where deleted_at is null and cotizacion is not null and cotizacion > 0
     and abs(coalesce(pct_anticipo, -1) - monto / cotizacion * 100) > 0.005;
  if v_n > 0 then
    v_mal := v_mal || format('%s pagos con el %% separado de su monto; ', v_n);
  end if;

  select count(*) into v_n from public.pagos
   where deleted_at is null and sp_anterior_id is not null;
  v_rep := v_rep || format('solicitudes encadenadas hoy: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

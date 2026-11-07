-- Fase 52 · El aceite se mide en litros, y un vale no se registra dos veces
--
-- DOS COSAS que recordo la usuaria probando: «a veces en los vales de
-- combustible despachados a la aeronave, tambien se incluye aceite, entonces
-- tenemos que tener una casilla para aceite, cantidad de litros y precio» y
-- «coloca una regla de alerta por si en algun momento se ingresa un vale que
-- ya haya sido agregado, para no duplicar».
--
-- ══════════════════════════════════════════════════════════════════════
-- 1 · La unidad de cada linea
-- ══════════════════════════════════════════════════════════════════════
--
-- El renglon del aceite ya se podia agregar --`Aceite` esta en la lista de
-- productos desde que se hizo el modulo, y la tabla admite varias lineas.
-- Lo que faltaba es la UNIDAD: la columna de cantidad se llama `galones` y
-- la pantalla pintaba «Aceite 2g». Dos litros no son dos galones, y un
-- renglon que dice lo que no es acaba sumado con los que si.
--
-- NO se renombra la columna. `galones` se queda como esta --la leen el
-- formulario, el imprimible, la seccion y el lector de facturas-- y lo que
-- se agrega es con que se mide. El nombre de la columna pasa a ser historia
-- y la unidad pasa a ser dato; renombrarla tocaria cinco archivos para
-- ganar un nombre mas bonito, y el riesgo no lo paga.

alter table public.avn_combustible_lineas
  add column if not exists unidad text not null default 'gal';

alter table public.avn_combustible_lineas
  drop constraint if exists avn_combustible_lineas_unidad_chk;
alter table public.avn_combustible_lineas
  add constraint avn_combustible_lineas_unidad_chk
  check (unidad in ('gal', 'lt'));

comment on column public.avn_combustible_lineas.galones is
  'La CANTIDAD de la linea. Se llama asi por historia: lo normal es gasolina en galones, pero el aceite va en litros. Con que se mide lo dice `unidad`.';

comment on column public.avn_combustible_lineas.unidad is
  'gal | lt. El aceite del vale va en litros; todo lo demas en galones.';

-- Lo que ya estaba es gasolina en galones, que es el valor por omision. El
-- `update` esta de mas hoy, y por eso no se escribe: una migracion que toca
-- filas sin necesidad es una que hay que revisar sin necesidad.

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Un vale no se registra dos veces
-- ══════════════════════════════════════════════════════════════════════
--
-- POR QUE NO UN INDICE UNICO, que seria lo primero que uno piensa: ella
-- pidio una ALERTA, no un cerrojo. Y tiene razon aunque no lo dijera asi --el
-- numero del vale viene de un talonario del proveedor, y los talonarios se
-- reinician por serie: `RF2 044903` y otra serie con el mismo numero son dos
-- vales distintos. Un indice unico los rechazaria, y el dia que pasara no
-- habria forma de seguir trabajando.
--
-- Asi que la base DETECTA y la pantalla avisa. La funcion devuelve los
-- registros que ya traen ese vale, con lo justo para reconocerlos: cual es,
-- de cuando y por cuanto. Vive en la base y no en el cliente porque la
-- pregunta es «existe en alguna parte», y el cliente solo tiene cargada la
-- aeronave que esta mirando --el mismo vale pegado a otra aeronave es
-- exactamente el caso que hay que cazar.

create or replace function public.avn_vale_repetido(p_vale text, p_excluir uuid default null)
returns table (
  id        uuid,
  serial    text,
  fecha     date,
  total     numeric,
  matricula text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id, r.serial, r.fecha, r.total, a.matricula
    from public.avn_combustible_registros r
    left join public.avn_aeronaves a on a.id = r.aeronave_id
   where r.deleted_at is null
     and r.cancelado_en is null
     and nullif(trim(p_vale), '') is not null
     -- Sin distinguir mayusculas ni ceros de relleno: «044903» y «44903»
     -- son el mismo vale escrito por dos personas distintas.
     and ltrim(upper(trim(r.vale)), '0') = ltrim(upper(trim(p_vale)), '0')
     and (p_excluir is null or r.id <> p_excluir)
   order by r.fecha desc;
$$;

comment on function public.avn_vale_repetido(text, uuid) is
  'Los registros vivos que ya traen ese numero de vale. Compara sin mayusculas ni ceros de relleno. Avisa, no impide: los talonarios se reinician por serie.';

revoke execute on function public.avn_vale_repetido(text, uuid) from public, anon;
grant  execute on function public.avn_vale_repetido(text, uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal  text := '';
  v_n    int;
  v_vale text;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='avn_combustible_lineas'
       and column_name='unidad'
  ) then
    v_mal := v_mal || 'falta la unidad de la linea; ';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.avn_combustible_lineas'::regclass
       and conname = 'avn_combustible_lineas_unidad_chk'
  ) then
    v_mal := v_mal || 'la unidad admite cualquier cosa; ';
  end if;

  if has_function_privilege('anon', 'public.avn_vale_repetido(text, uuid)', 'execute') then
    v_mal := v_mal || 'anon puede consultar los vales; ';
  end if;

  -- Que de verdad encuentre uno que existe, y que no invente con uno que no.
  select vale into v_vale from public.avn_combustible_registros
   where deleted_at is null and nullif(trim(vale),'') is not null limit 1;

  if v_vale is not null then
    select count(*) into v_n from public.avn_vale_repetido(v_vale);
    if v_n = 0 then
      v_mal := v_mal || format('no encuentra el vale %s, que si existe; ', v_vale);
    end if;

    -- Y con ceros de relleno delante tiene que seguir encontrandolo.
    select count(*) into v_n from public.avn_vale_repetido('00' || v_vale);
    if v_n = 0 then
      v_mal := v_mal || 'no reconoce el mismo vale escrito con ceros delante; ';
    end if;

    -- Excluyendose a si mismo, no se delata.
    select count(*) into v_n from public.avn_vale_repetido(
      v_vale,
      (select id from public.avn_combustible_registros
        where deleted_at is null and ltrim(upper(trim(vale)),'0') = ltrim(upper(trim(v_vale)),'0')
        limit 1));
    if v_n <> 0 then
      v_mal := v_mal || 'un registro se denuncia a si mismo como repetido; ';
    end if;
  end if;

  select count(*) into v_n from public.avn_vale_repetido('NO-EXISTE-ESTE-VALE-9999');
  if v_n <> 0 then
    v_mal := v_mal || 'encuentra vales que no existen; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

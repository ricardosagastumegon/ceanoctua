-- Fase 59 · La vista no puede pedir lo que el tesorero no puede ver
--
-- ERROR MIO, Y GRAVE. La migracion 20261110000005 creo `envios_vivos` para que
-- un envio no sobreviva a su documento, y la dejo `security_invoker = true`
-- --lo correcto para que las filas de `envios` sigan obedeciendo su RLS--.
--
-- Pero `security_invoker` no afecta solo a las filas: TODO lo que la vista
-- lee corre con los permisos de quien mira. Y la vista comprueba que el
-- documento exista leyendo su tabla:
--
--     when 'comb_solicitud' then exists (select 1 from comb_solicitudes ...)
--
-- Las dos politicas no dicen lo mismo:
--
--   envios_read           destinatario_id = auth.uid() OR rol in (admin, asistente)
--   comb_solicitudes_read                               rol in (admin, asistente)
--
-- Victor es `tesoreria`: puede leer SUS envios y no puede leer las
-- solicitudes. Asi que el `exists` le daba falso para todo y la vista le
-- devolvia CERO FILAS. Le vacie el tablero --«ahora a Victor no le aparece ni
-- uno»-- sin un solo error en pantalla.
--
-- Y es del tipo peor: no revienta, deja de encontrar. La cuarta de esta forma
-- en la misma fase, y esta la escribi yo sabiendolo.
--
-- LO QUE NO VI AL ESCRIBIRLA: probe la vista con el PAT, que es superusuario
-- y ve todas las tablas. Una comprobacion que corre con mas permisos que la
-- persona real no comprueba el caso que importa.
--
-- EL ARREGLO es el patron que este proyecto ya usa en `pago_del_documento`:
-- la pregunta «existe el documento» va en una funcion SECURITY DEFINER, que
-- la contesta sin pedirle permisos a quien mira. La vista sigue
-- `security_invoker`, asi que las filas de `envios` siguen filtrandose por su
-- RLS --cada quien ve las suyas-- pero el predicado ya no depende de a que
-- tablas llegue.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · La pregunta, contestada por quien si puede
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.envio_documento_vive(p_tipo text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case p_tipo
    when 'comb_solicitud'  then exists (select 1 from public.comb_solicitudes         d where d.id = p_id and d.deleted_at is null)
    when 'comb_reporte'    then exists (select 1 from public.comb_reportes            d where d.id = p_id and d.deleted_at is null)
    when 'pago'            then exists (select 1 from public.pagos                    d where d.id = p_id and d.deleted_at is null)
    when 'cc_vale'         then exists (select 1 from public.caja_chica_vales         d where d.id = p_id and d.deleted_at is null)
    when 'cc_liquidacion'  then exists (select 1 from public.caja_chica_liquidaciones d where d.id = p_id and d.deleted_at is null)
    when 'avn_liquidacion' then exists (select 1 from public.avn_liquidaciones        d where d.id = p_id and d.deleted_at is null)
    -- Un tipo que no conocemos no se esconde: se deja ver y ya se mirara.
    else true
  end;
$$;

comment on function public.envio_documento_vive(text, uuid) is
  'Si el documento de origen de un envio sigue existiendo. SECURITY DEFINER a '
  'proposito: quien recibe un envio --tesoreria-- no puede leer las tablas de '
  'origen, y preguntarselo a el devolvia falso para todo.';

-- OJO: `anon` TAMBIEN. Se usa como predicado dentro de una vista que lee
-- cualquiera con sesion; si anon no puede ejecutarla, la consulta devuelve
-- 401 en vez de cero filas. Esto ya se rompio en las fases 54, 57 y 58.
revoke execute on function public.envio_documento_vive(text, uuid) from public;
grant  execute on function public.envio_documento_vive(text, uuid) to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · La vista, que ya no lee lo que no le toca
-- ══════════════════════════════════════════════════════════════════════

create or replace view public.envios_vivos as
  select e.*
    from public.envios e
   where e.deleted_at is null
     and public.envio_documento_vive(e.doc_tipo, e.doc_id);

comment on view public.envios_vivos is
  'Los envios cuyo documento de origen sigue existiendo. Un envio es la sombra '
  'de un documento: si el documento se borra, su sombra se va con el. Las filas '
  'obedecen la RLS de `envios` (security_invoker); la existencia del documento '
  'la contesta una funcion definer, porque quien recibe no lee esas tablas.';

alter view public.envios_vivos set (security_invoker = true);
grant select on public.envios_vivos to anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion · MIRANDO CON LOS OJOS DE CADA UNO
-- ══════════════════════════════════════════════════════════════════════
-- Lo que fallo la vez pasada fue comprobar con el PAT, que lo ve todo. Aqui
-- se asume el rol `authenticated` y la identidad de cada persona, que es la
-- unica forma de ver lo que ella ve.

do $$
declare
  v_mal      text := '';
  v_rep      text := '';
  v_victor   uuid;
  v_angeles  uuid;
  v_n_envios int;
  v_n_vista  int;
  v_total    int;
begin
  select id into v_victor  from public.usuarios where rol = 'tesoreria' limit 1;
  select id into v_angeles from public.usuarios where rol = 'admin'     limit 1;

  select count(*) into v_total from public.envios where deleted_at is null;

  -- ── Como Victor ────────────────────────────────────────────────────
  if v_victor is not null then
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_victor, 'role', 'authenticated')::text, true);

    select count(*) into v_n_envios from public.envios;
    select count(*) into v_n_vista  from public.envios_vivos;

    reset role;
    perform set_config('request.jwt.claims', null, true);

    v_rep := v_rep || format('Victor ve %s en envios y %s en la vista; ',
                             v_n_envios, v_n_vista);
    -- Lo que se rompio: la vista le devolvia 0 teniendo envios.
    if v_n_envios > 0 and v_n_vista = 0 then
      v_mal := v_mal || 'LA VISTA LE VACIA EL TABLERO AL TESORERO; ';
    end if;
    if v_n_vista > v_n_envios then
      v_mal := v_mal || 'la vista le muestra al tesorero mas de lo que su RLS permite; ';
    end if;
    if v_n_envios = 0 then
      v_rep := v_rep || '(no tiene envios, no se pudo medir lo que importa); ';
    end if;
  end if;

  -- ── Como la administradora: sigue viendolo todo ────────────────────
  if v_angeles is not null then
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_angeles, 'role', 'authenticated')::text, true);

    select count(*) into v_n_vista from public.envios_vivos;

    reset role;
    perform set_config('request.jwt.claims', null, true);

    v_rep := v_rep || format('la administradora ve %s de %s vivos; ', v_n_vista, v_total);
    if v_n_vista <> v_total then
      v_mal := v_mal || format(
        'la administradora dejo de ver %s envios que siguen en pie; ',
        v_total - v_n_vista);
    end if;
  end if;

  -- ── Y que la vista siga cumpliendo su proposito ────────────────────
  if exists (
    select 1 from public.envios e
     where e.deleted_at is null
       and not public.envio_documento_vive(e.doc_tipo, e.doc_id)
       and exists (select 1 from public.envios_vivos v where v.id = e.id)
  ) then
    v_mal := v_mal || 'la vista dejo pasar un envio sin documento; ';
  end if;

  -- ── Permisos del predicado: anon TIENE que poder ───────────────────
  if not has_function_privilege('anon', 'public.envio_documento_vive(text, uuid)', 'execute') then
    v_mal := v_mal || 'anon no puede ejecutar el predicado (daria 401, no lista vacia); ';
  end if;

  -- ── Y que la vista no se haya vuelto definer por el camino ─────────
  if not exists (
    select 1 from pg_class c
     where c.relname = 'envios_vivos' and c.relnamespace = 'public'::regnamespace
       and 'security_invoker=true' = any(c.reloptions)
  ) then
    v_mal := v_mal || 'envios_vivos dejo de ser security_invoker: se saltaria la RLS; ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

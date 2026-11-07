-- Fase 53 · Firma quien es firmante, no quien tiene el modulo
--
-- «NO me aparece la opcion de enviar a firma a Javier, debe de aparecerme».
--
-- La lista salia de `firmantes()`, que devolvia a quien tiene `cea:editor`.
-- Eso nunca fue la definicion de firmante: fue un atajo que funciono
-- mientras la unica que firmaba era Lissa, que ademas opera CEA. Javier
-- firma las solicitudes de combustible de aeronaves y no tiene --ni debe
-- tener-- la operacion diaria de CEA.
--
-- Y HABIA UN SEGUNDO PROBLEMA, mas callado: aunque se le hubiera listado, NO
-- HABRIA PODIDO FIRMAR. `firmas_write` tambien pide `cea:editor`, asi que el
-- boton de firmar le habria dado un error de permisos despues de pedirle que
-- firmara. Arreglar solo la lista habria movido el fallo mas adelante, que es
-- peor que dejarlo donde estaba.
--
-- LA DEFINICION BUENA YA EXISTIA: `personas.es_firmante`. Es la invariante 4
-- de CLAUDE.md --Personal JD es la UNICA fuente de autorizadores y
-- firmantes-- y estaba ahi sin usarse para esto. Los tres que firman
-- (Angeles, Lissa, Javier) ya estan marcados y ligados a su usuario; Victor
-- no lo esta, que es lo correcto.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Quien firma
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.es_firmante(p_usuario uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.usuarios u
      join public.personas p on p.id = u.persona_id
     where u.id = coalesce(p_usuario, auth.uid())
       and u.activo
       and p.es_firmante
  );
$$;

comment on function public.es_firmante(uuid) is
  'Si ese usuario esta ligado a una persona de Personal JD marcada como firmante. Invariante 4: `personas` es la unica fuente.';

revoke execute on function public.es_firmante(uuid) from public, anon;
grant  execute on function public.es_firmante(uuid) to authenticated;

create or replace function public.firmantes()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select u.id, u.nombre
    from public.usuarios u
   where u.activo
     and (u.rol = 'admin' or public.es_firmante(u.id))
   order by u.nombre;
$$;

comment on function public.firmantes() is
  'A quien se le puede pedir una firma: los marcados como firmantes en Personal JD, mas el administrador.';

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Y poder firmar, sin heredar todo CEA
-- ══════════════════════════════════════════════════════════════════════
--
-- Firmar es UN acto sobre UNA fila: poner el estado, la fecha y quien. No es
-- «escribir en firmas», que ademas incluye crear solicitudes y borrarlas.
--
-- Por eso va en una funcion y no en una politica mas amplia. Si se le
-- concediera `update` sobre la tabla, un firmante podria cambiar el
-- `firmada_por` a otro nombre; aqui no puede, porque el nombre lo pone la
-- funcion con `auth.uid()` y no se recibe de fuera.

create or replace function public.firma_firmar(p_firma uuid)
returns public.firmas
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_f public.firmas;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesion.';
  end if;

  -- Quien opera CEA sigue pudiendo, como hasta ahora; y ademas, cualquiera
  -- marcado como firmante en Personal JD.
  if not (public.puede('cea', 'editor') or public.es_firmante()) then
    raise exception 'No estas marcado como firmante en Personal JD.';
  end if;

  select * into v_f from public.firmas
   where id = p_firma and deleted_at is null for update;
  if not found then
    raise exception 'Esa solicitud de firma no existe.';
  end if;
  if v_f.status_firma = 'firmado' then
    -- No es un error: dos clics seguidos no deben asustar a nadie.
    return v_f;
  end if;

  update public.firmas
     set status_firma = 'firmado',
         fecha_firma  = current_date,
         firmada_por  = auth.uid()
   where id = p_firma
  returning * into v_f;

  return v_f;
end $$;

comment on function public.firma_firmar(uuid) is
  'Firmar una solicitud. Solo pone estado, fecha y quien --y el quien sale de la sesion, no del cliente.';

revoke execute on function public.firma_firmar(uuid) from public, anon;
grant  execute on function public.firma_firmar(uuid) to authenticated;

-- Y que el firmante pueda VER lo que tiene que firmar aunque no opere CEA.
-- Hoy Javier entra por `finanzas:observador`, pero eso es una casualidad de
-- como quedo su perfil: lo que le da derecho a ver una firma es que sea
-- firmante.
drop policy if exists firmas_read on public.firmas;
create policy firmas_read on public.firmas for select
  using (
    public.puede('cea', 'observador')
    or public.puede('finanzas', 'observador')
    or public.es_firmante()
  );

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_u    record;
  v_n    int;
  v_rep  text := '';
  v_mal  text := '';
begin
  for v_u in
    select id, email,
           case when email = 'jarriaza@sion.com.gt' then 'javier'
                when email = 'larriaza@sion.com.gt' then 'lissa'
                when email = 'vmurillo@sion.com.gt' then 'victor'
                when rol = 'admin' then 'angeles' else 'otro' end as quien
      from public.usuarios where activo
  loop
    if v_u.quien = 'otro' then continue; end if;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u.id::text, 'role','authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_n from public.firmantes();
    v_rep := v_rep || format('%s.ve-firmantes=%s ', v_u.quien, v_n);

    perform set_config('role', 'postgres', true);
  end loop;

  perform set_config('request.jwt.claims', '', true);

  -- Los tres que firman tienen que estar en la lista, y Victor no.
  select count(*) into v_n from public.firmantes();
  v_rep := v_rep || format('total=%s ', v_n);
  if v_n <> 3 then
    v_mal := v_mal || format('la lista trae %s y tenian que ser 3 (Angeles, Lissa, Javier); ', v_n);
  end if;

  if not exists (select 1 from public.firmantes() f
                  join public.usuarios u on u.id = f.id
                 where u.email = 'jarriaza@sion.com.gt') then
    v_mal := v_mal || 'Javier sigue sin aparecer; ';
  end if;
  if exists (select 1 from public.firmantes() f
              join public.usuarios u on u.id = f.id
             where u.email = 'vmurillo@sion.com.gt') then
    v_mal := v_mal || 'Victor aparece y no firma; ';
  end if;

  -- Y que de verdad pueda firmar, que era el segundo problema.
  if not public.es_firmante((select id from public.usuarios where email='jarriaza@sion.com.gt')) then
    v_mal := v_mal || 'Javier no cuenta como firmante; ';
  end if;
  if public.es_firmante((select id from public.usuarios where email='vmurillo@sion.com.gt')) then
    v_mal := v_mal || 'Victor cuenta como firmante; ';
  end if;

  if has_function_privilege('anon', 'public.firma_firmar(uuid)', 'execute') then
    v_mal := v_mal || 'anon puede firmar; ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

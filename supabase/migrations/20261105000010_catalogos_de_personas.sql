-- Fase 45 · Los catalogos de personas, y el ultimo resto de contenido
--
-- Lo que quedaba despues de 000009, medido con el barrido de las 104 tablas:
--
--   personas=10        NIT y direccion de Personal JD
--   empleados=35       correo y telefono de la planilla
--   invitados=12
--   directorio=5
--   miel_constancias=1  <- contenido de un modulo, no catalogo. Se me paso
--                          clasificarlo en la tanda anterior.
--
-- Los demas que ve --tipos_pago, status_solicitud_pago, entidades,
-- proveedores, miembros_board, vehiculos, avn_tipos_certificado,
-- comb_responsables-- son LISTAS DE VALORES y se quedan como estan: son para
-- eso. Y `usuarios` / `usuario_modulos` le muestran SOLO SU PROPIA FILA, que
-- es lo correcto.
--
--
-- DONDE ESTA LA LINEA
--
-- Se miro quien consume estos catalogos de verdad, siguiendo los hooks y no
-- la tabla: `usePersonas`, `useEmpleados` e `useInvitados` se usan desde
-- admin, cea, finanzas, caja_chica, tt y combustible. O sea, desde TODOS los
-- modulos operativos.
--
-- Todos menos uno: `tesoreria`. Su pantalla lee `envios` y nada mas --el
-- `snapshot` del envio ya trae el nombre de quien autoriza, precisamente para
-- no tener que darle el catalogo entero. Esa es la linea, y no hace falta
-- inventarla.
--
-- La condicion va en una funcion y no repetida en dos politicas para que, al
-- añadir un modulo, haya UN solo sitio que corregir. Repetirla es como se
-- quedaron desincronizadas las reglas que esta fase lleva todo el dia
-- cerrando.

create or replace function public.usa_catalogos_de_personas()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.puede('admin', 'observador')
      or public.puede('cea', 'observador')
      or public.puede('finanzas', 'observador')
      or public.puede('caja_chica', 'observador')
      or public.puede('tt', 'observador')
      or public.puede('combustible', 'observador');
$$;

comment on function public.usa_catalogos_de_personas() is
  'Quien trabaja con Personal JD y empleados: todos los modulos operativos. Tesoreria no, porque su bandeja se basta con el snapshot del envio.';

revoke execute on function public.usa_catalogos_de_personas() from public, anon;
grant  execute on function public.usa_catalogos_de_personas() to authenticated;

-- ── Personal JD y la planilla ──────────────────────────────────────────

drop policy if exists personas_read on public.personas;
create policy personas_read on public.personas for select
  using (public.usa_catalogos_de_personas());

drop policy if exists empleados_read on public.empleados;
create policy empleados_read on public.empleados for select
  using (public.usa_catalogos_de_personas());

-- ── Invitados · solo viajes y admin los usan ───────────────────────────

drop policy if exists invitados_read on public.invitados;
create policy invitados_read on public.invitados for select
  using (
    public.puede('tt', 'observador')
    or public.puede('admin', 'observador')
  );

-- ── Directorio · es una seccion de CEA ─────────────────────────────────

drop policy if exists directorio_read on public.directorio;
create policy directorio_read on public.directorio for select
  using (public.puede('cea', 'observador'));

-- ── Las constancias de Miel SJ ─────────────────────────────────────────
--
-- Contenido de un modulo, no catalogo: una constancia de donacion lleva
-- nombre y monto. Se le escapo a la tanda anterior.

drop policy if exists miel_constancias_read on public.miel_constancias;
create policy miel_constancias_read on public.miel_constancias for select
  using (public.puede('miel_sj', 'observador'));

-- ── Comprobacion ───────────────────────────────────────────────────────

do $$
declare
  v_tablas text[] := array[
    'personas', 'empleados', 'invitados', 'directorio', 'miel_constancias'
  ];
  v_u   record;
  v_t   text;
  v_n   bigint;
  v_rep text := '';
  v_mal text := '';
begin
  for v_u in
    select id,
           case when rol = 'admin' then 'angeles'
                when email = 'larriaza@sion.com.gt' then 'lissa'
                when email = 'vmurillo@sion.com.gt' then 'victor'
                else 'otro' end as quien
      from public.usuarios where activo
  loop
    if v_u.quien = 'otro' then continue; end if;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u.id::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    foreach v_t in array v_tablas loop
      begin
        execute format('select count(*) from public.%I', v_t) into v_n;
      exception when others then
        v_n := -1;
      end;
      v_rep := v_rep || format('%s.%s=%s ', v_u.quien, v_t, v_n);

      if v_u.quien = 'victor' and v_n > 0 then
        v_mal := v_mal || format('Victor sigue viendo %s (%s); ', v_t, v_n);
      end if;
    end loop;

    perform set_config('role', 'postgres', true);
  end loop;

  -- Lissa tiene cea, finanzas y tt: conserva personas, empleados, invitados y
  -- directorio. Miel SJ no lo tiene, asi que ahi el cero es lo correcto.
  if v_rep not like '%lissa.personas=10%' then
    v_mal := v_mal || 'Lissa perdio personas; ';
  end if;
  if v_rep not like '%lissa.empleados=35%' then
    v_mal := v_mal || 'Lissa perdio empleados; ';
  end if;
  if v_rep not like '%angeles.personas=10%' then
    v_mal := v_mal || 'Angeles perdio personas; ';
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;

  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

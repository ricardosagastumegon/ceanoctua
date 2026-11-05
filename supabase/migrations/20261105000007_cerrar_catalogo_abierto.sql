-- Fase 45 · Cerrar las dos tablas que cualquiera con sesion podia leer
--
-- Al crear el usuario del Tesorero se comprobo, con su sesion real y el rol
-- `authenticated`, que de once tablas probadas nueve le decian que no y DOS
-- le decian que si:
--
--   firmas = 9 filas        tarjetas_credito = 12 filas
--
-- Las dos usaban `auth.uid() IS NOT NULL`: el patron «catalogo abierto» que
-- la documentacion de revision externa ya señalaba (§5.3). Hasta hoy daba
-- igual, porque las dos unicas cuentas eran la de la asistente y la de quien
-- firma. Deja de dar igual en cuanto entra alguien de quien la dueña dijo
-- expresamente «no tendria porque ver lo que yo tenga».
--
-- MAGNITUD, para que quede escrito y no se exagere luego: no se podia mover
-- dinero con esto. `tarjetas_credito` NO guarda numeros de tarjeta --se
-- verifico la forma del dato, ninguna columna coincide con un PAN de 13-19
-- digitos-- ni codigos ni vencimientos. Lo que se filtraba era titular,
-- banco, NIT (4 de 12), limite (3 de 12) y direccion (3 de 12). Y `firmas` no
-- tiene columna de monto: se filtraba que documento paso a firma, su tipo,
-- una justificacion de 74 caracteres como maximo y quien firmo cuando.
-- Era confidencialidad, no fraude. Pero la regla del producto es que cada
-- quien vea lo suyo, y dos tablas fuera de la regla convierten la regla en
-- una intencion.
--
--
-- A QUE SE ACOTA, Y POR QUE A ESO
--
-- No se invento un criterio: se miro quien las lee de verdad en el codigo.
--
--   firmas            -> modules/cea/firmas/*  y  modules/finanzas/pagos/*
--   tarjetas_credito  -> modules/admin/*       y  modules/arriaza/* (T&T)
--
-- Asi que firmas pide CEA o Finanzas, y las tarjetas piden Finanzas o T&T.
-- `puede()` devuelve verdadero para el administrador por definicion, asi que
-- la dueña no pierde nada.
--
-- EFECTO COMPROBADO ANTES DE APLICAR:
--   Angeles (admin)                        -> sigue viendo las dos
--   Lissa   (cea:editor, tt:observador)    -> sigue viendo las dos
--   Victor  (solo tesoreria:editor)        -> deja de ver las dos

-- ── firmas ─────────────────────────────────────────────────────────────
--
-- Se lee desde dos modulos y por una razon distinta en cada uno: en CEA es la
-- bandeja de firmas; en Finanzas es para saber si una solicitud de pago ya se
-- firmo. Las dos son legitimas, asi que las dos entran.

drop policy if exists firmas_read on public.firmas;
create policy firmas_read on public.firmas for select
  using (
    public.puede('cea', 'observador')
    or public.puede('finanzas', 'observador')
  );

-- ── tarjetas_credito ───────────────────────────────────────────────────
--
-- Ya existia `tarjetas_credito_read_tt` con `puede('tt','observador')`, que
-- se queda igual: los viajes necesitan saber con que tarjeta se pago. Lo que
-- se cambia es la otra, que estaba abierta de par en par.

drop policy if exists tarjetas_credito_read on public.tarjetas_credito;
create policy tarjetas_credito_read on public.tarjetas_credito for select
  using (public.puede('finanzas', 'observador'));

-- ── Comprobacion ───────────────────────────────────────────────────────
--
-- No basta con que la politica quede escrita: hay que probarla con las
-- sesiones de verdad. Y hace falta `set local role authenticated`, porque sin
-- eso la consulta corre como superusuario, RLS ni se aplica y la prueba da
-- verde siempre sin probar nada.

do $$
declare
  v_angeles uuid;
  v_lissa   uuid;
  v_victor  uuid;
  v_n       bigint;
  v_mal     text := '';
  v_rep     text := '';
begin
  select id into v_angeles from public.usuarios where rol = 'admin' limit 1;
  select id into v_lissa   from public.usuarios where email = 'larriaza@sion.com.gt';
  select id into v_victor  from public.usuarios where email = 'vmurillo@sion.com.gt';

  -- Angeles: tiene que seguir viendo las dos.
  if v_angeles is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_angeles::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_n from public.firmas;
    v_rep := v_rep || format('angeles.firmas=%s ', v_n);
    if v_n = 0 then v_mal := v_mal || 'Angeles perdio firmas; '; end if;

    select count(*) into v_n from public.tarjetas_credito;
    v_rep := v_rep || format('angeles.tarjetas=%s ', v_n);
    if v_n = 0 then v_mal := v_mal || 'Angeles perdio tarjetas; '; end if;

    perform set_config('role', 'postgres', true);
  end if;

  -- Lissa: tiene que seguir viendo las dos. Si la pierde, se queda sin su
  -- bandeja de firmas, que es para lo que entra.
  if v_lissa is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_lissa::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_n from public.firmas;
    v_rep := v_rep || format('lissa.firmas=%s ', v_n);
    if v_n = 0 then v_mal := v_mal || 'LISSA SE QUEDO SIN SU BANDEJA DE FIRMAS; '; end if;

    select count(*) into v_n from public.tarjetas_credito;
    v_rep := v_rep || format('lissa.tarjetas=%s ', v_n);

    perform set_config('role', 'postgres', true);
  end if;

  -- Victor: tiene que dejar de verlas. Es el punto de toda la migracion.
  if v_victor is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_victor::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_n from public.firmas;
    v_rep := v_rep || format('victor.firmas=%s ', v_n);
    if v_n > 0 then v_mal := v_mal || format('Victor SIGUE viendo %s firmas; ', v_n); end if;

    select count(*) into v_n from public.tarjetas_credito;
    v_rep := v_rep || format('victor.tarjetas=%s ', v_n);
    if v_n > 0 then v_mal := v_mal || format('Victor SIGUE viendo %s tarjetas; ', v_n); end if;

    perform set_config('role', 'postgres', true);
  end if;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || lecturas: %', v_mal, v_rep;
  end if;

  raise notice 'Cerrado correctamente || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

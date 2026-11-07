-- Fase 54 · Quien firma ve las suyas, no todas
--
-- «Tanto Lissa como Javier tienen acceso full a mi modulo de finanzas.
-- Considero que esta bien que tengan acceso a ver los SP y sus estatus,
-- peeero creo que solo deberian de ver los SP en las que ellos sean
-- firmantes, no TODAS».
--
-- La pieza ya estaba: `firmas.asignada_a` guarda a quien se le mando, y
-- `firmas.firmada_por` quien la firmo. Lo que no estaba era usarla para
-- decidir que se ve. `pagos_select` dejaba pasar al rol `solo_lectura`
-- entero, que es como se escribio cuando la unica de solo lectura era quien
-- firmaba todo.
--
-- Y HAY DOS PUERTAS LATERALES, que es la leccion del catalogo de tarjetas de
-- esta misma semana: apretar una sola politica no cierra nada y encima
-- parece hecho.
--
--   · `pagos_notificaciones` lo abria `finanzas:observador`, y ahi va el
--     monto y el resumen de cada aviso --incluidos los de caja chica, con
--     sus correlativos. Se habrian seguido viendo todos.
--   · `firmas` lo abria `es_firmante()`, que puse ayer para que Javier
--     pudiera ver lo suyo y resulto demasiado ancho: le enseñaba tambien las
--     solicitudes de firma de documentos de CEA, que no son suyas.
--
-- LA REGLA, en una frase: se ve la solicitud de pago que uno firma o firmo.
-- Lo demas de Finanzas --notificaciones, firmas ajenas-- se ve solo si se
-- opera Finanzas o CEA.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · «Esta solicitud la firmo yo»
-- ══════════════════════════════════════════════════════════════════════
--
-- `security definer` porque por dentro mira `firmas`, cuya lectura esta a su
-- vez acotada: si fuera invoker se morderia la cola --para saber si puedo ver
-- el pago tendria que poder ver la firma, y viceversa. Lo que devuelve es un
-- si o un no sobre MI PROPIA sesion, asi que no enseña nada de nadie.

create or replace function public.firma_mia_del_pago(p_pago uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.firmas f
     where f.pago_id = p_pago
       and f.deleted_at is null
       and (f.asignada_a = auth.uid() or f.firmada_por = auth.uid())
  );
$$;

comment on function public.firma_mia_del_pago(uuid) is
  'Si a la sesion se le pidio firmar esa solicitud de pago, o ya la firmo. Sigue valiendo despues de firmada: quien firmo tiene derecho a ver en que quedo.';

revoke execute on function public.firma_mia_del_pago(uuid) from public, anon;
grant  execute on function public.firma_mia_del_pago(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Las solicitudes de pago
-- ══════════════════════════════════════════════════════════════════════

drop policy if exists pagos_select on public.pagos;
create policy pagos_select on public.pagos for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.firma_mia_del_pago(id)
  );

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Los avisos · puerta lateral uno
-- ══════════════════════════════════════════════════════════════════════
--
-- El imprimible oficial lista con ellos las liquidaciones que cubre la
-- solicitud, asi que quien firma TIENE que ver los de la suya --si no, la
-- hoja que firma sale con un bloque en blanco. Pero solo los de la suya.
--
-- El `exists` sobre `pagos` vuelve a pasar por la politica de arriba, asi
-- que no hay una segunda copia del criterio: hay una sola, consultada dos
-- veces. Un aviso que todavia no se convirtio en solicitud no lo ve nadie
-- mas que quien opera, que es lo correcto: es su bandeja de trabajo.

drop policy if exists pagos_notif_read on public.pagos_notificaciones;
create policy pagos_notif_read on public.pagos_notificaciones for select
  using (
    public.auth_rol() in ('admin','asistente')
    or public.puede('finanzas', 'editor')
    or exists (
      select 1 from public.pagos p
       where p.deleted_at is null
         and (p.origen_notificacion_id = pagos_notificaciones.id
              or p.id = pagos_notificaciones.pago_id)
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Las firmas · puerta lateral dos
-- ══════════════════════════════════════════════════════════════════════
--
-- Ayer se abrio a `es_firmante()` para que Javier viera lo suyo, y quedo
-- demasiado ancho: le enseñaba todas, tambien las de documentos de CEA que
-- no tienen nada que ver con el. Se acota a las suyas.
--
-- Se quita tambien `finanzas:observador`: estaba para pintar el distintivo
-- de firma en la lista de pagos, y quien opera Finanzas hoy es el admin, que
-- pasa igual. Quien opera CEA --que es de quien son las firmas-- sigue
-- viendolas todas.

drop policy if exists firmas_read on public.firmas;
create policy firmas_read on public.firmas for select
  using (
    public.puede('cea', 'observador')
    or public.puede('finanzas', 'editor')
    or asignada_a = auth.uid()
    or firmada_por = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════════════
-- 5 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════
--
-- Las dos mitades importan. Que vean menos, y que NO pierdan lo que firman:
-- una politica apretada de mas deja la pantalla vacia sin dar error, y eso
-- no se nota hasta que alguien tiene que firmar algo.

do $$
declare
  v_u      record;
  v_n      bigint;
  v_suyas  int;
  v_rep    text := '';
  v_mal    text := '';
begin
  for v_u in
    select id, email,
           case when rol = 'admin' then 'angeles'
                when email = 'larriaza@sion.com.gt' then 'lissa'
                when email = 'jarriaza@sion.com.gt' then 'javier'
                else 'otro' end as quien
      from public.usuarios where activo
  loop
    if v_u.quien = 'otro' then continue; end if;

    -- Cuantas deberia ver: las que tiene asignadas o firmo.
    select count(distinct f.pago_id) into v_suyas
      from public.firmas f
     where f.pago_id is not null and f.deleted_at is null
       and (f.asignada_a = v_u.id or f.firmada_por = v_u.id);

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_u.id::text, 'role','authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_n from public.pagos;
    v_rep := v_rep || format('%s.pagos=%s(suyas %s) ', v_u.quien, v_n, v_suyas);
    if v_u.quien <> 'angeles' and v_n <> v_suyas then
      v_mal := v_mal || format('%s ve %s solicitudes y firma %s; ', v_u.quien, v_n, v_suyas);
    end if;

    select count(*) into v_n from public.firmas;
    v_rep := v_rep || format('%s.firmas=%s ', v_u.quien, v_n);

    select count(*) into v_n from public.pagos_notificaciones;
    v_rep := v_rep || format('%s.avisos=%s ', v_u.quien, v_n);

    perform set_config('role', 'postgres', true);
  end loop;

  perform set_config('request.jwt.claims', '', true);

  -- Angeles no puede perder nada: es quien las arma. Se compara contra el
  -- total de verdad y no contra un numero escrito a mano, que envejece.
  declare
    v_todas bigint;
    v_suyas_angeles bigint;
  begin
    -- Sin filtrar borradas: RLS no mira `deleted_at` --eso lo hace la
    -- pantalla-- asi que para comparar como con como hay que contar igual.
    select count(*) into v_todas from public.pagos;
    perform set_config('request.jwt.claims',
      json_build_object('sub',
        (select id::text from public.usuarios where rol='admin' and activo limit 1),
        'role','authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into v_suyas_angeles from public.pagos;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    if v_suyas_angeles <> v_todas then
      v_mal := v_mal || format('Angeles ve %s de %s solicitudes; ', v_suyas_angeles, v_todas);
    end if;
  end;

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

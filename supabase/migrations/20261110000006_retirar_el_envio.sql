-- Fase 59 · Retirar un envío, y que el documento vuelva entero
--
-- LO QUE PIDIÓ: «por error no seleccioné y le di enviar a mí misma la última
-- solicitud de vale. Crea el flujo necesario para retirar la solicitud y
-- volver a dejar la solicitud como estaba antes de haberse enviado.»
--
-- LO QUE HABÍA. `enviosApi.retirar` existe en el cliente desde hace fases y
-- hace una sola cosa:
--
--     update envios set deleted_at = now() where id = ...
--
-- No lo llama nadie, y menos mal: es exactamente la trampa de la ✕ de la
-- bandeja de Pagos. Mandar un documento NO es solo crear el envío --quien lo
-- manda mueve además el estado del documento-- así que un retiro que solo
-- borre el envío deja el documento diciendo que está en una bandeja que ya
-- no existe. En este caso: `SV-2026-0022` en «enviada_tesorero» para siempre,
-- sin bandeja donde resolverla y sin más salida que borrarla.
--
-- EL ESPEJO QUE YA ESTABA. `envio_aceptar` no sabe de tipos de documento:
-- despacha a `envio_despacho_{doc_tipo}` si esa función existe. Retirar se
-- escribe igual, con `envio_retiro_{doc_tipo}`. Mismo molde, dirección
-- contraria.
--
-- Y UNA DIFERENCIA DELIBERADA: aceptar llama a la función de despacho SI
-- EXISTE y si no, no hace nada. Retirar se NIEGA si no existe. No es
-- simetría rota, es la asimetría correcta:
--
--   · No despachar de más es inofensivo: el envío queda aceptado y nada se
--     movió.
--   · No deshacer de más deja el documento varado, que es el defecto que
--     esta fase lleva cuatro migraciones arreglando.
--
-- Hoy la única escrita es la de la solicitud de vale. La de `pago` NO está a
-- propósito: mandar una SP a tesorería la avanza a «Presentado» y escribe la
-- fecha en `step_dates`, así que retirarla es retroceder un paso --decidir
-- qué pasa con esa fecha, y qué si alguien ya avanzó más-- y eso se habla
-- antes de escribirlo. Mientras tanto el retiro de una SP se niega con su
-- motivo en vez de romperla en silencio.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Qué deshacerle a una solicitud de vale
-- ══════════════════════════════════════════════════════════════════════
-- Mandarla la puso en 'enviada_tesorero'. Antes era 'borrador'. Eso es todo
-- lo que el envío le tocó, así que eso es todo lo que hay que devolver.
--
-- El `and estado = 'enviada_tesorero'` no es decoración: si el tesorero ya
-- registró el vale la solicitud está en 'vale_emitido', y entonces esto no
-- toca nada --pero a ese caso no se llega, porque `envio_retirar` exige que
-- el envío siga pendiente. Son dos cerrojos para la misma puerta, a
-- propósito: el de arriba puede cambiar y este sigue siendo verdad.

create or replace function public.envio_retiro_comb_solicitud(e public.envios)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.comb_solicitudes
     set estado     = 'borrador',
         updated_by = auth.uid()
   where id = e.doc_id
     and deleted_at is null
     and estado = 'enviada_tesorero';
end $$;

comment on function public.envio_retiro_comb_solicitud(public.envios) is
  'Deshace lo que el envío le hizo a una solicitud de vale: vuelve a borrador.';

-- Es una pieza de `envio_retirar`, no una puerta propia.
revoke execute on function public.envio_retiro_comb_solicitud(public.envios) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Retirar
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.envio_retirar(p_envio uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_e  public.envios;
  v_fn text;
begin
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesión para retirar un envío.';
  end if;

  -- Retirar es el acto de quien mandó, no de quien recibe. Quien recibe tiene
  -- `envio_rechazar`, que deja constancia de que lo miró y lo devolvió.
  if public.auth_rol() not in ('admin', 'asistente') then
    raise exception 'Solo quien envía puede retirar un envío. Para devolverlo, recházalo.';
  end if;

  select * into v_e from public.envios
   where id = p_envio and deleted_at is null for update;
  if not found then
    raise exception 'Ese envío no existe o ya se había retirado.';
  end if;

  if v_e.estado <> 'enviado' then
    raise exception
      'El envío % ya fue %: retirarlo ahora borraría lo que la otra persona ya hizo.',
      v_e.serial, v_e.estado;
  end if;

  -- Se exige saber qué deshacerle al documento. Ver la nota de arriba.
  v_fn := 'envio_retiro_' || v_e.doc_tipo;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn
  ) then
    raise exception
      'Todavía no se puede retirar un envío de tipo «%»: mandarlo le cambia el estado al documento y falta definir cómo devolverlo.',
      v_e.doc_tipo;
  end if;

  execute format('select public.%I($1)', v_fn) using v_e;

  update public.envios
     set deleted_at = now(),
         updated_by = auth.uid()
   where id = p_envio;
end $$;

comment on function public.envio_retirar(uuid) is
  'Retira un envío todavía pendiente y devuelve el documento al estado en que '
  'estaba antes de mandarse. Se niega si la otra persona ya lo resolvió, y se '
  'niega si no hay definido cómo devolver ese tipo de documento.';

revoke execute on function public.envio_retirar(uuid) from public, anon;
grant  execute on function public.envio_retirar(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_n   int;
begin
  -- Las dos existen.
  if not exists (select 1 from pg_proc where pronamespace='public'::regnamespace
                  and proname='envio_retirar') then
    v_mal := v_mal || 'falta envio_retirar; ';
  end if;
  if not exists (select 1 from pg_proc where pronamespace='public'::regnamespace
                  and proname='envio_retiro_comb_solicitud') then
    v_mal := v_mal || 'falta envio_retiro_comb_solicitud; ';
  end if;

  -- Permisos: la puerta se abre a quien tiene sesión; la pieza interna, a nadie.
  if has_function_privilege('anon', 'public.envio_retirar(uuid)', 'execute') then
    v_mal := v_mal || 'anon puede retirar envíos; ';
  end if;
  if not has_function_privilege('authenticated', 'public.envio_retirar(uuid)', 'execute') then
    v_mal := v_mal || 'authenticated no puede retirar envíos; ';
  end if;
  if has_function_privilege('authenticated', 'public.envio_retiro_comb_solicitud(public.envios)', 'execute') then
    v_mal := v_mal || 'la pieza interna de retiro quedó abierta; ';
  end if;

  -- 'borrador' sigue siendo un estado válido para volver.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.comb_solicitudes'::regclass
       and pg_get_constraintdef(oid) like '%''borrador''%'
  ) then
    v_mal := v_mal || 'comb_solicitudes ya no acepta borrador; ';
  end if;

  -- El espejo sigue en pie: si mañana alguien renombra el despacho, esto lo dice.
  if not exists (select 1 from pg_proc where pronamespace='public'::regnamespace
                  and proname='envio_despacho_comb_solicitud') then
    v_mal := v_mal || 'ya no existe envio_despacho_comb_solicitud: el espejo se rompió; ';
  end if;

  select count(*) into v_n from public.envios
   where deleted_at is null and estado = 'enviado' and doc_tipo = 'comb_solicitud';
  v_rep := format('solicitudes de vale hoy en una bandeja: %s', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDÓ BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

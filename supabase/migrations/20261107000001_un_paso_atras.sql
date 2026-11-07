-- Fase 48 · Un paso atras en una solicitud de pago, y un clic de mas que no cuenta
--
-- LO QUE PASO, en sus palabras: «se trabo la compu y di dos clic intentando
-- avanzarlo, cuando se destrabo se fue a pagado de una vez, entonces estos
-- errores pueden ocurrir y luego no hay vuelta atras».
--
-- Son dos problemas, y arreglar solo uno deja el otro suelto.
--
-- 1. NO HAY VUELTA ATRAS. Al llegar al ultimo paso la solicitud sale de la
--    lista de trabajo y cae en «Solicitudes pagadas», que es de consulta. No
--    habia forma de corregir un paso dado de mas. En un flujo de seis pasos
--    que una persona avanza a mano, eso no es una salvaguarda: es que el
--    error se queda.
--
--    `pago_retroceder_paso` devuelve la solicitud un paso. Solo el
--    administrador --lo pidio para su usuario-- y queda en `audit_log` por
--    el trigger de la tabla, que es lo que hace que deshacer sea aceptable:
--    se puede, y se ve quien lo hizo.
--
-- 2. EL CLIC DE MAS CONTABA. El boton calculaba el paso siguiente sobre la
--    copia que tenia en pantalla y escribia el resultado. Con la pantalla
--    trabada, dos clics salian con la misma copia y el segundo pisaba al
--    primero --o, si entre medias llegaba la respuesta, avanzaba dos veces.
--
--    `pago_avanzar_paso` recibe DE QUE PASO cree venir el boton y no hace
--    nada si la fila ya no esta ahi. El segundo clic deja de contar sin que
--    nadie tenga que acordarse de deshabilitar el boton.
--
-- Las etiquetas de los pasos viven en el cliente (`PAGO_STEPS`), asi que el
-- total viaja como parametro en vez de repetirse aqui: dos listas de pasos
-- que se pueden desincronizar es peor que un argumento de mas.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Avanzar, sin que el segundo clic cuente
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.pago_avanzar_paso(
  p_pago  uuid,
  p_desde int,
  p_total int
)
returns public.pagos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_p      public.pagos;
  v_fechas text[];
  v_sig    int;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesion.';
  end if;
  if public.auth_rol() not in ('admin','asistente') then
    raise exception 'No tiene permiso para mover una solicitud de pago.';
  end if;

  select * into v_p from public.pagos
   where id = p_pago and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud de pago no existe.';
  end if;

  -- EL SEGUNDO CLIC. Si la fila ya no esta donde el boton creia, alguien
  -- --o el mismo-- la movio: no se vuelve a avanzar. Se devuelve tal como
  -- esta, para que la pantalla se ponga al dia sin dar un error que no lo es.
  if v_p.step_idx <> p_desde then
    return v_p;
  end if;

  v_sig := v_p.step_idx + 1;
  if v_sig > p_total - 1 then
    return v_p;
  end if;

  -- `step_dates` es text[] y en Postgres empieza en 1; el cliente lo indexa
  -- desde 0. De ahi el +1.
  v_fechas := coalesce(v_p.step_dates, array[]::text[]);
  v_fechas[v_sig + 1] := to_char(current_date, 'YYYY-MM-DD');

  update public.pagos
     set step_idx = v_sig,
         step_dates = v_fechas,
         status = case when v_sig = p_total - 1 then 'Pagado'::pago_estado else v_p.status end,
         updated_by = auth.uid()
   where id = p_pago
  returning * into v_p;

  return v_p;
end $$;

comment on function public.pago_avanzar_paso(uuid, int, int) is
  'Avanza un paso SOLO si la solicitud sigue en el paso del que salio el boton. Un segundo clic no cuenta.';

-- ══════════════════════════════════════════════════════════════════════
-- 2 · Y un paso atras, para el administrador
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.pago_retroceder_paso(p_pago uuid)
returns public.pagos
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_p      public.pagos;
  v_fechas text[];
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesion.';
  end if;
  if public.auth_rol() <> 'admin' then
    raise exception 'Solo el administrador puede devolver una solicitud de pago a un paso anterior.';
  end if;

  select * into v_p from public.pagos
   where id = p_pago and deleted_at is null for update;
  if not found then
    raise exception 'La solicitud de pago no existe.';
  end if;
  if v_p.step_idx <= 0 then
    raise exception 'La % ya esta en el primer paso.', coalesce(v_p.serial, 'solicitud');
  end if;

  -- Se borra la fecha del paso que se abandona. Dejarla diria que ese paso
  -- se cumplio tal dia, que es exactamente lo que se esta deshaciendo.
  v_fechas := coalesce(v_p.step_dates, array[]::text[]);
  if array_length(v_fechas, 1) >= v_p.step_idx + 1 then
    v_fechas[v_p.step_idx + 1] := null;
  end if;

  update public.pagos
     set step_idx = v_p.step_idx - 1,
         step_dates = v_fechas,
         -- Si decia «Pagado», al salir del ultimo paso deja de decirlo. Se
         -- mira el estado y no el numero del paso para no tener aqui una
         -- copia de cuantos pasos hay.
         status = case when v_p.status = 'Pagado' then 'Programado'::pago_estado
                       else v_p.status end,
         updated_by = auth.uid()
   where id = p_pago
  returning * into v_p;

  return v_p;
end $$;

comment on function public.pago_retroceder_paso(uuid) is
  'Devuelve una solicitud de pago un paso atras. Solo admin. Borra la fecha del paso que abandona y queda en audit_log.';

revoke execute on function public.pago_avanzar_paso(uuid, int, int) from public, anon;
revoke execute on function public.pago_retroceder_paso(uuid)        from public, anon;
grant  execute on function public.pago_avanzar_paso(uuid, int, int) to authenticated;
grant  execute on function public.pago_retroceder_paso(uuid)        to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 3 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  f text;
begin
  foreach f in array array['pago_avanzar_paso','pago_retroceder_paso'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f
    ) then
      v_mal := v_mal || format('falta %s; ', f);
    end if;
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = f
         and has_function_privilege('anon', p.oid, 'execute')
    ) then
      v_mal := v_mal || format('anon puede ejecutar %s; ', f);
    end if;
  end loop;

  -- La auditoria es la contrapartida de poder deshacer: sin ella, retroceder
  -- un paso seria borrar un rastro en vez de corregirlo.
  if not exists (
    select 1 from pg_trigger where tgrelid = 'public.pagos'::regclass
      and tgname = 'audit_pagos' and not tgisinternal
  ) then
    v_mal := v_mal || 'pagos sin trigger de auditoria; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

-- Fase 43 · Al firmar, la solicitud de pago avanza sola
--
-- Hasta ahora firmar y mover la solicitud eran dos actos separados: alguien
-- firmaba, el documento desaparecia de su bandeja, y la solicitud se quedaba
-- en «En Solicitud de Firma» hasta que la asistente la avanzaba a mano. Como
-- nada lo señalaba, tres solicitudes llevaban dias detenidas con su firma ya
-- puesta.
--
-- ── Por que un trigger y no codigo del navegador ────────────────────────
--
-- Quien firma puede ser alguien de solo lectura --la gerente lo es-- y las
-- politicas de `pagos` solo dejan escribir a admin y asistente. Si el avance
-- lo intentara su navegador, fallaria en silencio justo para quien mas lo
-- necesita. El trigger corre con los privilegios de la funcion, asi que el
-- avance ocurre firme quien firme, y queda en `audit_log` a nombre de quien
-- firmo, porque `pagos` si tiene auditoria.

create or replace function public.avanzar_pago_al_firmar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_orig text[];
  v_fechas text[];
begin
  -- Solo el momento exacto en que la firma pasa a firmada.
  if NEW.status_firma <> 'firmado'
     or OLD.status_firma is not distinct from NEW.status_firma
     or NEW.pago_id is null then
    return NEW;
  end if;

  -- Una solicitud puede pedir varias firmas. Avanza cuando no queda ninguna
  -- pendiente: con una de tres firmada el documento todavia no esta listo.
  if exists (
    select 1
      from public.firmas f
     where f.pago_id = NEW.pago_id
       and f.deleted_at is null
       and f.id <> NEW.id
       and f.status_firma <> 'firmado'
  ) then
    return NEW;
  end if;

  select coalesce(step_dates, '{}'::text[]) into v_orig
    from public.pagos
   where id = NEW.pago_id;

  -- Normalizar a seis posiciones con base 1. Asignar directo a un indice de
  -- un arreglo vacio produce un arreglo con base distinta de 1, y el cliente
  -- --que lo indexa desde cero-- lo leeria corrido un lugar.
  select array_agg(v_orig[i] order by i)
    into v_fechas
    from generate_series(1, 6) as i;

  -- `step_dates` es paralelo a los seis pasos. El paso 2 --«Firmado»-- es la
  -- posicion 3 contando desde uno.
  v_fechas[3] := coalesce(NEW.fecha_firma::text, to_char(now(), 'YYYY-MM-DD'));

  update public.pagos
     set step_idx = 2,
         step_dates = v_fechas
   where id = NEW.pago_id
     and step_idx = 1;  -- solo desde «En Solicitud de Firma»

  return NEW;
end $$;

comment on function public.avanzar_pago_al_firmar() is
  'Mueve la solicitud de pago a «Firmado» cuando se completan todas sus firmas.';

drop trigger if exists avanzar_pago_al_firmar on public.firmas;
create trigger avanzar_pago_al_firmar
  after update of status_firma on public.firmas
  for each row execute function public.avanzar_pago_al_firmar();

-- ── Las que se quedaron detenidas ──────────────────────────────────────
--
-- Tres solicitudes firmadas el 5 de noviembre siguen en el paso 1. Se las
-- pone donde deberian estar, con la fecha real de la firma y no la de hoy.

do $$
declare
  r record;
  v_orig text[];
  v_fechas text[];
  v_n int := 0;
begin
  for r in
    select p.id,
           p.serial,
           max(f.fecha_firma) as firmada
      from public.pagos p
      join public.firmas f
        on f.pago_id = p.id
       and f.deleted_at is null
     where p.deleted_at is null
       and p.step_idx = 1
     group by p.id, p.serial
    having bool_and(f.status_firma = 'firmado')
  loop
    select coalesce(step_dates, '{}'::text[]) into v_orig
      from public.pagos where id = r.id;

    select array_agg(v_orig[i] order by i)
      into v_fechas
      from generate_series(1, 6) as i;

    v_fechas[3] := coalesce(r.firmada::text, to_char(now(), 'YYYY-MM-DD'));

    update public.pagos
       set step_idx = 2, step_dates = v_fechas
     where id = r.id;

    v_n := v_n + 1;
    raise notice 'Avanzada % a Firmado (%).', r.serial, r.firmada;
  end loop;

  raise notice 'Solicitudes puestas al dia: %.', v_n;
end $$;

NOTIFY pgrst, 'reload schema';

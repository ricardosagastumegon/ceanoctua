-- CC Board · borrar una liquidacion fallaba siempre
--
-- EL ERROR
--
--   column "liquidacion_id" does not exist
--
-- Borrar cualquier liquidacion lo disparaba. No era un problema de esa fila
-- ni de sus datos: la columna `caja_chica_vales.liquidacion_id` desaparecio
-- cuando la fase 17 cambio la relacion a muchos-a-muchos con la tabla
-- `liquidacion_vales`, pero dos triggers del modelo viejo se quedaron
-- escritos contra ella. Como plpgsql resuelve las columnas al ejecutar, el
-- error aparecia recien al intentar el borrado.
--
-- LA CORRECCION
--
-- 1) `unlink_vales_on_liq_delete` pasa a liberar los vales a traves de la
--    tabla puente. Las filas del puente NO se borran: la liquidacion solo se
--    marca con `deleted_at` --borrado suave, invariante 6-- y si algun dia se
--    revierte tiene que volver con sus vales. Lo que se libera es el estado
--    del vale, que es lo que impide reusarlo.
--
-- 2) `sync_vale_liquidacion_link` se elimina. Vivia de `vale_serial`, el
--    campo de texto suelto del modelo viejo que el formulario dejo de llenar
--    cuando los vales pasaron a ser varios. Los triggers de
--    `liquidacion_vales` --trg_mark_vale_assigned y trg_recalc_liq_totales--
--    ya hacen ese trabajo. Mantener dos mecanismos para lo mismo es como se
--    llega a este tipo de incidente.

-- ── 1 · Liberar los vales al borrar, por la tabla puente ─────────────────
create or replace function public.unlink_vales_on_liq_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.caja_chica_vales v
       set estado = coalesce(v.estado_previo, 'Creado'::vale_status),
           estado_previo = null
     where v.id in (
       select lv.vale_id
         from public.liquidacion_vales lv
        where lv.liquidacion_id = new.id
     );
  end if;
  return new;
end
$fn$;

-- ── 2 · Fuera el sincronizador del modelo viejo ──────────────────────────
drop trigger if exists trg_sync_vale_link on public.caja_chica_liquidaciones;
drop function if exists public.sync_vale_liquidacion_link();

NOTIFY pgrst, 'reload schema';

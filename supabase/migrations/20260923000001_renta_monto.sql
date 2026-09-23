-- La renta guarda su total, como ya lo hacen ticket, hotel y restaurante.
--
-- Para qué: el viaje va a mostrar la suma de sus servicios, y sumarlos exige
-- que cada uno tenga su total calculado en una columna. La renta lo calculaba
-- solo en pantalla — tarifa × días + depósito + extras — así que desde fuera
-- del formulario no había manera de saber cuánto costaba.
--
-- Los servicios que faltan (tours, aeronaves, acuáticos, ferries, terrestres,
-- actividades) tampoco tienen `monto`; se les agrega cuando les toque su
-- documento, y mientras tanto aportan cero al total del viaje.

alter table public.att_rentas
  add column if not exists monto numeric(14,2);

comment on column public.att_rentas.monto is
  'Derivado: tarifa × días + depósito + extras. Se recalcula al guardar.';

-- Backfill con la misma fórmula del formulario, para las rentas que ya existen.
update public.att_rentas
   set monto = coalesce(tarifa, 0) * coalesce(dias, 0)
             + coalesce(deposito, 0)
             + coalesce((
                 select sum((e ->> 'amount')::numeric)
                   from jsonb_array_elements(
                          case when jsonb_typeof(extras) = 'array' then extras else '[]'::jsonb end
                        ) as e
               ), 0)
 where monto is null
   and deleted_at is null;

NOTIFY pgrst, 'reload schema';

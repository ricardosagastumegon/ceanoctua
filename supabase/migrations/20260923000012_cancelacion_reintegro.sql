-- Cancelacion con reintegro, y la fecha en que se cobro la tarjeta.
--
-- Pedido del usuario, 2026-09-23:
--
--   "cada servicio deberia de tener un boton que al cancelar pregunte si se
--    tiene un reintegro total, o parcial, y espacio para ingresar el
--    reintegro, para que este pueda restar o no al total pagado del servicio"
--
-- Lo importante del modelo: `monto` NO se toca. Es lo que se le cargo a la
-- tarjeta y asi tiene que quedar registrado. El reintegro se guarda aparte y
-- el que suma al viaje es el neto:
--
--     neto = monto - coalesce(reintegro, 0)
--
-- Guardar las dos cifras y no solo la resta es lo que permite cuadrar contra
-- el estado de cuenta: la tarjeta muestra un cargo y, por separado, un abono.
-- Si solo quedara la resta, nunca cuadraria.
--
-- Un servicio cancelado NO desaparece: si el reintegro fue parcial, ese dinero
-- se gasto y tiene que verse en la liquidacion.
--
-- `fecha_cargo` es aparte: la fecha en que se cobro la tarjeta, que puede ser
-- meses antes del viaje. Sirve para el control de las TC contra el banco. Es
-- opcional; si esta vacia, para cualquier reporte se cae a la fecha del
-- propio servicio.

do $$
declare
  t text;
  tablas text[] := array[
    'att_tickets', 'att_hoteles', 'att_restaurantes', 'att_rentas',
    'att_tours', 'att_aeronaves', 'att_acuaticos', 'att_ferries',
    'att_terrestres', 'att_actividades'
  ];
begin
  foreach t in array tablas loop
    execute format(
      'alter table public.%I
         add column if not exists cancelado_en date,
         add column if not exists reintegro numeric(14,2),
         add column if not exists reintegro_nota text,
         add column if not exists fecha_cargo date', t
    );

    execute format('comment on column public.%I.cancelado_en is %L', t,
      'Cuando se cancelo el servicio. Distinta de la fecha en que ocurria.');
    execute format('comment on column public.%I.reintegro is %L', t,
      'Cuanto volvio de lo pagado. null o 0 = no hubo. El neto del servicio es monto - reintegro.');
    execute format('comment on column public.%I.fecha_cargo is %L', t,
      'Fecha en que se cobro la tarjeta, que puede ser meses antes del viaje. Opcional: si esta vacia se usa la fecha del servicio.');

    -- El reintegro no puede ser negativo ni mayor a lo que se pago.
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_reintegro_chk');
    execute format(
      'alter table public.%I add constraint %I
         check (reintegro is null or (reintegro >= 0 and reintegro <= coalesce(monto, reintegro)))',
      t, t || '_reintegro_chk'
    );

    execute format(
      'create index if not exists %I on public.%I(fecha_cargo) where deleted_at is null',
      t || '_fecha_cargo_idx', t
    );
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';

-- Base de la Liquidación del viaje · cada servicio apunta a SU tarjeta.
--
-- El problema: `pagado_con` guarda el texto que el dropdown arma en el momento
-- (`tc_id · red · banco · titular`), no una referencia a la tarjeta. Eso hace
-- imposible reportar de forma confiable cuanto se consumio con cada TC:
--
--   · El mismo plastico queda guardado de formas distintas segun que campos
--     tuviera llenos la tarjeta ese dia. En la base hay
--     'Amex GT Term. 2345' y 'Mastercard  Term. 5907 · BAC · Miguel A. Arriaza',
--     uno con banco y titular y el otro sin ellos.
--   · Si se edita la tarjeta en Admin, los registros viejos quedan apuntando a
--     un nombre que ya no existe. Paso de verdad el 2026-09-23: el catalogo
--     decia 'Amex GT Term. 2345' por la manana y 'Amex GT Term. 864' por la
--     tarde, y el ticket GUA-MIA quedo huerfano.
--   · Y hay texto que nunca salio del catalogo, como 'TC MAA'.
--
-- La solucion: una columna con la llave de la tarjeta. `pagado_con` se queda
-- como lo que se muestra; `pagado_con_id` es lo que se suma.

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
      'alter table public.%I add column if not exists pagado_con_id uuid references public.tarjetas_credito(id)', t
    );
    execute format(
      'comment on column public.%I.pagado_con_id is %L', t,
      'La tarjeta con la que se pago. `pagado_con` es solo el texto que se muestra; esta columna es la que suma en la liquidacion.'
    );
    execute format(
      'create index if not exists %I on public.%I(pagado_con_id) where deleted_at is null',
      t || '_pagado_con_id_idx', t
    );

    -- Backfill 1 · lo que empieza con el identificador de una tarjeta viva.
    execute format($f$
      update public.%I s
         set pagado_con_id = t.id
        from public.tarjetas_credito t
       where s.pagado_con_id is null
         and s.pagado_con is not null
         and s.pagado_con like t.tc_id || '%%'
    $f$, t);

    -- Backfill 2 · los dos huerfanos, resueltos por el usuario el 2026-09-23:
    -- 'Amex GT Term. 2345' es la tarjeta que hoy se llama 'Amex GT Term. 864',
    -- y 'TC MAA' -- texto suelto del HTML viejo -- es esa misma.
    execute format($f$
      update public.%I s
         set pagado_con_id = t.id
        from public.tarjetas_credito t
       where s.pagado_con_id is null
         and s.pagado_con in ('Amex GT Term. 2345', 'TC MAA')
         and t.tc_id = 'Amex GT Term. 864'
    $f$, t);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';

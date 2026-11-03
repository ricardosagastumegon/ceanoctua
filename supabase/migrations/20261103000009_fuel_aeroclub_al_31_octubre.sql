-- Aeronaves · Estado de cuenta Aeroclub al 31 de octubre de 2026
--
-- La historia importada llegaba hasta el anticipo del 29 de septiembre y
-- dejaba Q12,413.44 disponibles. La asistente entrego el estado de cuenta
-- actualizado del proveedor, que agrega nueve movimientos y deja el
-- disponible en Q25,860.23.
--
-- QUE SE VERIFICO ANTES DE ESCRIBIR
--
-- Los 366 primeros renglones del archivo son identicos a los guardados, uno
-- por uno: tipo, fecha, documento y monto. La suma propia de los 377
-- movimientos --sin leer la columna de saldos del proveedor-- da exactamente
-- el saldo que esa columna declara, Q25,860.23.
--
-- Un renglon del estado de cuenta, el FER2037346 del 13/11/2024, trae cargo
-- Y abono en la misma linea. Ya estaba bien guardado como dos movimientos; se
-- anota aqui porque es la clase de cosa que al releer parece un error.
--
-- LO QUE TAMBIEN SE CORRIGE
--
-- El cargo de Q3,631.20 entro en la importacion anterior con el documento
-- truncado --"FER"-- y con la fecha del movimiento que tenia al lado. El
-- estado de cuenta nuevo lo trae completo: FER2051640 del 30 de octubre.
-- Ademas iba despues del anticipo de Q16,150.26 y en el estado de cuenta va
-- antes, asi que se intercambia su orden para que la cadena de saldos de la
-- pantalla siga la del proveedor.
--
-- EL CORTE
--
-- `historico_hasta` pasa al 31 de octubre, que es el ultimo CARGO del estado
-- de cuenta. De ahi en adelante los consumos de combustible que capture CEA
-- cuentan contra el saldo; los anteriores ya estan en esta historia y se
-- contarian dos veces. Noviembre arranca limpio.
--
-- Los dos anticipos del 9 de noviembre vienen asi en el documento del
-- proveedor, con fecha posterior al dia en que se entrego. Se cargan tal cual
-- --son parte del saldo que el proveedor declara-- y queda avisado para
-- confirmarlo con Aeroclub.

do $$
declare
  v_cuenta uuid;
  v_antes numeric;
  v_despues numeric;
  v_cargo uuid;
  v_abono uuid;
begin
  select id into v_cuenta from public.avn_fuel_cuentas
   where proveedor = 'AEROCLUB DE GUATEMALA GASOLINERA' and deleted_at is null;
  if v_cuenta is null then
    raise exception 'No existe la cuenta de Aeroclub.';
  end if;

  -- Se corre una sola vez. Si ya hay movimientos despues del 367, no toca nada.
  if exists (
    select 1 from public.avn_fuel_movimientos
     where cuenta_id = v_cuenta and orden > 367 and deleted_at is null
  ) then
    raise notice 'El estado de cuenta ya estaba actualizado; no se hizo nada.';
    return;
  end if;

  select sum(case when tipo = 'cargo' then -monto else monto end) into v_antes
    from public.avn_fuel_movimientos where cuenta_id = v_cuenta and deleted_at is null;

  -- ── 1 · El cargo que entro incompleto ───────────────────────────────────
  select id into v_cargo from public.avn_fuel_movimientos
   where cuenta_id = v_cuenta and orden = 367 and deleted_at is null;
  select id into v_abono from public.avn_fuel_movimientos
   where cuenta_id = v_cuenta and orden = 366 and deleted_at is null;

  update public.avn_fuel_movimientos
     set documento = 'FER2051640', fecha = date '2026-10-30', orden = 366
   where id = v_cargo;
  update public.avn_fuel_movimientos set orden = 367 where id = v_abono;

  -- ── 2 · Lo que agrega el estado de cuenta nuevo ─────────────────────────
  insert into public.avn_fuel_movimientos
    (cuenta_id, tipo, fecha, documento, comentario, monto, orden)
  values
    (v_cuenta, 'abono', '2026-09-29', null, 'Retenciones', 54.32, 368),
    (v_cuenta, 'abono', null, null, 'Anticipo 1150270039209', 8366.1, 369),
    (v_cuenta, 'abono', null, null, 'Anticipo', 3576.87, 370),
    (v_cuenta, 'cargo', '2026-10-12', 'FER2051859', 'Avion PC', 2040, 371),
    (v_cuenta, 'cargo', '2026-10-14', 'FER2051914', 'Avion PC', 1088, 372),
    (v_cuenta, 'cargo', '2026-10-31', 'RT00001844', 'Avion PC', 3740, 373),
    (v_cuenta, 'abono', null, null, 'Retenciones', 55.95, 374),
    (v_cuenta, 'abono', '2026-11-09', null, 'Anticipo', 6812.05, 375),
    (v_cuenta, 'abono', '2026-11-09', null, 'Anticipo factura Agosto', 1449.5, 376);

  -- ── 3 · El corte ────────────────────────────────────────────────────────
  update public.avn_fuel_cuentas
     set historico_hasta = date '2026-10-31'
   where id = v_cuenta;

  -- ── 4 · Que cuadre, o no se guarda ──────────────────────────────────────
  select sum(case when tipo = 'cargo' then -monto else monto end) into v_despues
    from public.avn_fuel_movimientos where cuenta_id = v_cuenta and deleted_at is null;

  if round(v_despues, 2) <> 25860.23 then
    raise exception 'El disponible quedo en % y el estado de cuenta dice 25860.23. No se guarda nada.',
      round(v_despues, 2);
  end if;

  raise notice 'Disponible: % → %', round(v_antes, 2), round(v_despues, 2);
end $$;

NOTIFY pgrst, 'reload schema';

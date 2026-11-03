-- Finanzas · el cobro a una tarjeta en un viaje avisa solo
--
-- EL PROBLEMA
--
-- Las tarjetas de Presidencia se usan en un 99% para viajes, pero lo que se
-- carga a una tarjeta dentro de Arriaza T&T no llegaba a Consumos TC. Y esa
-- pantalla no es contabilidad: es la bandeja con la que se le avisa a la
-- Asistente de Presidencia que la tarjeta ya tiene un cargo, para que la
-- pague sin esperar el corte --esas tarjetas se llenan y se vacian varias
-- veces al mes--. Sin ese aviso, el 99% del movimiento no se avisaba, o se
-- recapturaba a mano en los dos lados.
--
-- CUANDO EXISTE UN CONSUMO
--
-- Cuando el banco ya cobro, y eso en T&T ya se registra: es la `fecha_cargo`
-- del servicio. Antes de eso no hay nada que avisar --una reserva que el
-- banco todavia no cobro, o un servicio "a pagar en propiedad", no tiene
-- fecha de cargo y por lo tanto no genera aviso--. Una fecha de cargo futura
-- si genera el aviso, y el plazo de 7 dias corre desde esa fecha, asi que no
-- aparece vencido antes de tiempo.
--
-- QUE PASA SI EL SERVICIO CAMBIA
--
-- El consumo esta amarrado al servicio, no es una copia suelta:
--
--   * Mientras el voucher no se haya usado para pagar, sigue al servicio:
--     cambia la tarjeta, el monto o la fecha y el aviso se actualiza.
--   * Si el servicio deja de tener cargo --se le quita la fecha, se borra--
--     el aviso se retira.
--   * Si Presidencia YA pago ese voucher, no se reescribe: eso ocurrio. Si el
--     servicio cambia de tarjeta, el consumo viejo se anula marcado como
--     reversado y nace uno nuevo para la tarjeta que ahora corresponde, que
--     es lo que de verdad pasa en el banco.
--
-- Decisiones de la usuaria, 2026-11-03. Lo ya capturado en T&T no se trae:
-- esto aplica de aqui en adelante.

-- ── 1 · De donde viene cada consumo ──────────────────────────────────────
alter table public.tc_consumos
  add column if not exists origen_tabla text,
  add column if not exists origen_id uuid;

comment on column public.tc_consumos.origen_tabla is
  'Tabla del servicio de T&T que lo origino. Nulo si se capturo a mano en Finanzas.';
comment on column public.tc_consumos.origen_id is
  'Id del servicio que lo origino. Con origen_tabla forma el amarre uno a uno.';

-- Un servicio no puede tener dos avisos vivos. Los anulados no cuentan, que
-- es lo que permite que un cambio de tarjeta deje el viejo y cree el nuevo.
create unique index if not exists tc_consumos_origen_uk
  on public.tc_consumos (origen_tabla, origen_id)
  where origen_tabla is not null and deleted_at is null;

-- ── 2 · La sincronizacion ────────────────────────────────────────────────
create or replace function public.sync_consumo_tc_desde_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  j          jsonb := to_jsonb(new);
  v_card     public.tarjetas_credito%rowtype;
  v_prev     public.tc_consumos%rowtype;
  v_pagado   boolean := false;
  v_debe     boolean;
  v_etiqueta text;
  v_prov     text;
  v_concepto text;
  v_viaje    text;
  v_moneda   public.currency;
  v_monto    numeric;
  v_fecha    date;
begin
  v_monto := coalesce(nullif(j->>'monto', '')::numeric, 0);
  v_fecha := nullif(j->>'fecha_cargo', '')::date;

  v_debe := (j->>'pagado_con_id') is not null
        and v_fecha is not null
        and v_monto > 0
        and (j->>'deleted_at') is null;

  select * into v_prev
    from public.tc_consumos
   where origen_tabla = tg_table_name
     and origen_id = new.id
     and deleted_at is null;

  if v_prev.id is not null then
    select exists (
      select 1 from public.pagos p
       where p.consumo_id = v_prev.id and p.deleted_at is null
    ) into v_pagado;
  end if;

  -- El servicio dejo de tener cargo. El aviso se retira, salvo que ya se
  -- haya pagado: eso ocurrio y no se borra.
  if not v_debe then
    if v_prev.id is not null and not v_pagado then
      update public.tc_consumos set deleted_at = now() where id = v_prev.id;
    end if;
    return new;
  end if;

  select * into v_card
    from public.tarjetas_credito
   where id = (j->>'pagado_con_id')::uuid;

  v_etiqueta := case tg_table_name
    when 'att_tickets'         then 'Ticket aéreo'
    when 'att_hoteles'         then 'Hotel'
    when 'att_restaurantes'    then 'Restaurante'
    when 'att_rentas'          then 'Renta de vehículo'
    when 'att_tours'           then 'Tour'
    when 'att_aeronaves'       then 'Renta de aeronave'
    when 'att_acuaticos'       then 'Traslado acuático'
    when 'att_ferries'         then 'Ferry'
    when 'att_terrestres'      then 'Traslado terrestre'
    when 'att_actividades'     then 'Actividad'
    when 'att_cruceros'        then 'Crucero'
    when 'att_cargos'          then 'Cargo adicional'
    when 'att_consumos_varios' then 'Consumos varios'
    else 'Servicio de viaje'
  end;

  v_prov := coalesce(
    nullif(trim(j->>'prestador'), ''),
    nullif(trim(j->>'nombre'), ''),
    nullif(trim(j->>'aerolinea'), ''),
    nullif(trim(j->>'evento'), ''),
    nullif(trim(j->>'naviera'), ''),
    nullif(trim(j->>'titulo'), ''),
    nullif(trim(j->>'descripcion'), ''),
    nullif(trim(j->>'concepto'), ''),
    v_etiqueta);

  select trim(both ' ·' from coalesce(v.trip_no, '') || ' · ' || coalesce(v.titulo, ''))
    into v_viaje
    from public.att_viajes v
   where v.id = nullif(j->>'viaje_id', '')::uuid;

  v_concepto := v_etiqueta || ' · ' || v_prov
             || case when coalesce(v_viaje, '') <> '' then ' · Viaje ' || v_viaje else '' end;

  -- `moneda` es texto suelto en att_cargos y enum en el resto. Lo que no sea
  -- una moneda conocida entra como USD en vez de reventar el guardado del
  -- servicio, que es lo que de verdad importa.
  v_moneda := case when (j->>'moneda') in ('USD', 'GTQ', 'EUR', 'GBP')
                   then (j->>'moneda')::public.currency
                   else 'USD'::public.currency end;

  if v_prev.id is null then
    insert into public.tc_consumos (
      fecha, card_id, tarjeta_id, proveedor, concepto, monto, moneda,
      origen, origen_tabla, origen_id, solicitado_por
    ) values (
      v_fecha, coalesce(v_card.tc_id, '—'), v_card.id, v_prov, v_concepto,
      v_monto, v_moneda, 'Arriaza T&T', tg_table_name, new.id,
      'Arriaza Tour & Travel'
    );

  elsif v_pagado then
    -- Ya se pago. Solo un cambio de tarjeta amerita tocarlo, y no se
    -- reescribe: se anula y nace el nuevo, con los dos rastros.
    if v_prev.tarjeta_id is distinct from v_card.id then
      update public.tc_consumos
         set deleted_at = now(),
             concepto = concepto || ' · REVERSADO: el servicio cambió de tarjeta'
       where id = v_prev.id;

      insert into public.tc_consumos (
        fecha, card_id, tarjeta_id, proveedor, concepto, monto, moneda,
        origen, origen_tabla, origen_id, solicitado_por
      ) values (
        v_fecha, coalesce(v_card.tc_id, '—'), v_card.id, v_prov, v_concepto,
        v_monto, v_moneda, 'Arriaza T&T', tg_table_name, new.id,
        'Arriaza Tour & Travel'
      );
    end if;

  elsif (v_prev.fecha, v_prev.tarjeta_id, v_prev.monto, v_prev.moneda,
         v_prev.proveedor, v_prev.concepto)
     is distinct from
        (v_fecha, v_card.id, v_monto, v_moneda, v_prov, v_concepto) then
    -- Solo se escribe si de verdad cambio algo: si no, cada guardado del
    -- servicio ensuciaria el audit_log con filas identicas.
    update public.tc_consumos
       set fecha = v_fecha,
           card_id = coalesce(v_card.tc_id, '—'),
           tarjeta_id = v_card.id,
           proveedor = v_prov,
           concepto = v_concepto,
           monto = v_monto,
           moneda = v_moneda
     where id = v_prev.id;
  end if;

  return new;
end
$fn$;

-- ── 3 · Los servicios que se pueden cobrar a una tarjeta ─────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'att_tickets','att_hoteles','att_restaurantes','att_rentas','att_tours',
    'att_aeronaves','att_acuaticos','att_ferries','att_terrestres',
    'att_actividades','att_cruceros','att_cargos','att_consumos_varios'
  ] loop
    execute format('drop trigger if exists trg_consumo_tc on public.%I', t);
    execute format(
      'create trigger trg_consumo_tc after insert or update on public.%I
         for each row execute function public.sync_consumo_tc_desde_servicio()', t);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';

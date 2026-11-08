-- Fase 57 · Tres categorias mas en la liquidacion del piloto
--
-- «En categorias agregar: Repuestos, mantenimiento, pintura». Son gastos de
-- viaje reales --el viaje de Miami que dio origen a todo esto era justamente
-- por un servicio annual-- y hasta ahora habrian caido en «Otros», que es
-- donde se pierde lo que despues nadie puede sumar.
--
-- El CHECK se reescribe entero, que es donde se pierde un valor vivo sin que
-- nadie lo note, asi que la comprobacion los cuenta uno por uno Y mira que
-- ninguna fila se haya quedado fuera.

alter table public.avn_liquidacion_gastos
  drop constraint if exists avn_liq_gastos_categoria_chk;

alter table public.avn_liquidacion_gastos
  add constraint avn_liq_gastos_categoria_chk
  check (categoria in (
    'Combustible',
    'Servicios aeroportuarios',
    'Hotel y transporte',
    'Alimentacion',
    'Tramites',
    'Repuestos',
    'Mantenimiento',
    'Pintura',
    'Otros'
  ));

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_def text;
  v_mal text := '';
  v_rep text := '';
  c text;
  v_n int;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.avn_liquidacion_gastos'::regclass
     and conname = 'avn_liq_gastos_categoria_chk';

  foreach c in array array[
    'Combustible','Servicios aeroportuarios','Hotel y transporte','Alimentacion',
    'Tramites','Repuestos','Mantenimiento','Pintura','Otros'
  ] loop
    if v_def not like '%''' || c || '''%' then
      v_mal := v_mal || format('el CHECK de categoria perdio «%s»; ', c);
    end if;
  end loop;

  -- Y que ningun gasto ya capturado se haya quedado fuera de la lista.
  select count(*) into v_n from public.avn_liquidacion_gastos
   where categoria not in (
     'Combustible','Servicios aeroportuarios','Hotel y transporte','Alimentacion',
     'Tramites','Repuestos','Mantenimiento','Pintura','Otros'
   );
  if v_n > 0 then
    v_mal := v_mal || format('%s gastos tienen una categoria fuera del CHECK; ', v_n);
  end if;

  select count(*) into v_n from public.avn_liquidacion_gastos;
  v_rep := v_rep || format('gastos capturados: %s ', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

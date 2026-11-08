-- Fase 55 · Un reintegro no sobrevive al consumo que lo origino
--
-- LO QUE ENCONTRO EN EL TABLERO: «tengo esto en PENDIENTE DE REINTEGRO, ya
-- revise y no encuentro de donde esta leyendo esta informacion».
--
-- Sale de `reintegros`: el tablero pinta todo lo que no este marcado como
-- «reintegrada». Habia una sola fila --BANANERA IZABAL, Q1,840.20, del 28 de
-- mayo-- y apuntaba a un consumo de tarjeta QUE SE BORRO EL 11 DE JULIO. Por
-- eso no lo encontraba: en Consumos TC ya no aparece, pero su reintegro
-- siguio vivo casi cuatro meses diciendo que habia dinero pendiente.
--
-- El tablero no mentia: decia la verdad sobre lo que habia en la tabla. El
-- fallo es que borrar un consumo no se llevaba su reintegro --el mismo
-- descuido que el control de vales tenia con sus vales hasta esta semana.
--
-- SE BORRA EN SUAVE Y SE ANOTA POR QUE. Un reintegro no se puede «deshacer»
-- sin dejar dicho que se fue con su consumo: dentro de un año, una fila que
-- desaparecio sin explicacion es peor que la fila de mas.

create or replace function public.reintegro_sigue_a_su_consumo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  update public.reintegros r
     set deleted_at = now(),
         notas = concat_ws(
           ' · ',
           nullif(r.notas, ''),
           'Se borro con su consumo el ' || to_char(now(), 'DD/MM/YYYY') || '.'
         ),
         updated_at = now()
   where r.consumo_id = new.id
     and r.deleted_at is null;

  return new;
end $$;

comment on function public.reintegro_sigue_a_su_consumo() is
  'Al borrar un consumo de tarjeta, su reintegro se va con el. Sin esto queda vivo en el tablero apuntando a algo que ya no existe.';

revoke execute on function public.reintegro_sigue_a_su_consumo() from public, anon, authenticated;

drop trigger if exists tc_consumo_borra_su_reintegro on public.tc_consumos;
create trigger tc_consumo_borra_su_reintegro
  after update of deleted_at on public.tc_consumos
  for each row execute function public.reintegro_sigue_a_su_consumo();

-- ══════════════════════════════════════════════════════════════════════
-- El que ya estaba suelto
-- ══════════════════════════════════════════════════════════════════════
--
-- Decision de la dueña, con el caso delante: «borrarlo». Lo mismo que hara
-- el trigger de ahora en adelante, aplicado a lo que quedo de antes. No se
-- toca ningun reintegro cuyo consumo siga vivo.

update public.reintegros r
   set deleted_at = now(),
       notas = concat_ws(
         ' · ',
         nullif(r.notas, ''),
         'Su consumo se habia borrado el ' || to_char(c.deleted_at, 'DD/MM/YYYY')
         || '; el reintegro quedo suelto y se cerro el '
         || to_char(now(), 'DD/MM/YYYY') || '.'
       ),
       updated_at = now()
  from public.tc_consumos c
 where c.id = r.consumo_id
   and c.deleted_at is not null
   and r.deleted_at is null;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal  text := '';
  v_n    int;
  v_rep  text := '';
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'tc_consumo_borra_su_reintegro' and not tgisinternal
  ) then
    v_mal := v_mal || 'falta el trigger; ';
  end if;

  -- Ninguno vivo colgando de un consumo borrado.
  select count(*) into v_n
    from public.reintegros r join public.tc_consumos c on c.id = r.consumo_id
   where r.deleted_at is null and c.deleted_at is not null;
  if v_n > 0 then
    v_mal := v_mal || format('%s reintegros siguen colgando de un consumo borrado; ', v_n);
  end if;

  -- Y que no se haya llevado por delante ninguno sano.
  select count(*) into v_n
    from public.reintegros r left join public.tc_consumos c on c.id = r.consumo_id
   where r.deleted_at is null and (c.id is null or c.deleted_at is null);
  v_rep := v_rep || format('reintegros vivos y con consumo sano: %s ', v_n);

  select count(*) into v_n from public.reintegros where deleted_at is null;
  v_rep := v_rep || format('| vivos en total: %s ', v_n);

  if v_mal <> '' then
    raise exception 'NO QUEDO BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

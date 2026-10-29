-- Tarjetas de Presidencia · un solo formato de nombre
--
-- Las siete se escribian de cuatro maneras distintas: dos arrancaban con
-- "TC ", una traia doble espacio, y "Term." llevaba punto en unas y en otras
-- no. Buscar una tarjeta en un desplegable de once asi es adivinar.
--
--   TC Amex GT Term 8748    ->  Amex GT Term. 8748
--   TC Visa Term 5092       ->  Visa Term. 5092
--   M2 Visa Term 8901       ->  M2 Visa Term. 8901
--   Mastercard  Term. 5907  ->  Mastercard Term. 5907
--
-- Las otras tres ya estaban bien. Las corporativas NO se tocan: su "TC Corp"
-- es parte del nombre con el que se conocen.
--
-- POR QUE ESTO NO ROMPE NADA
--
-- Un servicio no se amarra a su tarjeta por el nombre sino por
-- `pagado_con_id`. El nombre es una etiqueta del catalogo.
--
-- Lo que si guarda texto es `pagado_con`: una foto de como se llamaba la
-- tarjeta el dia que se capturo el servicio. La liquidacion rotula con esa
-- foto, a proposito, para que un reporte reimpreso diga lo mismo que el dia
-- que se emitio. Pero aqui no cambio de plastico: es la misma tarjeta mejor
-- escrita, asi que la foto se actualiza --decision del usuario, 2026-10-29--
-- y la liquidacion deja de decir dos nombres para una sola tarjeta.
--
-- Queda todo en audit_log: las trece tablas de servicio y `tarjetas_credito`
-- tienen su trigger.

-- ── 1 · El catalogo ───────────────────────────────────────────────────────
update public.tarjetas_credito set tc_id = 'Amex GT Term. 8748'
 where tc_id = 'TC Amex GT Term 8748';
update public.tarjetas_credito set tc_id = 'Visa Term. 5092'
 where tc_id = 'TC Visa Term 5092';
update public.tarjetas_credito set tc_id = 'M2 Visa Term. 8901'
 where tc_id = 'M2 Visa Term 8901';
update public.tarjetas_credito set tc_id = 'Mastercard Term. 5907'
 where tc_id = 'Mastercard  Term. 5907';

-- ── 2 · La foto guardada en cada servicio ────────────────────────────────
-- Se rearma con el mismo orden que usa la aplicacion --tc_id primero, que es
-- de donde la liquidacion saca el nombre corto-- y solo donde de verdad
-- cambia, para no ensuciar el audit_log con filas identicas.
do $$
declare
  t text;
begin
  foreach t in array array[
    'att_tickets','att_hoteles','att_restaurantes','att_rentas','att_tours',
    'att_aeronaves','att_acuaticos','att_ferries','att_terrestres',
    'att_actividades','att_cruceros','att_cargos','att_consumos_varios'
  ] loop
    execute format($f$
      update public.%I s
         set pagado_con = c.etiqueta
        from (
          select id,
                 concat_ws(' · ',
                   nullif(trim(tc_id), ''),
                   nullif(trim(empresa), ''),
                   nullif(trim(red), ''),
                   nullif(trim(banco), ''),
                   nullif(trim(titular), '')) as etiqueta
            from public.tarjetas_credito
           where tipo = 'presidencia'
        ) c
       where s.pagado_con_id = c.id
         and s.deleted_at is null
         and coalesce(s.pagado_con, '') is distinct from c.etiqueta
    $f$, t);
  end loop;
end $$;

-- ── 3 · El texto libre de Finanzas ───────────────────────────────────────
-- Solo las de Presidencia que acabamos de renombrar. La corporativa que trae
-- "TC Corp Agro Term. 7274" NO se toca: esa terminacion es la del plastico
-- anterior y ese cargo salio de verdad en aquel estado de cuenta.
update public.tc_consumos c
   set card_id = t.tc_id
  from public.tarjetas_credito t
 where c.tarjeta_id = t.id
   and t.tipo = 'presidencia'
   and c.deleted_at is null
   and c.card_id is distinct from t.tc_id;

NOTIFY pgrst, 'reload schema';

-- La Amex anterior · Term. 2345
--
-- QUE PASO
--
-- Tres tickets del viaje NEW YORK- BODA --GUA-MIA, MIA- JFK y EWR- GUA, de
-- septiembre 2026, USD 3,034.42 entre los tres-- tenian guardado el texto
-- "Amex GT Term. 2345" pero su `pagado_con_id` apuntaba al registro que hoy
-- se llama "Amex GT Term. 864".
--
-- La explicacion, confirmada por la usuaria el 2026-10-29: la Amex se renovo
-- y en su momento le cambiaron el nombre AL MISMO registro en vez de crear
-- una tarjeta nueva. El texto era el unico rastro de que esos cargos
-- salieron en el estado de cuenta del plastico anterior.
--
-- La migracion 20261029000003, al homogenizar los nombres, reescribio ese
-- texto. Esto lo devuelve y, de paso, arregla el fondo: la 2345 pasa a ser
-- una tarjeta de verdad --dada de baja-- y los tres tickets se amarran a
-- ella. Asi la liquidacion deja de cargarle a la 864 un gasto que nunca
-- salio en su estado de cuenta.
--
-- Es justo el caso que el aviso del formulario de tarjetas trata de evitar.

-- ── 1 · La tarjeta anterior, dada de baja ────────────────────────────────
insert into public.tarjetas_credito (tipo, tc_id, red, banco, titular, color, activo, notas)
select 'presidencia', 'Amex GT Term. 2345', 'AMEX', 'BAC', 'Miguel A Arriaza',
       '#1C8FD4', false,
       'Plastico anterior de la Amex GT. Se renovo y paso a Term. 864. Dada de baja: no se le puede cobrar nada nuevo, pero conserva los cargos que salieron en su estado de cuenta.'
 where not exists (
   select 1 from public.tarjetas_credito where tc_id = 'Amex GT Term. 2345'
 );

-- ── 2 · Los tres tickets vuelven a su tarjeta ────────────────────────────
-- El texto se devuelve exactamente como se habia capturado, sin agregarle
-- banco ni titular: la hoja impresa de aquel viaje decia esto.
update public.att_tickets
   set pagado_con = 'Amex GT Term. 2345',
       pagado_con_id = (select id from public.tarjetas_credito where tc_id = 'Amex GT Term. 2345')
 where id in (
   'c99e87b9-5e33-4de0-8654-f2b94fd2f737',
   'a073a519-28ad-4274-b84e-878155857991',
   'fc82aa86-335c-462e-9b12-9874229eda20'
 );

NOTIFY pgrst, 'reload schema';

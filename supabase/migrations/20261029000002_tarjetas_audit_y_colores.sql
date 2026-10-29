-- Tarjetas de credito · auditoria y color por marca
--
-- 1) AUDITORIA
--
-- `tarjetas_credito` no tenia trigger de auditoria. Mientras la tabla era
-- solo un catalogo de nombres daba igual, pero ahora se le da de baja una
-- tarjeta --se extravio, se repuso-- y esa decision tiene consecuencias:
-- deja de poder cobrarse en T&T. Quien la dio de baja y cuando tiene que
-- quedar escrito, que es lo que manda la Regla 0.
--
-- Los demas catalogos (entidades, personas, empleados, proveedores,
-- tipos_pago) siguen sin trigger. Es deuda conocida, anotada en PENDIENTES,
-- y no se toca aqui para no mezclar.
--
-- 2) COLOR POR MARCA
--
-- Las siete tarjetas de Presidencia tenian el mismo color, asi que la ficha
-- y el chip del desplegable no distinguian una de otra: solo las separaba la
-- terminacion. El color pasa a decir la marca --pedido de la usuaria el
-- 2026-10-29: Visa azul, Amex celeste, Mastercard naranja--.
--
-- Las corporativas NO se tocan: su color es el de la empresa (Agroatlantic
-- azul, Bananera verde, Sureña morado, VCC naranja) y eso es lo que las
-- identifica en su galeria.
--
-- El color sigue siendo editable en Admin -> Tarjetas; esto solo pone un
-- punto de partida razonable donde habia uno solo repetido.

-- ── 1 · Auditoria ─────────────────────────────────────────────────────────
drop trigger if exists audit_tarjetas_credito on public.tarjetas_credito;
create trigger audit_tarjetas_credito
  after insert or update or delete on public.tarjetas_credito
  for each row execute function public.audit_trigger();

-- ── 2 · Color por marca, solo Presidencia ─────────────────────────────────
update public.tarjetas_credito
   set color = case
     when tc_id ilike '%amex%' or red ilike 'amex' then '#1C8FD4'
     when tc_id ilike '%visa%' or red ilike 'visa' then '#1434CB'
     when tc_id ilike '%mastercard%' or tc_id ilike '%master card%' or red ilike 'master%'
       then '#E8630A'
     else color
   end
 where tipo = 'presidencia';

NOTIFY pgrst, 'reload schema';

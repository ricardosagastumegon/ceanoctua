-- Fase 22 · ajustes al Ticket Aéreo pedidos después de la primera entrega.
--
-- 1) Tiempo de vuelo por segmento.
-- 2) Tipo de pasajero (AD / CHD / INF / SSA), selección múltiple: un pasajero
--    puede ser adulto Y requerir asistencia especial a la vez.
-- 3) "Pagado con" pasa de uuid a texto.
--
-- Sobre el punto 3: al crear la tabla puse `pagado_con_tc_id uuid`, pero los
-- otros diez servicios del módulo guardan `pagado_con` como texto y el
-- componente compartido PaymentMethodSelect devuelve la etiqueta ya armada
-- ("TC Presi **** 1234 — Visa"). Mantener dos formas distintas de guardar lo
-- mismo obligaría a un caso especial en cada lugar que lo lea. La columna uuid
-- se creó hoy, nunca se usó y no tiene datos, así que se elimina.

alter table public.att_ticket_segments
  add column if not exists tiempo_vuelo text;

alter table public.att_ticket_pax
  add column if not exists tipos text[];

comment on column public.att_ticket_pax.tipo is
  'DEPRECADA (fase 22) — usar tipos[] (AD / CHD / INF / SSA).';

alter table public.att_tickets
  add column if not exists pagado_con text,
  drop column if exists pagado_con_tc_id;

NOTIFY pgrst, 'reload schema';

-- Actividades · la tarifa va por participante.
--
-- Pedido del usuario el 2026-09-23: "quiero tarifa por participante, me
-- funciona mejor". Antes el evento tenia una sola tarifa que multiplicaba por
-- la cantidad de personas, asi que todos pagaban lo mismo. No sirve cuando las
-- entradas son de categorias distintas -- un palco y una platea en la misma
-- funcion.
--
-- La tarifa pasa entonces a la fila de cada participante.

alter table public.att_actividad_entradas
  add column if not exists tarifa numeric(14,2);

comment on column public.att_actividad_entradas.tarifa is
  'Lo que cuesta la entrada de este participante. El total del evento es la
   suma de estas tarifas mas monto_extras.';

comment on column public.att_actividades.tarifa is
  'Tarifa por defecto, con la que se proponen las filas nuevas de
   att_actividad_entradas. Solo se usa para el total cuando el evento todavia
   no tiene participantes detallados.';

comment on column public.att_actividades.monto is
  'Derivado: suma de las tarifas de att_actividad_entradas + monto_extras. Si
   no hay participantes detallados, cae a tarifa x personas. Se recalcula al
   guardar.';

NOTIFY pgrst, 'reload schema';

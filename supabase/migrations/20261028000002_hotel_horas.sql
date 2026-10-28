-- T&T · Hoteles · hora de check-in y de check-out
--
-- La reserva de un hotel guardaba solo los dias, no las horas. En el
-- Itinerario General eso dejaba las dos filas del hotel --Check-in y
-- Check-out-- sin hora, con un guion donde los demas servicios muestran la
-- suya, y encima no habia donde escribirla: el resto del dia se ordena por
-- reloj y el hotel quedaba fuera de ese orden.
--
-- Son columnas `time` y no `timestamptz` a proposito: "check-out 11:00" es la
-- hora local de la recepcion del hotel, no un instante universal. Guardarla
-- con zona obligaria a decidir la del hotel --que ni se captura-- y la correria
-- al mostrarla desde Guatemala.
--
-- Nullable sin valor por omision: el hotel que todavia no confirma la hora
-- tiene que poder quedarse sin ella. Un 15:00 inventado se leeria igual que
-- uno confirmado, y la usuaria planifica el traslado con ese numero.

alter table public.att_hoteles
  add column if not exists checkin_hora time,
  add column if not exists checkout_hora time;

comment on column public.att_hoteles.checkin_hora is
  'Hora local de entrada al hotel. Se puede corregir desde el Itinerario General.';
comment on column public.att_hoteles.checkout_hora is
  'Hora local de salida del hotel. Se puede corregir desde el Itinerario General.';

NOTIFY pgrst, 'reload schema';

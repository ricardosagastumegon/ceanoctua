-- Phase 4 - Seed: 7 miembros del board.
-- Los nombres reales deben tomarse del HTML original. Por ahora se usa el
-- código como nombre placeholder; edita estas filas en cuanto los tengas.
-- Las políticas RLS patrón B (tareas, viajes, ...) dependen de que estos
-- registros existan para poder enlazar usuarios->miembro_id.

insert into public.miembros_board (codigo, nombre, orden) values
  ('MAA', 'MAA', 1),
  ('JA',  'JA',  2),
  ('LA',  'LA',  3),
  ('JM',  'JM',  4),
  ('AA',  'AA',  5),
  ('EG',  'EG',  6),
  ('PE',  'PE',  7)
on conflict (codigo) do nothing;

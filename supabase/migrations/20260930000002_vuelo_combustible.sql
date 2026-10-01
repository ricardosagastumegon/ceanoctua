-- Aeronaves · Bitacora de vuelo · combustible abordado
--
-- Lo que el piloto reporta que se le cargo a la aeronave. SOLO LA CANTIDAD:
-- ni precio, ni numero de vale, ni factura.
--
-- ── Por que no se amarra con el registro de combustible ──────────────────
-- Porque no son lo mismo y no van uno a uno. La usuaria lo explico asi:
--
--   "Por lo general abastecen de combustible la aeronave previo al vuelo, o
--    un dia antes, pueden abastecer solo para ese vuelo o para toda la ruta
--    del dia, por ende NO SIEMPRE SE TIENE 1 VALE POR CADA VUELO."
--
-- O sea que son dos hechos distintos sobre la misma gasolina:
--
--   - Aca, en el vuelo: lo OPERATIVO. Cuanto llevaba la aeronave. Lo reporta
--     el piloto el mismo dia.
--   - En `avn_combustible_registros`: lo FINANCIERO. El vale y la factura que
--     llegan despues a administracion, con su FER, y que alimentan el estado
--     de cuenta del proveedor.
--
-- Forzar una relacion entre los dos obligaria a inventar vales que no
-- existen, o a dejar vuelos sin combustible cuando una sola carga cubrio
-- tres. Se quedan separados a proposito.

alter table public.avn_vuelos
  add column if not exists combustible_cantidad numeric(10,2),
  -- En galones o en peso: depende de la aeronave. El Cirrus se mide en
  -- galones, pero un turbohelice o un jet se cargan en libras.
  add column if not exists combustible_unidad text not null default 'galones';

alter table public.avn_vuelos drop constraint if exists avn_vuelos_combustible_chk;
alter table public.avn_vuelos add constraint avn_vuelos_combustible_chk
  check (
    combustible_unidad in ('galones', 'libras')
    and (combustible_cantidad is null or combustible_cantidad >= 0)
  );

comment on column public.avn_vuelos.combustible_cantidad is
  'Lo que reporta el piloto que se cargo. Solo la cantidad: el vale y la factura viven en avn_combustible_registros y no van uno a uno con los vuelos.';

NOTIFY pgrst, 'reload schema';

-- Fase 22 · Servicio Renta de Vehículo según TT_SERVICIOS-Renta_de_Vehículos.docx
--
-- La tabla ya traía casi todo desde la Fase 19: rentadora, contacto, reserva,
-- recepción y entrega con fecha, hora y dirección, días, tarifa, depósito,
-- extras en JSONB, cancelación y pago.
--
-- Lo que falta es el desglose del vehículo. El documento lo pide como siete
-- datos concretos bajo "Tipo de vehículo" — marca, modelo, tamaño, capacidad,
-- puertas, transmisión y combustible — y hoy todo eso cabría solo en el texto
-- libre `tipo_veh`, donde no se puede filtrar ni comparar.

alter table public.att_rentas
  add column if not exists marca text,
  add column if not exists modelo text,
  add column if not exists tamano text,
  add column if not exists capacidad text,
  add column if not exists puertas int,
  add column if not exists transmision text,
  add column if not exists combustible text,
  add column if not exists confirmacion_path text;

comment on column public.att_rentas.confirm_file_name is
  'DEPRECADA (fase 22) — solo guardaba el nombre del archivo. Usar confirmacion_path, que apunta al bucket tt-documentos.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'att_rentas_transmision_chk') then
    alter table public.att_rentas add constraint att_rentas_transmision_chk
      check (transmision is null or transmision in ('Mecánico', 'Automático'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'att_rentas_combustible_chk') then
    alter table public.att_rentas add constraint att_rentas_combustible_chk
      check (combustible is null or combustible in ('Gasolina', 'Eléctrico', 'Híbrido'));
  end if;

  -- Lista unificada. La tabla está vacía, así que no invalida nada.
  if not exists (select 1 from pg_constraint where conname = 'att_rentas_estado_pago_chk') then
    alter table public.att_rentas add constraint att_rentas_estado_pago_chk
      check (estado_pago is null or estado_pago in
        ('HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'));
  end if;
end $$;

comment on column public.att_rentas.extras is
  'JSONB [{label, amount}] — seguros, sillas para niños, etc.';

NOTIFY pgrst, 'reload schema';

-- Segunda pasada: la tabla no tenía `moneda`. El documento pide montos en US$
-- pero el usuario decidió conservar el selector de moneda en todos los
-- servicios, así que hace falta la columna.
alter table public.att_rentas
  add column if not exists moneda public.currency default 'USD';

NOTIFY pgrst, 'reload schema';

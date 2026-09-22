-- Fase 22 · Servicio Restaurante según TT_SERVICIOS-Restaurantes.docx
--
-- El restaurante ya traía desde la Fase 13 sus tres sub-tablas — comensales,
-- servicios adicionales y registros de pago — que es justo lo que pide el
-- documento. Faltan campos del encabezado y las dos condicionantes: Michelin
-- con estrellas y cancelación gratuita con fecha límite.

-- ============================================================
-- 1) att_restaurantes
-- ============================================================
alter table public.att_restaurantes
  add column if not exists michelin boolean,
  add column if not exists tiempo_espera text,
  add column if not exists tipo_servicio text,
  add column if not exists reservado_por text,
  add column if not exists cancelacion_gratuita boolean,
  add column if not exists cancelacion_fecha date,
  add column if not exists tarifa_pax numeric(14,2),
  add column if not exists estatus_pago text,
  add column if not exists estado_pago text,
  add column if not exists pagado_con text,
  add column if not exists confirmacion_path text;

comment on column public.att_restaurantes.tarifa_pax is
  'Tarifa por persona. El total de la reserva es tarifa_pax × covers.';
comment on column public.att_restaurantes.monto is
  'Derivado: (tarifa_pax × covers) + servicios adicionales.';
comment on column public.att_restaurantes.cancelacion_fecha is
  'Fecha límite de cancelación gratuita. La UI avisa cuando se acerca.';
comment on column public.att_restaurantes.cancel_policy is
  'Penalidad por cancelación, cuando NO hay cancelación gratuita.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'att_restaurantes_estado_pago_chk') then
    alter table public.att_restaurantes add constraint att_restaurantes_estado_pago_chk
      check (estado_pago is null or estado_pago in
        ('HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'));
  end if;

  -- Las estrellas solo tienen sentido si el restaurante es Michelin.
  if not exists (select 1 from pg_constraint where conname = 'att_restaurantes_stars_chk') then
    alter table public.att_restaurantes add constraint att_restaurantes_stars_chk
      check (stars is null or stars between 0 and 3);
  end if;
end $$;

-- ============================================================
-- 2) att_restaurant_diners — le faltaba `updated_at`
--
--    Es la única sub-tabla del módulo sin marca de modificación: tiene
--    created_at y updated_by, pero no updated_at, así que nunca se supo
--    cuándo se cambió un comensal. Se agrega junto con su trigger para que
--    quede igual que las demás.
-- ============================================================
alter table public.att_restaurant_diners
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists att_restaurant_diners_updated_at_trg on public.att_restaurant_diners;
create trigger att_restaurant_diners_updated_at_trg
  before update on public.att_restaurant_diners
  for each row execute function public.set_updated_at_with_by();

NOTIFY pgrst, 'reload schema';

-- Pagos · la notificacion lleva la entidad que paga
--
-- Una solicitud de pago es un tramite contable de una ENTIDAD, nunca de una
-- persona --regla del usuario, 2026-11-03--. Y para poder juntar varias
-- liquidaciones en una sola solicitud hay que saber, en el panel y sin
-- consultar otra tabla, si todas las paga la misma.
--
-- Por eso la notificacion se lleva la entidad denormalizada, igual que
-- `att_cargos` se lleva el viaje: el panel las agrupa de un vistazo.

alter table public.pagos_notificaciones
  add column if not exists entidad_id uuid references public.entidades(id);

comment on column public.pagos_notificaciones.entidad_id is
  'Entidad que paga el origen. Dos notificaciones solo pueden ir en la misma solicitud si coinciden en esto.';

-- Lo ya despachado desde una liquidacion toma la entidad de su origen.
update public.pagos_notificaciones n
   set entidad_id = l.paga_entidad_id
  from public.caja_chica_liquidaciones l
 where n.origen_tipo = 'liquidacion'
   and n.origen_id = l.id
   and n.entidad_id is null
   and l.paga_entidad_id is not null;

NOTIFY pgrst, 'reload schema';

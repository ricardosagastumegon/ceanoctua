-- T&T · Crucero · pasajeros del camarote y numero de reserva
--
-- Dos huecos que aparecieron al cargar el primer crucero real:
--
-- 1. No habia donde anotar quien viaja en cada camarote. El usuario termino
--    creando un camarote por persona, que es lo unico que la pantalla
--    permitia, y la hoja quedo diciendo que los dos iban en el mismo.
--    Se resuelve como en el ticket aereo y en las actividades: una fila por
--    persona, no un texto con nombres separados por coma. Asi se puede
--    filtrar y exportar despues.
--
-- 2. La reserva del camarote tiene su propio numero --lo da la naviera por
--    camarote, no por crucero-- y no habia columna para el.

alter table public.att_crucero_camarotes
  add column if not exists reserva_numero text;

comment on column public.att_crucero_camarotes.reserva_numero is
  'El numero que da la naviera para ESTE camarote. El del crucero completo va en att_cruceros.confirmacion.';

create table if not exists public.att_crucero_pax (
  id uuid primary key default gen_random_uuid(),
  camarote_id uuid not null references public.att_crucero_camarotes(id) on delete cascade,

  nombre text,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists att_crucero_pax_idx
  on public.att_crucero_pax (camarote_id, orden) where deleted_at is null;

comment on table public.att_crucero_pax is
  'Quien viaja en cada camarote. Una fila por persona para poder filtrar y exportar.';

drop trigger if exists set_updated_at_att_crucero_pax on public.att_crucero_pax;
create trigger set_updated_at_att_crucero_pax before update on public.att_crucero_pax
  for each row execute function public.set_updated_at();

drop trigger if exists audit_att_crucero_pax on public.att_crucero_pax;
create trigger audit_att_crucero_pax after insert or update or delete
  on public.att_crucero_pax for each row execute function public.audit_trigger();

-- RLS · patron A de T&T, igual que las otras tres tablas del crucero.
alter table public.att_crucero_pax enable row level security;

drop policy if exists att_crucero_pax_read on public.att_crucero_pax;
create policy att_crucero_pax_read on public.att_crucero_pax for select
  using (public.puede('tt', 'observador'));
drop policy if exists att_crucero_pax_write on public.att_crucero_pax;
create policy att_crucero_pax_write on public.att_crucero_pax for all
  using (public.puede('tt', 'editor')) with check (public.puede('tt', 'editor'));

NOTIFY pgrst, 'reload schema';

-- T&T · Servicio de Crucero
--
-- El crucero tiene una estructura propia que ningun otro servicio comparte:
--
--   crucero  →  camarotes  →  pagos y servicios extra
--
-- Dos cosas lo hacen distinto:
--
-- 1. La reserva de un camarote se paga EN ABONOS. El documento lo dice:
--    "Opcion para agregar mas de 1 pago hasta pagar el 100% de la reserva".
--    Cada abono con su propia tarjeta. Es el primer servicio donde el dinero
--    llega a las tarjetas por varios caminos en vez de uno.
--
-- 2. La tarifa es POR PASAJERO y por el crucero completo, no por noche. Un
--    camarote de 2 pasajeros a 1,500 cada uno son 3,000, aunque el crucero
--    dure 7 noches. Confirmado con el usuario el 2026-09-28. Ojo que esto
--    difiere del hotel, donde `tarifa x noches` si es correcto porque ahi la
--    tarifa es por noche: son dos cosas distintas y esta bien que no
--    coincidan.

-- ── 1 · El crucero ────────────────────────────────────────────────────────
create table if not exists public.att_cruceros (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,

  titulo text,                       -- ENCABEZADO DEL SERVICIO
  ship text,
  package_type text,
  fecha_reserva date,
  salida_fecha date,
  salida_hora time,
  retorno_fecha date,
  retorno_hora time,
  noches integer,
  itinerario text,
  cancelacion text,

  moneda text not null default 'USD',
  -- Total de estadia: la suma de los camarotes con sus extras. Lo mantiene el
  -- trigger de abajo; escribirlo a mano se desincroniza en cuanto alguien
  -- edita un camarote.
  monto numeric(14,2) not null default 0,

  -- Columnas comunes de servicio, para que encaje con el itinerario, la
  -- liquidacion y la cancelacion como los otros diez.
  estado_pago text,
  pagado_con text,
  pagado_con_id uuid references public.tarjetas_credito(id),
  fecha_cargo date,
  cancelado_en date,
  reintegro numeric(14,2) not null default 0,
  reintegro_nota text,
  confirmacion text,
  confirmacion_path text,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists att_cruceros_viaje_idx
  on public.att_cruceros (viaje_id, salida_fecha) where deleted_at is null;

alter table public.att_cruceros drop constraint if exists att_cruceros_reintegro_chk;
alter table public.att_cruceros add constraint att_cruceros_reintegro_chk
  check (reintegro >= 0);

-- ── 2 · Los camarotes ─────────────────────────────────────────────────────
create table if not exists public.att_crucero_camarotes (
  id uuid primary key default gen_random_uuid(),
  crucero_id uuid not null references public.att_cruceros(id) on delete cascade,

  reserva_nombre text,
  cubierta text,
  camarote text,
  pax integer not null default 1,
  tipo_hab text,
  alimentacion text,

  tarifa numeric(14,2) not null default 0,   -- por pasajero, crucero completo
  -- Informativo. NO entra en el total: la tarifa es por el crucero, no por
  -- noche. Se guarda porque aparece en el documento del camarote.
  noches integer,

  -- La calcula la base: no hay forma de que quede distinta de sus factores.
  total numeric(14,2) generated always as (round(tarifa * pax, 2)) stored,

  orden integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists att_crucero_camarotes_idx
  on public.att_crucero_camarotes (crucero_id, orden) where deleted_at is null;

alter table public.att_crucero_camarotes drop constraint if exists att_crucero_camarotes_chk;
alter table public.att_crucero_camarotes add constraint att_crucero_camarotes_chk
  check (pax >= 0 and tarifa >= 0);

comment on column public.att_crucero_camarotes.tarifa is
  'Por pasajero y por el crucero completo. El total del camarote es tarifa x pax; las noches NO entran.';
comment on column public.att_crucero_camarotes.noches is
  'Informativo. No entra en el calculo del total.';

-- ── 3 · Abonos y servicios extra del camarote ─────────────────────────────
-- Los dos tienen la misma forma --monto, tarjeta, fecha, comentario-- y los
-- dos son dinero que llega a una tarjeta. Lo unico que cambia es si abona a
-- la reserva o si suma encima, y eso lo dice `clase`.
create table if not exists public.att_crucero_pagos (
  id uuid primary key default gen_random_uuid(),
  camarote_id uuid not null references public.att_crucero_camarotes(id) on delete cascade,

  clase text not null default 'pago',        -- 'pago' | 'extra'
  descripcion text,                          -- obligatoria en los extras
  monto numeric(14,2) not null default 0,

  pagado_con text,                           -- texto historico
  pagado_con_id uuid references public.tarjetas_credito(id),
  fecha_pago date,
  comentario text,

  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists att_crucero_pagos_idx
  on public.att_crucero_pagos (camarote_id, clase, orden) where deleted_at is null;

alter table public.att_crucero_pagos drop constraint if exists att_crucero_pagos_chk;
alter table public.att_crucero_pagos add constraint att_crucero_pagos_chk
  check (clase in ('pago', 'extra') and monto >= 0);

comment on table public.att_crucero_pagos is
  'Abonos y servicios extra de un camarote. Un abono paga parte de la reserva; un extra suma encima. Los dos llevan su propia tarjeta y su propia fecha.';

-- ── 4 · El total del crucero lo lleva la base ─────────────────────────────
create or replace function public.att_crucero_recalcular()
returns trigger
language plpgsql
as $function$
declare
  cru uuid;
begin
  -- Segun de donde venga el cambio, hay que averiguar el crucero.
  if TG_TABLE_NAME = 'att_crucero_camarotes' then
    cru := coalesce(new.crucero_id, old.crucero_id);
  else
    select c.crucero_id into cru
      from public.att_crucero_camarotes c
     where c.id = coalesce(new.camarote_id, old.camarote_id);
  end if;

  if cru is null then
    return null;
  end if;

  update public.att_cruceros cr
     set monto = coalesce((
           select sum(cam.total)
             from public.att_crucero_camarotes cam
            where cam.crucero_id = cru and cam.deleted_at is null
         ), 0)
         + coalesce((
           select sum(p.monto)
             from public.att_crucero_pagos p
             join public.att_crucero_camarotes cam on cam.id = p.camarote_id
            where cam.crucero_id = cru
              and p.clase = 'extra'
              and p.deleted_at is null
              and cam.deleted_at is null
         ), 0)
   where cr.id = cru;
  return null;
end;
$function$;

drop trigger if exists att_crucero_total_camarotes on public.att_crucero_camarotes;
create trigger att_crucero_total_camarotes
  after insert or update or delete on public.att_crucero_camarotes
  for each row execute function public.att_crucero_recalcular();

drop trigger if exists att_crucero_total_pagos on public.att_crucero_pagos;
create trigger att_crucero_total_pagos
  after insert or update or delete on public.att_crucero_pagos
  for each row execute function public.att_crucero_recalcular();

-- ── 5 · Triggers comunes ──────────────────────────────────────────────────
drop trigger if exists set_updated_at_att_cruceros on public.att_cruceros;
create trigger set_updated_at_att_cruceros before update on public.att_cruceros
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_att_crucero_camarotes on public.att_crucero_camarotes;
create trigger set_updated_at_att_crucero_camarotes before update on public.att_crucero_camarotes
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_att_crucero_pagos on public.att_crucero_pagos;
create trigger set_updated_at_att_crucero_pagos before update on public.att_crucero_pagos
  for each row execute function public.set_updated_at();

drop trigger if exists audit_att_cruceros on public.att_cruceros;
create trigger audit_att_cruceros after insert or update or delete
  on public.att_cruceros for each row execute function public.audit_trigger();
drop trigger if exists audit_att_crucero_camarotes on public.att_crucero_camarotes;
create trigger audit_att_crucero_camarotes after insert or update or delete
  on public.att_crucero_camarotes for each row execute function public.audit_trigger();
drop trigger if exists audit_att_crucero_pagos on public.att_crucero_pagos;
create trigger audit_att_crucero_pagos after insert or update or delete
  on public.att_crucero_pagos for each row execute function public.audit_trigger();

-- ── 6 · RLS · patron A de T&T ─────────────────────────────────────────────
alter table public.att_cruceros enable row level security;
alter table public.att_crucero_camarotes enable row level security;
alter table public.att_crucero_pagos enable row level security;

drop policy if exists att_cruceros_read on public.att_cruceros;
create policy att_cruceros_read on public.att_cruceros for select
  using (public.puede('tt', 'observador'));
drop policy if exists att_cruceros_write on public.att_cruceros;
create policy att_cruceros_write on public.att_cruceros for all
  using (public.puede('tt', 'editor')) with check (public.puede('tt', 'editor'));

drop policy if exists att_crucero_camarotes_read on public.att_crucero_camarotes;
create policy att_crucero_camarotes_read on public.att_crucero_camarotes for select
  using (public.puede('tt', 'observador'));
drop policy if exists att_crucero_camarotes_write on public.att_crucero_camarotes;
create policy att_crucero_camarotes_write on public.att_crucero_camarotes for all
  using (public.puede('tt', 'editor')) with check (public.puede('tt', 'editor'));

drop policy if exists att_crucero_pagos_read on public.att_crucero_pagos;
create policy att_crucero_pagos_read on public.att_crucero_pagos for select
  using (public.puede('tt', 'observador'));
drop policy if exists att_crucero_pagos_write on public.att_crucero_pagos;
create policy att_crucero_pagos_write on public.att_crucero_pagos for all
  using (public.puede('tt', 'editor')) with check (public.puede('tt', 'editor'));

-- ── 7 · El crucero tambien puede llevar cargos a nivel de servicio ────────
alter table public.att_cargos drop constraint if exists att_cargos_tipo_chk;
alter table public.att_cargos add constraint att_cargos_tipo_chk
  check (servicio_tipo in (
    'tickets','hotel','restaurantes','renta','tours','aeronave',
    'acuatico','ferry','terrestre','actividades','reunion','crucero'
  ));

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Fase 20 · Caja Chica Operativa (nuevo módulo, independiente de "Control Vales")
-- Ver PLAN-CAJA-CHICA.md para el diseño completo.
--
-- 3 tablas:
--   caja_chica_op_periodos       — período con correlativo CCO-YYYY-####
--   caja_chica_op_lineas         — línea de gasto o vale
--   caja_chica_op_vale_facturas  — sub-facturas de un vale liquidado
--
-- Todas: RLS habilitado (Pattern A), audit_log, soft delete, updated_at.
-- Idempotente: safe re-run con `if not exists`.
-- ============================================================================

-- ---------- Sequence + generador CCO-YYYY-#### ----------
create sequence if not exists caja_chica_op_periodo_seq;

create or replace function public.caja_chica_op_next_serial()
returns text language plpgsql as $$
declare
  y int := extract(year from current_date)::int;
  n bigint;
begin
  n := nextval('caja_chica_op_periodo_seq');
  return 'CCO-' || y::text || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ---------- Tabla: períodos ----------
create table if not exists public.caja_chica_op_periodos (
  id           uuid primary key default gen_random_uuid(),
  serial       text unique,
  titulo       text,
  fecha        date not null default current_date,
  monto_inicial numeric(12,2) not null default 0 check (monto_inicial >= 0),
  estado       text not null default 'Abierto' check (estado in ('Abierto','Cerrado')),
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Trigger: asigna serial al insertar si no viene.
create or replace function public.caja_chica_op_periodo_set_serial()
returns trigger language plpgsql as $$
begin
  if new.serial is null or new.serial = '' then
    new.serial := public.caja_chica_op_next_serial();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_caja_chica_op_periodo_serial on public.caja_chica_op_periodos;
create trigger trg_caja_chica_op_periodo_serial
  before insert on public.caja_chica_op_periodos
  for each row execute function public.caja_chica_op_periodo_set_serial();

-- ---------- Tabla: líneas ----------
create table if not exists public.caja_chica_op_lineas (
  id            uuid primary key default gen_random_uuid(),
  periodo_id    uuid not null references public.caja_chica_op_periodos(id) on delete cascade,
  fecha         date,
  factura       text,
  nombre        text,
  cantidad      numeric(12,4) default 0,
  p_unitario    numeric(12,4) default 0,
  solicitante   text,
  lugar         text,
  forma_pago    text default 'Caja chica'
                check (forma_pago in ('Efectivo','Caja chica','Transferencia','Cheque','Tarjeta','Vale','Otro')),
  observaciones text,
  foto_url      text,
  vale_estado   text default 'Abierto' check (vale_estado in ('Abierto','Liquidado')),
  orden         int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_cco_lineas_periodo on public.caja_chica_op_lineas(periodo_id) where deleted_at is null;
create index if not exists idx_cco_lineas_vale    on public.caja_chica_op_lineas(periodo_id, vale_estado) where forma_pago = 'Vale' and deleted_at is null;

-- ---------- Tabla: sub-facturas de vale ----------
create table if not exists public.caja_chica_op_vale_facturas (
  id          uuid primary key default gen_random_uuid(),
  linea_id    uuid not null references public.caja_chica_op_lineas(id) on delete cascade,
  fecha       date,
  factura     text,
  nombre      text,
  cantidad    numeric(12,4) default 0,
  p_unitario  numeric(12,4) default 0,
  foto_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_cco_vale_facturas_linea on public.caja_chica_op_vale_facturas(linea_id) where deleted_at is null;

-- ---------- Trigger updated_at genérico ----------
-- Reutiliza public.set_updated_at() si ya existe (creado en fases anteriores),
-- si no lo crea local para no romper si es la primera fase que lo usa.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_cco_periodos_updated_at on public.caja_chica_op_periodos;
create trigger trg_cco_periodos_updated_at
  before update on public.caja_chica_op_periodos
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cco_lineas_updated_at on public.caja_chica_op_lineas;
create trigger trg_cco_lineas_updated_at
  before update on public.caja_chica_op_lineas
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cco_vale_facturas_updated_at on public.caja_chica_op_vale_facturas;
create trigger trg_cco_vale_facturas_updated_at
  before update on public.caja_chica_op_vale_facturas
  for each row execute function public.set_updated_at();

-- ---------- RLS: Pattern A (Financial) ----------
alter table public.caja_chica_op_periodos      enable row level security;
alter table public.caja_chica_op_lineas        enable row level security;
alter table public.caja_chica_op_vale_facturas enable row level security;

drop policy if exists cco_periodos_read      on public.caja_chica_op_periodos;
drop policy if exists cco_periodos_write     on public.caja_chica_op_periodos;
drop policy if exists cco_lineas_read        on public.caja_chica_op_lineas;
drop policy if exists cco_lineas_write       on public.caja_chica_op_lineas;
drop policy if exists cco_vale_fact_read     on public.caja_chica_op_vale_facturas;
drop policy if exists cco_vale_fact_write    on public.caja_chica_op_vale_facturas;

create policy cco_periodos_read on public.caja_chica_op_periodos
  for select using (public.auth_rol() in ('admin','asistente'));
create policy cco_periodos_write on public.caja_chica_op_periodos
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

create policy cco_lineas_read on public.caja_chica_op_lineas
  for select using (public.auth_rol() in ('admin','asistente'));
create policy cco_lineas_write on public.caja_chica_op_lineas
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

create policy cco_vale_fact_read on public.caja_chica_op_vale_facturas
  for select using (public.auth_rol() in ('admin','asistente'));
create policy cco_vale_fact_write on public.caja_chica_op_vale_facturas
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- ---------- Audit log ----------
-- Reusa la función public.audit_trigger() creada en 20260524000004_audit_triggers.sql.
-- Solo se enganchan los triggers.
drop trigger if exists trg_audit_cco_periodos      on public.caja_chica_op_periodos;
drop trigger if exists trg_audit_cco_lineas        on public.caja_chica_op_lineas;
drop trigger if exists trg_audit_cco_vale_facturas on public.caja_chica_op_vale_facturas;

create trigger trg_audit_cco_periodos
  after insert or update or delete on public.caja_chica_op_periodos
  for each row execute function public.audit_trigger();

create trigger trg_audit_cco_lineas
  after insert or update or delete on public.caja_chica_op_lineas
  for each row execute function public.audit_trigger();

create trigger trg_audit_cco_vale_facturas
  after insert or update or delete on public.caja_chica_op_vale_facturas
  for each row execute function public.audit_trigger();

-- ---------- Fuerza reload del schema en PostgREST ----------
notify pgrst, 'reload schema';

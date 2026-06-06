-- Phase 16 (Refactor Finanzas · F-0 · Reorganización estructural)
-- Spec: PLAN-FINANZAS-REFACTOR.md, sección F-0.
--
-- Alcance de esta migración:
--   * Crear tabla `status_solicitud_pago` (catálogo nuevo en Admin)
--   * Sembrar los 6 valores en orden
--
-- NO toca: vales, liquidaciones, consumos, pagos, vouchers. Eso viene en F-1..F-5.

BEGIN;

------------------------------------------------------------------
-- 1) Catálogo Status Solicitud de Pago
------------------------------------------------------------------
create table if not exists public.status_solicitud_pago (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  orden       int not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger updated_at (asume helper set_updated_at de fase 1)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_status_sp_updated_at'
    ) then
      execute 'create trigger trg_status_sp_updated_at
               before update on public.status_solicitud_pago
               for each row execute function public.set_updated_at()';
    end if;
  end if;
end $$;

-- RLS: read auth, write admin (catálogo)
alter table public.status_solicitud_pago enable row level security;
drop policy if exists status_sp_read on public.status_solicitud_pago;
drop policy if exists status_sp_write on public.status_solicitud_pago;
create policy status_sp_read on public.status_solicitud_pago
  for select using (auth.uid() is not null);
create policy status_sp_write on public.status_solicitud_pago
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

------------------------------------------------------------------
-- 2) Seed inicial (6 valores en orden)
------------------------------------------------------------------
insert into public.status_solicitud_pago (nombre, orden)
select * from (values
  ('Generado',              1),
  ('En Solicitud de Firma', 2),
  ('Firmado',               3),
  ('Presentado',            4),
  ('Procesado',             5),
  ('Pagado',                6)
) as v(nombre, orden)
where not exists (
  select 1 from public.status_solicitud_pago s where s.nombre = v.nombre
);

COMMIT;

-- Verificación:
--   select * from status_solicitud_pago order by orden;
--   -> 6 filas, Generado (1) → Pagado (6).

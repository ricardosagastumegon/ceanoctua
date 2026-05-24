-- Phase 15 — Modelo "Personal JD" (tabla `personas`)
-- Reemplaza la tabla `autorizadores` por una tabla única `personas` con
-- flags de rol (es_jd, es_autorizador, es_firmante). Migra los FK de
-- tc_consumos/reintegros/pagos para que `autorizador_id` apunte a
-- `personas`. Enlaza miembros_board.persona_id ↔ personas.
--
-- Estrategia segura:
--   1. Crear personas + seed
--   2. Agregar miembros_board.persona_id (enlace por iniciales = codigo)
--   3. Agregar columna nueva *_autorizador_persona_id en cada tabla,
--      poblar desde autorizadores via JOIN por nombre
--   4. Soltar FK + columna autorizador_id existente
--   5. Renombrar *_autorizador_persona_id → autorizador_id
--   6. Soltar columnas de texto `autorizo`
--   7. Soltar tabla autorizadores
--
-- Idempotente vía DO blocks.

BEGIN;

------------------------------------------------------------------
-- 1) Tabla personas
------------------------------------------------------------------
create table if not exists public.personas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  iniciales       text unique,
  nit             text,
  dir             text,
  es_jd           boolean not null default false,
  es_autorizador  boolean not null default false,
  es_firmante     boolean not null default false,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists personas_es_autorizador_idx on public.personas(es_autorizador) where es_autorizador;
create index if not exists personas_es_jd_idx on public.personas(es_jd) where es_jd;

-- trigger updated_at (asume helper set_updated_at de fase 1)
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    if not exists (
      select 1 from pg_trigger where tgname = 'trg_personas_updated_at'
    ) then
      execute 'create trigger trg_personas_updated_at
               before update on public.personas
               for each row execute function public.set_updated_at()';
    end if;
  end if;
end $$;

-- RLS Pattern C: read auth, write admin (catálogo sensible)
alter table public.personas enable row level security;
drop policy if exists personas_read on public.personas;
drop policy if exists personas_write on public.personas;
create policy personas_read on public.personas for select using (auth.uid() is not null);
create policy personas_write on public.personas for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

------------------------------------------------------------------
-- 2) Seed inicial (7 personas: 6 JD + Rodrigo Santos)
--    EG queda pendiente — el usuario debe agregarlo manualmente
--    cuando confirme el nombre real.
------------------------------------------------------------------
insert into public.personas (nombre, iniciales, nit, dir, es_jd, es_autorizador, es_firmante)
select * from (values
  ('Miguel Angel Arriaza', 'MAA',  NULL,        NULL, true,  true,  true),
  ('Javier Arriaza',       'JA',   '24774510',  NULL, true,  true,  true),
  ('Lissa Arriaza',        'LA',   '7858186-9', NULL, true,  true,  true),
  ('Jose Miguel Arriaza',  'JM',   NULL,        NULL, true,  true,  true),
  ('Alejandro Arriaza',    'AA',   '79101526',  NULL, true,  true,  true),
  ('Patricia Esquivel',    'PE',   NULL,        NULL, true,  true,  true),
  ('Rodrigo Santos',       NULL,   '1824658-3', NULL, false, true,  false)
) as v(nombre, iniciales, nit, dir, es_jd, es_autorizador, es_firmante)
where not exists (select 1 from public.personas p where lower(p.nombre) = lower(v.nombre));

------------------------------------------------------------------
-- 3) miembros_board.persona_id
------------------------------------------------------------------
alter table public.miembros_board
  add column if not exists persona_id uuid references public.personas(id);

update public.miembros_board mb
   set persona_id = p.id
  from public.personas p
 where p.iniciales = mb.codigo
   and mb.persona_id is null;

------------------------------------------------------------------
-- 4) tc_consumos · re-apuntar autorizador_id a personas
------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tc_consumos' and column_name='autorizador_persona_id'
  ) then
    alter table public.tc_consumos add column autorizador_persona_id uuid references public.personas(id);
  end if;
end $$;

-- Migra datos desde autorizadores → personas via nombre (case-insensitive,
-- trim). Si no hay match, queda NULL.
update public.tc_consumos tc
   set autorizador_persona_id = p.id
  from public.autorizadores a
  join public.personas p on lower(trim(p.nombre)) = lower(trim(a.nombre))
 where tc.autorizador_id = a.id
   and tc.autorizador_persona_id is null;

-- Soltar FK + columna vieja
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tc_consumos' and column_name='autorizador_id'
  ) then
    alter table public.tc_consumos drop column autorizador_id cascade;
  end if;
end $$;

-- Renombrar y soltar texto
alter table public.tc_consumos rename column autorizador_persona_id to autorizador_id;
alter table public.tc_consumos drop column if exists autorizo;

------------------------------------------------------------------
-- 5) reintegros · idem
------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reintegros' and column_name='autorizador_persona_id'
  ) then
    alter table public.reintegros add column autorizador_persona_id uuid references public.personas(id);
  end if;
end $$;

update public.reintegros r
   set autorizador_persona_id = p.id
  from public.autorizadores a
  join public.personas p on lower(trim(p.nombre)) = lower(trim(a.nombre))
 where r.autorizador_id = a.id
   and r.autorizador_persona_id is null;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reintegros' and column_name='autorizador_id'
  ) then
    alter table public.reintegros drop column autorizador_id cascade;
  end if;
end $$;

alter table public.reintegros rename column autorizador_persona_id to autorizador_id;
alter table public.reintegros drop column if exists autorizo;

------------------------------------------------------------------
-- 6) pagos · idem (el plan menciona solo tc_consumos/reintegros pero
--    pagos también tiene la misma estructura — incluirlo es consistente)
------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pagos' and column_name='autorizador_persona_id'
  ) then
    alter table public.pagos add column autorizador_persona_id uuid references public.personas(id);
  end if;
end $$;

update public.pagos pg
   set autorizador_persona_id = p.id
  from public.autorizadores a
  join public.personas p on lower(trim(p.nombre)) = lower(trim(a.nombre))
 where pg.autorizador_id = a.id
   and pg.autorizador_persona_id is null;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pagos' and column_name='autorizador_id'
  ) then
    alter table public.pagos drop column autorizador_id cascade;
  end if;
end $$;

alter table public.pagos rename column autorizador_persona_id to autorizador_id;
alter table public.pagos drop column if exists autorizo;

------------------------------------------------------------------
-- 7) Drop autorizadores (ya no quedan referencias)
------------------------------------------------------------------
drop table if exists public.autorizadores cascade;

------------------------------------------------------------------
-- 8) Índices auxiliares para el nuevo autorizador_id
------------------------------------------------------------------
create index if not exists tc_consumos_autorizador_idx on public.tc_consumos(autorizador_id);
create index if not exists reintegros_autorizador_idx  on public.reintegros(autorizador_id);
create index if not exists pagos_autorizador_idx       on public.pagos(autorizador_id);

COMMIT;

-- Verificación rápida (correr aparte):
--   select count(*) from personas;                                    -- 7
--   select count(*) from miembros_board where persona_id is not null; -- 6
--   select count(*) from autorizadores;                               -- error: tabla no existe

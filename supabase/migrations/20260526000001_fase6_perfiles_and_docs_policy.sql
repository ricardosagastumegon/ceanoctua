-- Phase 6 - Adjustments
-- 1) Align perfiles* tables with PLAN-FASE-6.md exact fields
-- 2) Expand documentos / storage policies so board_member can attach files
--    (eventos and similar where they own the parent record)

-- ============================================================
-- perfiles: personal profile fields (one per miembro)
-- ============================================================

-- Drop placeholder columns from Fase 2 that were guesses, since the real
-- profile has very different fields. Empty data, safe to drop.
alter table public.perfiles drop column if exists nombre;
alter table public.perfiles drop column if exists alias;
alter table public.perfiles drop column if exists parentesco;

-- fecha_nac was the board member's bday — rename to align with plan
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='perfiles' and column_name='fecha_nac')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='perfiles' and column_name='bday') then
    alter table public.perfiles rename column fecha_nac to bday;
  end if;
end;
$$;

alter table public.perfiles add column if not exists phone text;
alter table public.perfiles add column if not exists telco text;
alter table public.perfiles add column if not exists email text;
alter table public.perfiles add column if not exists address text;
alter table public.perfiles add column if not exists nit text;
alter table public.perfiles add column if not exists dpi text;
alter table public.perfiles add column if not exists pilot_name text;
alter table public.perfiles add column if not exists pilot_phone text;

-- One perfil per miembro
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.perfiles'::regclass and conname = 'perfiles_miembro_id_key'
  ) then
    alter table public.perfiles add constraint perfiles_miembro_id_key unique (miembro_id);
  end if;
end;
$$;

-- ============================================================
-- perfil_vehiculos: trim extras; align with plan (model, plate)
-- ============================================================
alter table public.perfil_vehiculos drop column if exists marca;
alter table public.perfil_vehiculos drop column if exists anio;
alter table public.perfil_vehiculos drop column if exists color;
alter table public.perfil_vehiculos drop column if exists vin;
alter table public.perfil_vehiculos drop column if exists notas;

-- ============================================================
-- perfil_familia: trim extras (plan = name, relation, bday)
-- ============================================================
alter table public.perfil_familia drop column if exists notas;

-- ============================================================
-- perfil_fechas: trim extras (plan = label, date)
-- ============================================================
alter table public.perfil_fechas drop column if exists notas;
alter table public.perfil_fechas drop column if exists recurrente;

-- ============================================================
-- documentos: allow board_member to write (so they can attach docs
-- to their own events / notes / etc.). RLS on the parent table
-- (eventos, etc.) still protects which rows they can see.
-- ============================================================
drop policy if exists documentos_write on public.documentos;
create policy documentos_write on public.documentos for all
  using ( public.auth_rol() in ('admin','asistente','board_member') )
  with check ( public.auth_rol() in ('admin','asistente','board_member') );

-- Storage bucket 'documentos': allow board_member insert/update/delete
drop policy if exists "documentos insert admin asistente" on storage.objects;
drop policy if exists "documentos update admin asistente" on storage.objects;
drop policy if exists "documentos delete admin asistente" on storage.objects;

create policy "documentos insert"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente','board_member')
  );

create policy "documentos update"
  on storage.objects for update
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente','board_member')
  )
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente','board_member')
  );

create policy "documentos delete"
  on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente','board_member')
  );

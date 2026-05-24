-- Phase 3 - Migration 0001
-- App role enum, usuarios profile table, trigger to auto-create profile,
-- helper functions auth_rol() / es_admin() / mi_miembro_id().

create type app_rol as enum ('admin','asistente','board_member','solo_lectura');

create table public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text,
  rol         app_rol not null default 'solo_lectura',
  miembro_id  uuid references public.miembros_board(id),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index usuarios_miembro_idx on public.usuarios (miembro_id);

alter table public.usuarios enable row level security;

-- Auto-create a profile row whenever a Supabase auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre)
  values (new.id, new.raw_user_meta_data->>'nombre')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: rol of the current user. SECURITY DEFINER so RLS on usuarios
-- does not block lookup, and STABLE so Postgres caches it within a query.
create or replace function public.auth_rol()
returns app_rol
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_rol() = 'admin', false);
$$;

create or replace function public.mi_miembro_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select miembro_id from public.usuarios where id = auth.uid();
$$;

-- usuarios RLS: a user sees and edits their own row; admin sees all.
create policy usuarios_select on public.usuarios for select
  using ( id = auth.uid() or public.es_admin() );

create policy usuarios_self_update on public.usuarios for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() and rol = (select rol from public.usuarios u where u.id = auth.uid()) );
-- ^ a user can update their own row but cannot change their own rol.

create policy usuarios_admin_all on public.usuarios for all
  using ( public.es_admin() )
  with check ( public.es_admin() );

-- Attach the updated_at trigger to usuarios (Phase 2 helper).
drop trigger if exists set_updated_at_usuarios on public.usuarios;
create trigger set_updated_at_usuarios
  before update on public.usuarios
  for each row execute function public.set_updated_at();

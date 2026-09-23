-- Permisos por usuario y modulo.
--
-- Pedido del usuario: dar acceso a CEA a los miembros de la junta, escogiendo
-- a que modulo entra cada uno. El primer caso es MAA viendo T&T completo, sin
-- poder modificar nada.
--
-- Por que esto vive en la base y no en el menu: la llave `anon` de Supabase
-- viaja en el navegador y es publica por diseno. Ocultarle una pestana a
-- alguien no le impide consultar esas tablas con su propia sesion. Lo unico
-- que de verdad protege los datos son las politicas, asi que el permiso por
-- modulo tiene que estar aqui.
--
-- Tres niveles, del documento del usuario:
--
--   observador · ve, imprime y descarga. No crea, no edita, no borra.
--   editor     · ademas crea y edita. Es lo que hoy hace la asistente.
--   super      · ademas borra y administra catalogos.
--
-- `admin` queda por encima de todo y no necesita filas aqui.

-- ============================================================
-- 1 · La tabla de permisos
-- ============================================================
create table if not exists public.usuario_modulos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  modulo text not null,
  permiso text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint usuario_modulos_modulo_chk check (modulo in (
    'dashboard', 'tt', 'cea', 'finanzas', 'caja_chica', 'miel_sj', 'admin',
    'maa', 'ja', 'la', 'jm', 'aa', 'eg', 'pe'
  )),
  constraint usuario_modulos_permiso_chk check (permiso in ('observador', 'editor', 'super')),
  constraint usuario_modulos_unico unique (usuario_id, modulo)
);

comment on table public.usuario_modulos is
  'A que modulo entra cada usuario y con que nivel. Los admin no necesitan filas: pueden todo.';

create index if not exists usuario_modulos_usuario_idx on public.usuario_modulos(usuario_id);

-- ============================================================
-- 2 · `puede(modulo, minimo)`
--
-- SECURITY DEFINER a proposito: la funcion tiene que poder leer
-- `usuario_modulos` sin que la politica de esa misma tabla la bloquee, que
-- seria una recursion.
-- ============================================================
create or replace function public.rango_permiso(p text)
returns int
language sql
immutable
as $$
  select case p when 'observador' then 1 when 'editor' then 2 when 'super' then 3 else 0 end;
$$;

create or replace function public.puede(p_modulo text, p_minimo text default 'observador')
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    -- El admin pasa siempre.
    coalesce((select rol = 'admin' from public.usuarios where id = auth.uid()), false)
    or exists (
      select 1
        from public.usuario_modulos um
       where um.usuario_id = auth.uid()
         and um.modulo = p_modulo
         and public.rango_permiso(um.permiso) >= public.rango_permiso(p_minimo)
    );
$$;

comment on function public.puede(text, text) is
  'Si el usuario de la sesion alcanza ese nivel en ese modulo. Los admin siempre.';

-- ============================================================
-- 3 · RLS de la propia tabla de permisos
--
-- Cada quien puede ver sus permisos -- la aplicacion los necesita para armar
-- el menu -- pero solo un admin los otorga o los quita.
-- ============================================================
alter table public.usuario_modulos enable row level security;

drop policy if exists usuario_modulos_read on public.usuario_modulos;
create policy usuario_modulos_read on public.usuario_modulos
  for select using (
    usuario_id = auth.uid()
    or coalesce((select rol = 'admin' from public.usuarios where id = auth.uid()), false)
  );

drop policy if exists usuario_modulos_write on public.usuario_modulos;
create policy usuario_modulos_write on public.usuario_modulos
  for all
  using (public.auth_rol() = 'admin')
  with check (public.auth_rol() = 'admin');

drop trigger if exists usuario_modulos_updated_at_trg on public.usuario_modulos;
create trigger usuario_modulos_updated_at_trg before update on public.usuario_modulos
  for each row execute function public.set_updated_at_with_by();

drop trigger if exists audit_usuario_modulos on public.usuario_modulos;
create trigger audit_usuario_modulos after insert or update or delete on public.usuario_modulos
  for each row execute function public.audit_trigger();

-- ============================================================
-- 4 · Las 35 tablas de T&T pasan a consultar `puede('tt', ...)`
--
-- Leer exige `observador`; escribir exige `editor`. Antes exigian el rol fijo
-- `admin` o `asistente`, que no permitia abrirle el modulo a nadie mas sin
-- darle acceso a toda la aplicacion.
--
-- El resto de los modulos se queda como esta hasta que se abran: cambiar las
-- 145 politicas de una vez seria arriesgar lo que ya funciona.
-- ============================================================
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'att\_%'
  loop
    execute format('alter table public.%I enable row level security', t.relname);

    execute format('drop policy if exists %I on public.%I', t.relname || '_read', t.relname);
    execute format(
      'create policy %I on public.%I for select using (public.puede(''tt'', ''observador''))',
      t.relname || '_read', t.relname
    );

    execute format('drop policy if exists %I on public.%I', t.relname || '_write', t.relname);
    execute format(
      'create policy %I on public.%I for all
         using (public.puede(''tt'', ''editor''))
         with check (public.puede(''tt'', ''editor''))',
      t.relname || '_write', t.relname
    );
  end loop;
end $$;

-- ============================================================
-- 5 · Los catalogos que T&T necesita para mostrarse
--
-- Un observador de T&T tiene que poder leer las tarjetas para que la
-- liquidacion diga con que se pago. Solo lectura: escribir el catalogo sigue
-- siendo de admin y asistente.
-- ============================================================
drop policy if exists tarjetas_credito_read_tt on public.tarjetas_credito;
create policy tarjetas_credito_read_tt on public.tarjetas_credito
  for select using (public.puede('tt', 'observador'));

NOTIFY pgrst, 'reload schema';

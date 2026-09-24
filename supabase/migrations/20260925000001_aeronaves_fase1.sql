-- Modulo Aeronaves · Fase 1 · Ficha de la aeronave y sus certificados
--
-- Administracion y control operativo de las aeronaves. El alcance de esta
-- fase es la ficha de cada aeronave y sus certificados escaneados, cargados
-- uno por ano: "lo unico que necesito es tener en digital y a un click,
-- cualquier certificado".
--
-- La nomenclatura de las columnas sigue la del perfil que usa el usuario
-- --Nombre, Serie, Modelo, Tipo de Aeronave, Tipo de pista, Uso, Pax,
-- Tripulantes, Autonomia, Color, Base de Operaciones-- y no la de un sistema
-- de aeronavegabilidad. Ojo con dos de ellas, que no significan lo que
-- parece: `modelo` es el ANO del modelo (2018) y `color` es el color de
-- pintura de la aeronave, no un color de pantalla.
--
-- No hay control por ciclos ni por componente: el rol aqui es administrativo
-- y eso lo lleva el taller. Vease PLAN-AERONAVES.md.

-- ── El modulo, para el sistema de permisos de la fase 23 ──────────────────
-- 'aeronaves' se suma a los modulos que se pueden asignar por usuario.
-- La funcion `puede()` lee texto libre, asi que no hay enum que ampliar.

-- ── 1 · La ficha de la aeronave ───────────────────────────────────────────
create table if not exists public.avn_aeronaves (
  id uuid primary key default gen_random_uuid(),
  matricula text not null,
  nombre text,                      -- CIRRUS SR22T
  serie text,                       -- numero de fabricacion · 1804
  modelo text,                      -- el ANO del modelo · 2018
  tipo_aeronave text,               -- Monomotor
  tipo_pista text,                  -- A,B,C,D,E,F
  uso text,                         -- Privado - Aviacion General
  pax integer,
  tripulantes integer,
  autonomia text,                   -- "4-6 hrs" · es un rango, no un numero
  color text,                       -- color de pintura · Azul, Gris y Amarillo
  base_operaciones text,            -- Aeropuerto Internacional La Aurora MGGT
  foto_path text,
  -- El color con que se pinta su boton en la pantalla de la flota. Distinto
  -- de `color`, que es el de la aeronave de verdad.
  acento text not null default 'teal',
  estado text not null default 'operativa',
  orden integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists avn_aeronaves_matricula_uniq
  on public.avn_aeronaves (matricula) where deleted_at is null;

alter table public.avn_aeronaves drop constraint if exists avn_aeronaves_estado_chk;
alter table public.avn_aeronaves add constraint avn_aeronaves_estado_chk
  check (estado in ('operativa', 'en mantenimiento', 'fuera de servicio'));

comment on column public.avn_aeronaves.modelo is
  'El ano del modelo (2018), no el nombre del modelo. Asi lo llama el perfil del usuario.';
comment on column public.avn_aeronaves.color is
  'Color de pintura de la aeronave. El color de pantalla es `acento`.';

-- ── 2 · Catalogo de certificados aereos ───────────────────────────────────
-- Vive en Admin, como los demas catalogos. Es la lista de la que se escoge
-- al cargar un documento, para que el nombre no se escriba a mano y dos
-- cargas del mismo certificado no queden con nombres distintos.
create table if not exists public.avn_tipos_certificado (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden integer not null default 99,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists avn_tipos_certificado_nombre_uniq
  on public.avn_tipos_certificado (lower(nombre));

-- Los que aparecen en la documentacion historica DGAC del OBI, sin repetir.
insert into public.avn_tipos_certificado (nombre, orden)
values
  ('Certificado de Aeronavegabilidad', 10),
  ('Solvencia de Pagos DGAC', 20),
  ('Impuesto de Circulacion', 30),
  ('Certificado de Registro de Matricula', 40),
  ('Certificado de Homologacion de Ruido', 50),
  ('Licencia de Estacion de Radio', 60),
  ('Derecho de Inspeccion Matricula GT', 70)
on conflict do nothing;

-- Los nombres van con tilde: esto es texto que se ve en pantalla, no un
-- comentario. Se hace como update aparte para que al reaplicar la migracion
-- se corrijan aunque las filas ya existan.
update public.avn_tipos_certificado set nombre = 'Impuesto de Circulación'
 where lower(nombre) = 'impuesto de circulacion';
update public.avn_tipos_certificado set nombre = 'Certificado de Registro de Matrícula'
 where lower(nombre) = 'certificado de registro de matricula';
update public.avn_tipos_certificado set nombre = 'Certificado de Homologación de Ruido'
 where lower(nombre) = 'certificado de homologacion de ruido';
update public.avn_tipos_certificado set nombre = 'Licencia de Estación de Radio'
 where lower(nombre) = 'licencia de estacion de radio';
update public.avn_tipos_certificado set nombre = 'Derecho de Inspección Matrícula GT'
 where lower(nombre) = 'derecho de inspeccion matricula gt';

-- ── 3 · Los certificados cargados de cada aeronave ────────────────────────
-- Uno por ano y por tipo. El ano es como el usuario los organiza, asi que es
-- obligatorio; el vencimiento es opcional y queda para cuando se quiera
-- avisar con anticipacion.
create table if not exists public.avn_documentos (
  id uuid primary key default gen_random_uuid(),
  aeronave_id uuid not null references public.avn_aeronaves(id) on delete cascade,
  tipo_id uuid not null references public.avn_tipos_certificado(id),
  anio integer not null,
  numero text,
  emision date,
  vence date,
  autoridad text,
  archivo_path text,
  archivo_nombre text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_documentos_aeronave_idx
  on public.avn_documentos (aeronave_id, anio desc) where deleted_at is null;

alter table public.avn_documentos drop constraint if exists avn_documentos_anio_chk;
alter table public.avn_documentos add constraint avn_documentos_anio_chk
  check (anio between 1950 and 2200);

-- ── 4 · Triggers ──────────────────────────────────────────────────────────
drop trigger if exists set_updated_at_avn_aeronaves on public.avn_aeronaves;
create trigger set_updated_at_avn_aeronaves before update on public.avn_aeronaves
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_avn_tipos_certificado on public.avn_tipos_certificado;
create trigger set_updated_at_avn_tipos_certificado before update on public.avn_tipos_certificado
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_avn_documentos on public.avn_documentos;
create trigger set_updated_at_avn_documentos before update on public.avn_documentos
  for each row execute function public.set_updated_at();

drop trigger if exists audit_avn_aeronaves on public.avn_aeronaves;
create trigger audit_avn_aeronaves after insert or update or delete
  on public.avn_aeronaves for each row execute function public.audit_trigger();

drop trigger if exists audit_avn_tipos_certificado on public.avn_tipos_certificado;
create trigger audit_avn_tipos_certificado after insert or update or delete
  on public.avn_tipos_certificado for each row execute function public.audit_trigger();

drop trigger if exists audit_avn_documentos on public.avn_documentos;
create trigger audit_avn_documentos after insert or update or delete
  on public.avn_documentos for each row execute function public.audit_trigger();

-- ── 5 · RLS ───────────────────────────────────────────────────────────────
alter table public.avn_aeronaves enable row level security;
alter table public.avn_tipos_certificado enable row level security;
alter table public.avn_documentos enable row level security;

drop policy if exists avn_aeronaves_read on public.avn_aeronaves;
create policy avn_aeronaves_read on public.avn_aeronaves for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_aeronaves_write on public.avn_aeronaves;
create policy avn_aeronaves_write on public.avn_aeronaves for all
  using (public.puede('aeronaves', 'editor'))
  with check (public.puede('aeronaves', 'editor'));

-- El catalogo lo administra quien entra a Admin, pero lo tiene que poder leer
-- cualquiera que vea el modulo: sin el, el desplegable sale vacio.
drop policy if exists avn_tipos_certificado_read on public.avn_tipos_certificado;
create policy avn_tipos_certificado_read on public.avn_tipos_certificado for select
  using (auth.uid() is not null);
drop policy if exists avn_tipos_certificado_write on public.avn_tipos_certificado;
create policy avn_tipos_certificado_write on public.avn_tipos_certificado for all
  using (public.auth_rol() in ('admin', 'asistente'))
  with check (public.auth_rol() in ('admin', 'asistente'));

drop policy if exists avn_documentos_read on public.avn_documentos;
create policy avn_documentos_read on public.avn_documentos for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_documentos_write on public.avn_documentos;
create policy avn_documentos_write on public.avn_documentos for all
  using (public.puede('aeronaves', 'editor'))
  with check (public.puede('aeronaves', 'editor'));

-- ── 6 · Storage ───────────────────────────────────────────────────────────
-- Bucket propio, privado. Los certificados escaneados no se sirven al mundo.
insert into storage.buckets (id, name, public)
values ('avn-documentos', 'avn-documentos', false)
on conflict (id) do nothing;

drop policy if exists "avn-documentos read" on storage.objects;
create policy "avn-documentos read" on storage.objects for select
  using (bucket_id = 'avn-documentos' and public.puede('aeronaves', 'observador'));

drop policy if exists "avn-documentos insert" on storage.objects;
create policy "avn-documentos insert" on storage.objects for insert
  with check (bucket_id = 'avn-documentos' and public.puede('aeronaves', 'editor'));

drop policy if exists "avn-documentos update" on storage.objects;
create policy "avn-documentos update" on storage.objects for update
  using (bucket_id = 'avn-documentos' and public.puede('aeronaves', 'editor'))
  with check (bucket_id = 'avn-documentos' and public.puede('aeronaves', 'editor'));

drop policy if exists "avn-documentos delete" on storage.objects;
create policy "avn-documentos delete" on storage.objects for delete
  using (bucket_id = 'avn-documentos' and public.puede('aeronaves', 'editor'));

-- ── 7 · El OBI ────────────────────────────────────────────────────────────
-- Los datos del perfil que entrego el usuario. El King Air se registra desde
-- la pantalla cuando toque.
insert into public.avn_aeronaves (
  matricula, nombre, serie, modelo, tipo_aeronave, tipo_pista, uso,
  pax, tripulantes, autonomia, color, base_operaciones, acento, orden
)
values (
  'TG-OBI', 'CIRRUS SR22T', '1804', '2018', 'Monomotor', 'A,B,C,D,E,F',
  'Privado - Aviacion General', 3, 1, '4-6 hrs', 'Azul, Gris y Amarillo',
  'Aeropuerto Internacional La Aurora MGGT', 'teal', 10
)
on conflict do nothing;

update public.avn_aeronaves
   set uso = 'Privado - Aviación General',
       base_operaciones = 'Aeropuerto Internacional La Aurora MGGT'
 where matricula = 'TG-OBI';

NOTIFY pgrst, 'reload schema';

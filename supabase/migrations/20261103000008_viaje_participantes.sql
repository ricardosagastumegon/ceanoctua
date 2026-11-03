-- T&T · Quien va en el viaje: catalogo de invitados y participantes por id
--
-- EL PROBLEMA
--
-- Los participantes de un viaje viven en una sola columna de texto,
-- `att_viajes.acompanantes`, separados por coma. En los seis viajes que hay,
-- el presidente aparece escrito de cuatro formas: «Miguel Angel Arriaza»,
-- «Miguel Arriaza», «Miguel Angel Arriaz» y pegado a otra persona con un `&`.
--
-- Mientras eso sea texto no se puede responder la pregunta que importa: ¿en
-- que viajes va fulano? Y de esa pregunta depende que cada quien vea en
-- Arriaza T&T solo sus viajes.
--
-- QUE CAMBIA
--
-- Los participantes pasan a ser una relacion por id contra dos catalogos:
-- `personas` --Personal JD, que ya existe-- e `invitados`, que nace aqui para
-- la familia y los acompanantes que no son personal.
--
-- POR QUE NO SE GUARDA EL NOMBRE
--
-- Al reves de lo que hicimos con las tarjetas. Un cargo a tarjeta es un recibo
-- cerrado y su etiqueta no se reescribe nunca. La lista de quien va en un
-- viaje es un dato vivo: corregir «Arriaz» a «Arriaza» en el catalogo tiene
-- que corregirlo en los seis viajes, no dejar el error congelado.
--
-- `acompanantes` SE QUEDA
--
-- Ocho pantallas la leen --la tarjeta del viaje, el itinerario, la
-- liquidacion, lo que se comparte, el PDF, el dashboard--. En vez de tocar las
-- ocho, un trigger la mantiene al dia desde la tabla nueva. Se vuelve un campo
-- derivado: nadie lo escribe a mano.

-- ── 1 · Comparar nombres sin tildes ni mayusculas ─────────────────────────
-- Tambien sostiene el indice unico de invitados: «Safié» y «Safie» son la
-- misma persona y no pueden entrar dos veces al catalogo.
create or replace function public.sin_tildes(t text)
returns text language sql immutable as $$
  select lower(trim(translate(
    coalesce(t, ''),
    'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
  )));
$$;

comment on function public.sin_tildes(text) is
  'Nombre normalizado para comparar: sin tildes, sin mayusculas, sin espacios al borde.';

-- ── 2 · Catalogo de invitados ─────────────────────────────────────────────
create table if not exists public.invitados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,

  -- Texto libre a proposito --«Familia», «Socio», «Piloto»--. Sirve para
  -- agrupar la lista cuando crezca, no para decidir nada.
  relacion text,

  empresa text,
  telefono text,
  email text,
  notas text,
  activo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create unique index if not exists invitados_nombre_uq
  on public.invitados (public.sin_tildes(nombre));

comment on table public.invitados is
  'Quien viaja sin ser Personal JD: familia, socios, acompanantes. Catalogo alimentable desde Admin.';
comment on column public.invitados.activo is
  'Falso retira al invitado de las listas sin borrarlo: los viajes viejos lo siguen nombrando.';

drop trigger if exists set_updated_at_invitados on public.invitados;
create trigger set_updated_at_invitados
  before update on public.invitados
  for each row execute function public.set_updated_at();

drop trigger if exists audit_invitados on public.invitados;
create trigger audit_invitados
  after insert or update or delete on public.invitados
  for each row execute function public.audit_trigger();

-- RLS · Patron C (catalogo), igual que `personas`.
alter table public.invitados enable row level security;

drop policy if exists invitados_read on public.invitados;
create policy invitados_read on public.invitados for select
  using (auth.uid() is not null);

drop policy if exists invitados_write on public.invitados;
create policy invitados_write on public.invitados for all
  using (public.auth_rol() in ('admin', 'asistente'))
  with check (public.auth_rol() in ('admin', 'asistente'));

-- ── 3 · Quien va en que viaje ─────────────────────────────────────────────
create table if not exists public.att_viaje_participantes (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,

  -- Uno de los dos, nunca ambos ni ninguno. Un participante siempre sale de
  -- un catalogo: de ahi viene que el nombre se escriba siempre igual.
  persona_id uuid references public.personas(id),
  invitado_id uuid references public.invitados(id),

  -- El orden en que se capturaron, para que la lista impresa no se baraje
  -- sola entre una visita y otra.
  orden integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table public.att_viaje_participantes
  drop constraint if exists att_viaje_participantes_uno_chk;
alter table public.att_viaje_participantes
  add constraint att_viaje_participantes_uno_chk
  check (num_nonnulls(persona_id, invitado_id) = 1);

create unique index if not exists att_viaje_participantes_persona_uq
  on public.att_viaje_participantes (viaje_id, persona_id) where persona_id is not null;
create unique index if not exists att_viaje_participantes_invitado_uq
  on public.att_viaje_participantes (viaje_id, invitado_id) where invitado_id is not null;
create index if not exists att_viaje_participantes_viaje_idx
  on public.att_viaje_participantes (viaje_id);
create index if not exists att_viaje_participantes_persona_idx
  on public.att_viaje_participantes (persona_id) where persona_id is not null;

comment on table public.att_viaje_participantes is
  'Quien va en cada viaje, por id contra personas o invitados. De aqui sale `att_viajes.acompanantes`, que es derivado.';

drop trigger if exists set_updated_at_att_viaje_participantes on public.att_viaje_participantes;
create trigger set_updated_at_att_viaje_participantes
  before update on public.att_viaje_participantes
  for each row execute function public.set_updated_at();

drop trigger if exists audit_att_viaje_participantes on public.att_viaje_participantes;
create trigger audit_att_viaje_participantes
  after insert or update or delete on public.att_viaje_participantes
  for each row execute function public.audit_trigger();

-- RLS · mismo patron que el resto de T&T.
alter table public.att_viaje_participantes enable row level security;

drop policy if exists att_viaje_participantes_read on public.att_viaje_participantes;
create policy att_viaje_participantes_read on public.att_viaje_participantes for select
  using (public.puede('tt', 'observador'));

drop policy if exists att_viaje_participantes_write on public.att_viaje_participantes;
create policy att_viaje_participantes_write on public.att_viaje_participantes for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

-- ── 4 · Mantener `acompanantes` al dia ────────────────────────────────────
-- `security definer` porque tambien corre desde un rename en Admin, donde
-- quien edita el catalogo puede no tener permiso de escritura sobre T&T.
create or replace function public.att_sync_acompanantes(p_viaje uuid)
returns void language sql security definer set search_path = public as $$
  update public.att_viajes v
     set acompanantes = nullif((
           select string_agg(coalesce(pe.nombre, iv.nombre), ', ' order by p.orden, p.created_at)
             from public.att_viaje_participantes p
             left join public.personas  pe on pe.id = p.persona_id
             left join public.invitados iv on iv.id = p.invitado_id
            where p.viaje_id = v.id
         ), '')
   where v.id = p_viaje;
$$;

comment on function public.att_sync_acompanantes(uuid) is
  'Reescribe att_viajes.acompanantes desde att_viaje_participantes. Esa columna es derivada: no se edita a mano.';

create or replace function public.att_participantes_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Si el participante se movio de viaje hay que recalcular los dos.
  if tg_op = 'UPDATE' and new.viaje_id is distinct from old.viaje_id then
    perform public.att_sync_acompanantes(old.viaje_id);
  end if;
  perform public.att_sync_acompanantes(coalesce(new.viaje_id, old.viaje_id));
  return coalesce(new, old);
end $$;

drop trigger if exists att_viaje_participantes_sync on public.att_viaje_participantes;
create trigger att_viaje_participantes_sync
  after insert or update or delete on public.att_viaje_participantes
  for each row execute function public.att_participantes_sync();

-- Corregir un nombre en el catalogo lo corrige en los viajes donde aparece.
create or replace function public.att_sync_acompanantes_por_catalogo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if new.nombre is distinct from old.nombre then
    for v in
      select distinct p.viaje_id
        from public.att_viaje_participantes p
       where (tg_table_name = 'personas'  and p.persona_id  = new.id)
          or (tg_table_name = 'invitados' and p.invitado_id = new.id)
    loop
      perform public.att_sync_acompanantes(v);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists personas_sync_acompanantes on public.personas;
create trigger personas_sync_acompanantes
  after update on public.personas
  for each row execute function public.att_sync_acompanantes_por_catalogo();

drop trigger if exists invitados_sync_acompanantes on public.invitados;
create trigger invitados_sync_acompanantes
  after update on public.invitados
  for each row execute function public.att_sync_acompanantes_por_catalogo();

-- ── 5 · Pasar lo que ya existe ────────────────────────────────────────────
-- Se corre una sola vez: si ya hay participantes capturados no toca nada.
do $$
declare
  v record;
  n record;
  id_persona uuid;
  id_invitado uuid;
  limpio text;
  clave text;
begin
  if exists (select 1 from public.att_viaje_participantes) then
    raise notice 'Ya hay participantes capturados; no se migra nada.';
    return;
  end if;

  for v in
    select id, acompanantes
      from public.att_viajes
     where deleted_at is null
       and coalesce(trim(acompanantes), '') <> ''
  loop
    for n in
      -- Se parte por coma y tambien por `&`: «Miguel Angel Arriaza & Joseph
      -- Cohen» son dos personas, no una pareja que viaja como unidad.
      select trim(x.parte) as parte, x.i
        from regexp_split_to_table(replace(v.acompanantes, '&', ','), ',')
             with ordinality as x(parte, i)
    loop
      limpio := trim(n.parte);
      continue when limpio = '';

      clave := public.sin_tildes(limpio);

      -- Los tres nombres mal escritos del historico, al que corresponde.
      if clave in ('miguel angel arriaz', 'miguel arriaza') then
        clave := 'miguel angel arriaza';
      end if;

      select p.id into id_persona
        from public.personas p
       where public.sin_tildes(p.nombre) = clave
       limit 1;

      if id_persona is not null then
        insert into public.att_viaje_participantes (viaje_id, persona_id, orden)
        values (v.id, id_persona, n.i)
        on conflict do nothing;
        id_persona := null;
        continue;
      end if;

      select i.id into id_invitado
        from public.invitados i
       where public.sin_tildes(i.nombre) = clave
       limit 1;

      if id_invitado is null then
        insert into public.invitados (nombre, relacion)
        values (limpio, 'Por clasificar')
        returning id into id_invitado;
      end if;

      insert into public.att_viaje_participantes (viaje_id, invitado_id, orden)
      values (v.id, id_invitado, n.i)
      on conflict do nothing;
      id_invitado := null;
    end loop;
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';

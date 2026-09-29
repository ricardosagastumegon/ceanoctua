-- CEA · Nota de entrega de documentos
--
-- La constancia de que unos documentos se entregaron: a quien, que dia, quien
-- los entrego y quien los pidio. Hoy se hace en un Word suelto, sin
-- correlativo y sin forma de buscar la de hace tres meses.
--
-- El formato sale del documento que mando la usuaria. Dos detalles suyos que
-- explican el modelo:
--
--  - "Recibido por" NO es un campo: en la hoja se imprime el mismo nombre del
--    encabezado --el de "Para"--, porque quien recibe es a quien iba dirigida.
--    Tenerlo aparte seria invitar a que digan cosas distintas.
--  - "Solicitado por" es opcional y "si se escribe aparece en PDF, si no NO".
--    Por eso la hoja lo esconde cuando viene vacio en vez de imprimir un
--    renglon con una raya.

create sequence if not exists public.cea_notas_entrega_seq;

create or replace function public.cea_notas_entrega_next_serial()
returns text
language plpgsql
as $function$
declare
  y int := extract(year from current_date)::int;
  n bigint;
begin
  n := nextval('public.cea_notas_entrega_seq');
  return 'NED-' || y::text || '-' || lpad(n::text, 4, '0');
end;
$function$;

create table if not exists public.cea_notas_entrega (
  id uuid primary key default gen_random_uuid(),
  serial text,

  fecha date not null default current_date,
  para text not null,                    -- a quien va dirigida; tambien es quien recibe
  departamento text,                     -- el del destinatario

  descripcion text,                      -- DESCRIPCION DE DOCUMENTOS
  notas text,

  entregado_por text,
  entregado_departamento text,
  fecha_entrega date,

  -- Opcional a proposito: si viene vacio, la hoja no lo imprime.
  solicitado_por text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists cea_notas_entrega_idx
  on public.cea_notas_entrega (fecha desc) where deleted_at is null;
create unique index if not exists cea_notas_entrega_serial_unq
  on public.cea_notas_entrega (serial) where serial is not null;

comment on column public.cea_notas_entrega.para is
  'A quien va dirigida. En la hoja impresa es tambien el "Recibido por".';
comment on column public.cea_notas_entrega.solicitado_por is
  'Opcional. Si viene vacio la hoja no imprime el renglon.';

-- ── El correlativo lo pone la base ────────────────────────────────────────
create or replace function public.cea_notas_entrega_set_serial()
returns trigger
language plpgsql
as $function$
begin
  if new.serial is null or new.serial = '' then
    new.serial := public.cea_notas_entrega_next_serial();
  end if;
  return new;
end;
$function$;

drop trigger if exists cea_notas_entrega_serial on public.cea_notas_entrega;
create trigger cea_notas_entrega_serial before insert on public.cea_notas_entrega
  for each row execute function public.cea_notas_entrega_set_serial();

-- ── Triggers comunes ──────────────────────────────────────────────────────
drop trigger if exists set_updated_at_cea_notas_entrega on public.cea_notas_entrega;
create trigger set_updated_at_cea_notas_entrega before update on public.cea_notas_entrega
  for each row execute function public.set_updated_at();

drop trigger if exists audit_cea_notas_entrega on public.cea_notas_entrega;
create trigger audit_cea_notas_entrega after insert or update or delete
  on public.cea_notas_entrega for each row execute function public.audit_trigger();

-- ── RLS · el mismo patron que el resto de CEA ─────────────────────────────
alter table public.cea_notas_entrega enable row level security;

drop policy if exists cea_notas_entrega_read on public.cea_notas_entrega;
create policy cea_notas_entrega_read on public.cea_notas_entrega for select
  using (auth.uid() is not null);
drop policy if exists cea_notas_entrega_write on public.cea_notas_entrega;
create policy cea_notas_entrega_write on public.cea_notas_entrega for all
  using (public.auth_rol() in ('admin', 'asistente'))
  with check (public.auth_rol() in ('admin', 'asistente'));

NOTIFY pgrst, 'reload schema';

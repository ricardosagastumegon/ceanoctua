-- CEA · a quien se le pide la firma
--
-- EL HUECO
--
-- Una firma no tenia destinatario. El tablero de quien firma mostraba TODAS
-- las que estaban en espera, y funcionaba solo porque hay una sola persona
-- que firma. Con un segundo firmante, cada uno veria los documentos del otro
-- y nadie sabria cuales son suyos.
--
-- `firma_miembros` no sirve para esto: liga la firma a miembros del board
-- --MAA, JA, LA...-- que son a quienes representa el documento, no usuarios
-- del sistema que tengan que entrar a firmarlo.
--
-- LO QUE SE AGREGA
--
-- `asignada_a`: el usuario que tiene que firmar. Se elige al pedir la firma,
-- igual que ya se elige en CEA -> Firmas.
--
-- Y una funcion `firmantes()` que lista a quien se le puede pedir. Hace falta
-- porque las politicas de `usuarios` solo dejan a cada quien leer su propia
-- fila: sin esto, nadie que no sea admin podria armar el selector. La funcion
-- devuelve solo id y nombre, que es lo unico que el selector necesita.

alter table public.firmas
  add column if not exists asignada_a uuid references public.usuarios(id);

comment on column public.firmas.asignada_a is
  'Usuario que debe firmar. Su tablero muestra las suyas; el admin las ve todas.';

create index if not exists firmas_asignada_idx on public.firmas(asignada_a)
  where asignada_a is not null;

-- ── Quien puede firmar ───────────────────────────────────────────────────
create or replace function public.firmantes()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = public
as $fn$
  select u.id, u.nombre
    from public.usuarios u
   where u.activo
     and (
       u.rol = 'admin'
       or exists (
         select 1
           from public.usuario_modulos m
          where m.usuario_id = u.id
            and m.modulo = 'cea'
            and public.rango_permiso(m.permiso) >= public.rango_permiso('editor')
       )
     )
   order by u.nombre;
$fn$;

grant execute on function public.firmantes() to authenticated;

-- ── Lo que ya estaba esperando ───────────────────────────────────────────
-- Hoy quien firma es la Gerente Administrativa, asi que lo pendiente queda a
-- su nombre en vez de quedar sin dueno y desaparecer de su tablero.
update public.firmas f
   set asignada_a = u.id
  from public.usuarios u
  join auth.users au on au.id = u.id
 where au.email = 'larriaza@sion.com.gt'
   and f.status_firma = 'en_espera'
   and f.asignada_a is null
   and f.deleted_at is null;

NOTIFY pgrst, 'reload schema';

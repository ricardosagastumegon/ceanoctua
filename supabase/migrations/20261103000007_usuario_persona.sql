-- Usuarios · a que persona de Personal JD corresponde cada cuenta
--
-- EL HUECO
--
-- Los to-dos de CEA se asignan a una persona de Personal JD --`persona_id`,
-- los 38 lo tienen-- pero la cuenta con la que alguien entra no sabe que
-- persona es. Por eso el tablero de quien supervisa mostraba los pendientes
-- de todo el mundo: no habia forma de saber cuales eran suyos.
--
-- `usuarios.miembro_id` no sirve para esto: apunta a `miembros_board` --MAA,
-- JA, LA...-- que son los tableros del board, no las personas que trabajan.
--
-- Se amarra por nombre una sola vez porque hoy coinciden exacto, y de aqui en
-- adelante se elige desde Admin. Quien no tenga persona asociada simplemente
-- no vera to-dos propios, que es mejor que verlos todos.

alter table public.usuarios
  add column if not exists persona_id uuid references public.personas(id);

comment on column public.usuarios.persona_id is
  'Que persona de Personal JD es este usuario. De aqui sale que to-dos son suyos.';

update public.usuarios u
   set persona_id = p.id
  from public.personas p
 where u.persona_id is null
   and upper(trim(u.nombre)) = upper(trim(p.nombre));

NOTIFY pgrst, 'reload schema';

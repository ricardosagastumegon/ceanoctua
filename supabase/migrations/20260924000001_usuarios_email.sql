-- El correo del usuario, visible para quien administra.
--
-- Por que: la pantalla de Usuarios y accesos mostraba solo el nombre, asi que
-- no habia forma de saber con que correo entra cada quien ni de mandarle un
-- restablecimiento de contrasena. El correo vive en `auth.users`, que no se
-- puede leer desde el navegador, asi que se copia a `public.usuarios`.
--
-- Nota importante: aqui NO se guarda ninguna contrasena. Las contrasenas
-- viven cifradas de un solo sentido en `auth.users` y no se pueden recuperar,
-- solo restablecer. Eso es correcto y no se debe intentar cambiar.

alter table public.usuarios
  add column if not exists email text;

comment on column public.usuarios.email is
  'Espejo de auth.users.email, para que Admin sepa con que correo entra cada quien. Lo mantiene el trigger handle_new_user.';

-- Backfill de los que ya existen.
update public.usuarios u
   set email = a.email
  from auth.users a
 where a.id = u.id
   and u.email is distinct from a.email;

-- El trigger que crea la fila al nacer la cuenta ahora tambien copia el
-- correo. Se reescribe entero porque `create or replace` lo exige.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.usuarios (id, nombre, email)
  values (new.id, new.raw_user_meta_data->>'nombre', new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$function$;

-- Y si el correo cambia despues, el espejo se mantiene al dia.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.usuarios set email = new.email where id = new.id;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

NOTIFY pgrst, 'reload schema';

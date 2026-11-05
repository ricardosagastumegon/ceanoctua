#!/usr/bin/env node
// Crea un usuario con su rol y sus modulos, de una vez.
//
// Env: SUPABASE_PAT, SUPABASE_PROJECT_REF, EMAIL, PASSWORD, NOMBRE, ROL, MODULOS
//   MODULOS: lista separada por comas, "modulo:permiso".
//
// Uso (PowerShell):
//   $env:EMAIL='vmurillo@sion.com.gt'; $env:PASSWORD='...'
//   $env:NOMBRE='Victor Murillo'; $env:ROL='tesoreria'
//   $env:MODULOS='tesoreria:editor'
//   node scripts/create-user.mjs
//
// Es IDEMPOTENTE: si el correo ya existe no lo toca, solo ajusta rol y
// modulos. Crear usuarios es una accion sobre produccion, asi que conviene
// poder repetir el comando sin miedo.
//
// Se escribe directo contra `auth.users` por la Management API porque el
// proyecto no guarda la clave `service_role` en ningun lado --y no deberia.
// Mismo camino que ya usaban create-admin.mjs y reset-password.mjs.

const pat = process.env.SUPABASE_PAT;
const ref = process.env.SUPABASE_PROJECT_REF;
const email = process.env.EMAIL;
const password = process.env.PASSWORD;
const nombre = process.env.NOMBRE ?? '';
const rol = process.env.ROL ?? 'solo_lectura';
const modulos = (process.env.MODULOS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((par) => {
    const [modulo, permiso] = par.split(':');
    return { modulo: modulo.trim(), permiso: (permiso ?? 'observador').trim() };
  });

if (!pat || !ref || !email || !password) {
  console.error('Faltan: SUPABASE_PAT, SUPABASE_PROJECT_REF, EMAIL, PASSWORD');
  process.exit(2);
}

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) {
    console.error(`HTTP ${r.status}: ${text}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

const e = (s) => String(s).replaceAll("'", "''");

const insertModulos = modulos
  .map(
    (m) => `
    insert into public.usuario_modulos (usuario_id, modulo, permiso)
    values (uid, '${e(m.modulo)}', '${e(m.permiso)}')
    on conflict (usuario_id, modulo) do update set permiso = excluded.permiso;`,
  )
  .join('\n');

const sql = `
do $$
declare
  uid uuid;
  ya_existia boolean := false;
begin
  select id into uid from auth.users where email = '${e(email)}';

  if uid is not null then
    ya_existia := true;
    raise notice 'El correo ya existia; no se toca la clave.';
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      '${e(email)}',
      crypt('${e(password)}', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(),
      '', '', '', ''
    )
    returning id into uid;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(), uid, '${e(email)}',
      jsonb_build_object('sub', uid::text, 'email', '${e(email)}', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.usuarios (id, nombre, email, rol, activo)
  values (uid, nullif('${e(nombre)}', ''), '${e(email)}', '${e(rol)}'::public.app_rol, true)
  on conflict (id) do update
    set rol = excluded.rol,
        nombre = coalesce(excluded.nombre, public.usuarios.nombre),
        email = excluded.email,
        activo = true;
${insertModulos}
end $$;

select u.id, u.email, u.nombre, u.rol, u.activo,
       coalesce(
         (select string_agg(m.modulo || ':' || m.permiso, ', ' order by m.modulo)
            from public.usuario_modulos m where m.usuario_id = u.id),
         '(ninguno)'
       ) as modulos
  from public.usuarios u
 where u.email = '${e(email)}';
`;

console.log(`Creando/ajustando ${email} · rol ${rol} · modulos ${modulos.map((m) => m.modulo + ':' + m.permiso).join(', ') || '(ninguno)'}`);
const result = await q(sql);
console.log(JSON.stringify(result, null, 2));

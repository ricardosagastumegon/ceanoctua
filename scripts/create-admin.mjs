#!/usr/bin/env node
// Force-create an admin user via the Management API (SQL).
// Env: SUPABASE_PAT, SUPABASE_PROJECT_REF, ADMIN_EMAIL, ADMIN_PASSWORD

const pat = process.env.SUPABASE_PAT;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!pat || !projectRef || !email || !password) {
  console.error('Missing env: SUPABASE_PAT, SUPABASE_PROJECT_REF, ADMIN_EMAIL, ADMIN_PASSWORD');
  process.exit(2);
}

async function q(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

// Escape single quotes for inline SQL literals
const e = (s) => s.replaceAll("'", "''");

const sql = `
-- Idempotent: skip if email already exists
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = '${e(email)}';
  if uid is null then
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
      gen_random_uuid(),
      uid,
      '${e(email)}',
      jsonb_build_object('sub', uid::text, 'email', '${e(email)}', 'email_verified', true),
      'email',
      now(), now(), now()
    );
  end if;

  -- Trigger handle_new_user should have created public.usuarios; if not, insert.
  insert into public.usuarios (id, nombre, rol)
  values (uid, split_part('${e(email)}', '@', 1), 'admin')
  on conflict (id) do update set rol = 'admin';
end;
$$;

-- Return the resulting user state
select au.id, au.email, au.email_confirmed_at is not null as confirmed, u.rol, u.nombre
from auth.users au
left join public.usuarios u on u.id = au.id
where au.email = '${e(email)}';
`;

const result = await q(sql);
console.log(JSON.stringify(result, null, 2));

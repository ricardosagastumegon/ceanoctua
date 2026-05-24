#!/usr/bin/env node
// Update an existing auth user's email and password via Management API SQL.
// Env: SUPABASE_PAT, SUPABASE_PROJECT_REF, OLD_EMAIL, NEW_EMAIL, NEW_PASSWORD

const pat = process.env.SUPABASE_PAT;
const ref = process.env.SUPABASE_PROJECT_REF;
const oldEmail = process.env.OLD_EMAIL;
const newEmail = process.env.NEW_EMAIL;
const newPassword = process.env.NEW_PASSWORD;

if (!pat || !ref || !oldEmail || !newEmail || !newPassword) {
  console.error('Missing env: SUPABASE_PAT, SUPABASE_PROJECT_REF, OLD_EMAIL, NEW_EMAIL, NEW_PASSWORD');
  process.exit(2);
}

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) { console.error(`HTTP ${r.status}: ${text}`); process.exit(1); }
  return JSON.parse(text);
}

const e = (s) => s.replaceAll("'", "''");

const sql = `
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = '${e(oldEmail)}';
  if uid is null then
    raise exception 'No user found with email %', '${e(oldEmail)}';
  end if;

  -- Update auth.users
  update auth.users
  set email = '${e(newEmail)}',
      encrypted_password = crypt('${e(newPassword)}', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = uid;

  -- Update auth.identities (email provider)
  update auth.identities
  set provider_id = '${e(newEmail)}',
      identity_data = jsonb_build_object(
        'sub', uid::text,
        'email', '${e(newEmail)}',
        'email_verified', true
      ),
      updated_at = now()
  where user_id = uid and provider = 'email';
end;
$$;

-- Return resulting state
select au.id, au.email, au.email_confirmed_at is not null as confirmed, u.rol, u.nombre
from auth.users au
left join public.usuarios u on u.id = au.id
where au.email = '${e(newEmail)}';
`;

console.log(await q(sql));

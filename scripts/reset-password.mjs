#!/usr/bin/env node
// Reset password de un usuario existente sin cambiar su email.
// Env: SUPABASE_PAT, SUPABASE_PROJECT_REF, EMAIL, NEW_PASSWORD
// Uso:
//   $env:EMAIL='angelesquezadaoch@gmail.com'
//   $env:NEW_PASSWORD='Luka010818'
//   node scripts/reset-password.mjs

const pat = process.env.SUPABASE_PAT;
const ref = process.env.SUPABASE_PROJECT_REF;
const email = process.env.EMAIL;
const newPassword = process.env.NEW_PASSWORD;

if (!pat || !ref || !email || !newPassword) {
  console.error('Missing env: SUPABASE_PAT, SUPABASE_PROJECT_REF, EMAIL, NEW_PASSWORD');
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
  select id into uid from auth.users where lower(email) = lower('${e(email)}');
  if uid is null then
    raise exception 'No user found with email %', '${e(email)}';
  end if;

  update auth.users
     set encrypted_password = crypt('${e(newPassword)}', gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = uid;
end;
$$;

select au.id, au.email, au.email_confirmed_at is not null as confirmed,
       u.rol, u.nombre
  from auth.users au
  left join public.usuarios u on u.id = au.id
 where lower(au.email) = lower('${e(email)}');
`;

console.log(await q(sql));

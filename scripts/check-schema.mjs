#!/usr/bin/env node
// Sanity check: count tables, enums and key seeded rows.
// Env: SUPABASE_PAT, SUPABASE_PROJECT_REF

const pat = process.env.SUPABASE_PAT;
const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!pat || !projectRef) {
  console.error('Missing SUPABASE_PAT or SUPABASE_PROJECT_REF');
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

const tables = await q(`
  select table_name
  from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
  order by table_name
`);

const enums = await q(`
  select t.typname as enum_name, array_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname
`);

const policies = await q(`
  select schemaname, tablename, policyname
  from pg_policies
  where schemaname='public'
  order by tablename, policyname
`);

const seq = await q(`
  select sequence_name from information_schema.sequences
  where sequence_schema='public' order by sequence_name
`);

const miembros = await q(`select codigo, nombre from public.miembros_board order by orden`);
const bucket = await q(`select id, name, public from storage.buckets where id='documentos'`);

console.log('Tables (public):', tables.length);
console.log(tables.map((t) => t.table_name).join(', '));
console.log('');
console.log('Enums (public):', enums.length);
for (const e of enums) console.log(`  ${e.enum_name}: ${JSON.stringify(e.values)}`);
console.log('');
console.log('Policies (public):', policies.length);
console.log('');
console.log('Sequences (public):', seq.length);
console.log(seq.map((s) => s.sequence_name).join(', '));
console.log('');
console.log('Miembros board:', miembros.length);
for (const m of miembros) console.log(`  ${m.codigo}: ${m.nombre}`);
console.log('');
console.log('Storage bucket documentos:', JSON.stringify(bucket));

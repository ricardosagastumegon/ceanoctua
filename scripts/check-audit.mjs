#!/usr/bin/env node
// Verify audit triggers exist on the 6 financial tables.
const pat = process.env.SUPABASE_PAT;
const ref = process.env.SUPABASE_PROJECT_REF;

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) { console.error(r.status, await r.text()); process.exit(1); }
  return r.json();
}

const triggers = await q(`
  select c.relname as tabla, t.tgname as trigger
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('tc_consumos','reintegros','caja_chica_vales','caja_chica_liquidaciones','pagos','vouchers')
    and t.tgname like 'audit_%'
  order by c.relname
`);

const enums = await q(`
  select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as values
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  where t.typname in ('vale_status','pago_estado','reintegro_status')
  group by t.typname
`);

console.log('Audit triggers on financial tables:');
for (const t of triggers) console.log(`  ${t.tabla} -> ${t.trigger}`);
console.log('');
console.log('Enum values:');
for (const e of enums) console.log(`  ${e.typname}: ${e.values}`);

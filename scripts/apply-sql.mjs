#!/usr/bin/env node
// Apply a SQL file to the linked Supabase project via the Management API.
// Usage: node scripts/apply-sql.mjs [path/to/file.sql]
// Env:   SUPABASE_PAT, SUPABASE_PROJECT_REF
// Default path: supabase/all-migrations.sql

import { readFileSync } from 'node:fs';

const pat = process.env.SUPABASE_PAT;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const filePath = process.argv[2] ?? 'supabase/all-migrations.sql';

if (!pat) {
  console.error('Missing env var SUPABASE_PAT');
  process.exit(2);
}
if (!projectRef) {
  console.error('Missing env var SUPABASE_PROJECT_REF');
  process.exit(2);
}

const rawSql = readFileSync(filePath, 'utf8');
// CACHE INVALIDATION SIEMPRE — appendea NOTIFY al final si no está.
// PostgREST cachea el schema y queda stale después de DDL. Sin esto el
// frontend falla con "Could not find column X in schema cache" aunque
// el ALTER haya tenido éxito.
const cacheReload = `\n\n-- auto-appended por scripts/apply-sql.mjs\nNOTIFY pgrst, 'reload schema';\n`;
const sql = rawSql.includes("NOTIFY pgrst") ? rawSql : rawSql + cacheReload;

const bytes = Buffer.byteLength(sql, 'utf8');
console.log(`Applying ${filePath} (${bytes} bytes) to project ${projectRef}...`);
if (!rawSql.includes("NOTIFY pgrst")) {
  console.log("  + auto-append: NOTIFY pgrst, 'reload schema'");
}

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { res, parsed };
}

const { res, parsed } = await runSql(sql);

console.log(`HTTP ${res.status} ${res.statusText}`);
console.log(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));

// Extra: si la migración trajo cambios DDL, fuerza un SEGUNDO NOTIFY
// como red de seguridad (PostgREST a veces ignora el primero si llega
// dentro de la misma transacción).
if (res.ok) {
  console.log('Forzando segundo reload del schema cache (red de seguridad)...');
  await runSql("NOTIFY pgrst, 'reload schema';");
  console.log('  ✓ Cache reload disparado.');
}

process.exit(res.ok ? 0 : 1);

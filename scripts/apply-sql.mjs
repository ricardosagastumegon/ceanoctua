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

const sql = readFileSync(filePath, 'utf8');
const bytes = Buffer.byteLength(sql, 'utf8');
console.log(`Applying ${filePath} (${bytes} bytes) to project ${projectRef}...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  },
);

const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = text;
}

console.log(`HTTP ${res.status} ${res.statusText}`);
console.log(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));

process.exit(res.ok ? 0 : 1);

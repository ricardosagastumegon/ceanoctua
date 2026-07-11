---
name: sync-schema
description: Regenera src/types/database.ts desde el schema real de Supabase para que los types de TypeScript reflejen exactamente las tablas y columnas actuales. Úsalo después de aplicar cualquier migración de schema, o cuando el usuario reporte errores tipo "type X does not exist" o "column Y is not assignable". Este skill preserva los tipos custom (enums) y las Insert/Update relaciones existentes.
---

# Sync Schema Types · CEA NOCTUA

Regenera `src/types/database.ts` desde el schema real de Supabase. Ejecutar después de cada migración.

## Cuándo se invoca

- Después de correr `apply-migration`.
- Cuando el usuario reporta errores TS del tipo "column not assignable" o "property does not exist on type".
- Al empezar una sesión nueva si hay dudas de si los types están al día.

## Preflight

1. Verificar env vars:
   - `SUPABASE_PAT` — necesario para leer el schema via Management API.
   - `SUPABASE_PROJECT_REF` — para NOCTUA: `bbxieuyhzxqygkkxwvwo`.
2. Backup del actual `src/types/database.ts` en scratchpad por si el resultado sale mal.

## Estrategia

Hay 2 formas:

### A · Manual (recomendada actualmente)

El proyecto **NO usa** `supabase gen types` porque:
- Requiere Supabase CLI instalado + login.
- Genera todo el schema incluyendo columnas legacy que ensuciamos con `AuditCols` / `AuditInsert`.
- El file actual está muy customizado con nuestros tipos base.

Por eso, el flow manual es:

1. Correr esta query en Supabase Studio (o vía script):
   ```sql
   SELECT
     table_name,
     column_name,
     data_type,
     is_nullable,
     column_default,
     udt_name
   FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
   ```

2. Comparar output con `src/types/database.ts`.

3. Para cada tabla nueva o modificada, actualizar el bloque:
   ```typescript
   tabla_x: {
     Row: AuditCols & {
       id: string;
       // …columnas reales…
       deleted_at: string | null;
     };
     Insert: AuditInsert & { /* …campos opcionales… */ };
     Update: AuditUpdate & { /* …campos partial… */ };
     Relationships: [ /* …FKs… */ ];
   };
   ```

4. Para enums nuevos, agregarlos en `Enums:`:
   ```typescript
   Enums: {
     vale_tipo: 'desembolso' | 'entidad';
     // …
   };
   ```

### B · Automático (futuro)

Si el proyecto adopta Supabase CLI, se puede correr:
```bash
npx supabase gen types typescript --project-id bbxieuyhzxqygkkxwvwo > src/types/database.raw.ts
```

Y después mergear manualmente con el custom `AuditCols`. Por ahora, no está automatizado.

## Verificación

Después de actualizar el file:

1. `rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && npx tsc -b` debe salir con exit 0.
2. Si hay errores, no revertir sin analizar — probablemente son bugs en el código que revela el schema correcto.
3. Correr `npx vite build` para asegurar que no hay imports rotos.

## Errores comunes y cómo resolver

- **`Property 'X' does not exist on type`** → agregar la columna al `Row` de la tabla. Verifica que no sea `undefined` vs `null | undefined`.
- **`Type 'X' is not assignable to Insert`** → chequear que el campo esté en `Insert:` (probablemente falta el `?`).
- **`Enum member 'X' not found`** → el enum en DB tiene un valor nuevo, agregar en `Enums:`.
- **Relations broken** → los tipos `Relationships:` son opcionales pero útiles para JOINs. Actualizar si cambió una FK.

## Después de éxito

1. `git diff src/types/database.ts` → revisar que solo cambian columnas esperadas.
2. Commit separado si es puro schema sync (`chore(types): sync schema after fase NN`).
3. Nunca mezclar sync con cambios de código en un mismo commit — dificulta el review.

## Pitfall

**NO borrar `AuditCols` / `AuditInsert` / `AuditUpdate`** aunque `supabase gen types` no los genere. Son parte del pattern del proyecto (fase 12 los formalizó).

---
name: apply-migration
description: Aplica una migración SQL al Supabase de CEA NOCTUA con auto-append de NOTIFY pgrst y verificación de las columnas/tablas creadas. Úsalo siempre que el usuario diga "aplica la migración", "corre el SQL", o similar. Requiere env SUPABASE_PAT + SUPABASE_PROJECT_REF, o alternativamente genera las instrucciones para pegar manualmente en Supabase Studio.
---

# Apply Migration · CEA NOCTUA

Aplica una migración SQL a Supabase con garantías de que el cache de PostgREST se refresca. Sin esto, la app rompe después del DDL.

## Cuándo se invoca

- Usuario dice "aplica la migración X" / "corre el SQL" / "sube el schema".
- Al final de una fase, después de escribir `supabase/migrations/XXX.sql`.
- Cuando se genera una migración nueva y hay que probarla contra la DB.

## Preflight

1. Verificar que el archivo `.sql` existe y termina con `.sql`.
2. Verificar que el SQL contiene `NOTIFY pgrst, 'reload schema';` al final. Si no, no bloquees — el script `apply-sql.mjs` lo auto-appendea. Solo alerta al usuario.
3. Verificar env vars:
   - `SUPABASE_PAT` — Personal Access Token de Supabase.
   - `SUPABASE_PROJECT_REF` — ref del proyecto (para NOCTUA: `bbxieuyhzxqygkkxwvwo`).

## Flow

### Modo 1 · Con PAT disponible

Corre:
```bash
node scripts/apply-sql.mjs supabase/migrations/XXX_nombre.sql
```

El script:
1. Lee el SQL.
2. Auto-appendea `NOTIFY pgrst, 'reload schema';` si falta.
3. POST al Supabase Management API `/database/query`.
4. Dispara un segundo NOTIFY como red de seguridad.
5. Log del resultado.

### Modo 2 · Sin PAT (manual)

Genera las instrucciones exactas para el usuario:

```
1. Abre https://supabase.com/dashboard/project/bbxieuyhzxqygkkxwvwo/sql/new
2. Copia el contenido de: <archivo>
3. Pega en el editor.
4. Click **Run** (o Ctrl+Enter).
5. Si aparece warning de RLS: click **Run and enable RLS**.
6. Después: pega y run:
   NOTIFY pgrst, 'reload schema';
```

## Verificación post-run

Después de aplicar, correr estas queries y reportar al usuario:

```sql
-- 1. Confirmar tablas nuevas (usar los nombres del CREATE TABLE de la migración)
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('<tabla_nueva_1>', '<tabla_nueva_2>');

-- 2. Confirmar columnas nuevas (usar los ALTER TABLE ADD COLUMN)
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = '<tabla_afectada>'
   AND column_name IN ('<col_nueva_1>', '<col_nueva_2>');

-- 3. Confirmar RLS habilitado en tablas nuevas
SELECT tablename, rowsecurity FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('<tabla_nueva_1>', '<tabla_nueva_2>');
```

Todos deben retornar filas. Si alguno está vacío, la migración falló parcialmente.

## Después de éxito

1. Confirmar al usuario que el schema cache fue recargado.
2. Recordar hacer Ctrl+Shift+R en la app deployada la primera vez (opcional con los cache headers actuales).
3. Actualizar `docs/BITACORA.md` con una entrada de la fase.

## Recuperación de errores

- **Error 42P01 "relation X does not exist"** → dependencia de migración anterior. Aplicar en orden.
- **Error 42P07 "relation X already exists"** → la migración no es idempotente. Agregar `if not exists`.
- **Error "syntax error"** → verificar el SQL con `psql -f archivo.sql --set ON_ERROR_STOP=1` localmente si posible.
- **Éxito pero app rompe con "column not found in schema cache"** → correr `NOTIFY pgrst, 'reload schema';` manualmente. Es la invariante 2 de CLAUDE.md.

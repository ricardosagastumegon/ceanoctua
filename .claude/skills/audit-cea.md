---
name: audit-cea
description: Auditoría integral del proyecto CEA NOCTUA — RLS, types desincronizados, migraciones huérfanas, bundle size, code smells, invariantes de CLAUDE.md. Úsalo antes de cerrar una fase importante, antes de deployment a producción, o cuando el usuario diga "audita todo" / "revisa el estado del proyecto". Reporta findings priorizados y recomendaciones concretas.
---

# Audit CEA · Auditoría integral

Revisa el estado del proyecto CEA NOCTUA en múltiples dimensiones y reporta findings priorizados con acciones concretas.

## Cuándo se invoca

- Al cerrar una fase importante (11, 12, 15, 17…).
- Antes de un deployment con cambios significativos.
- Cuando el usuario pide "audita el proyecto" / "revisa todo" / "estado del código".
- Como práctica trimestral (drift check).

## Dimensiones de auditoría

Ejecutar cada dimensión en paralelo cuando sea posible. Reportar findings al final agrupados por severidad.

### D1 · Seguridad (RLS + secrets)

Delega al skill `check-rls`. Adicionalmente:

1. Verificar que NO hay secretos en el repo:
   ```bash
   grep -rE "SUPABASE_SERVICE_ROLE|SUPABASE_PAT|password.*=.*['\"]" \
     --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
     --exclude-dir=node_modules src/
   ```
2. Verificar `.env` está en `.gitignore`.
3. Confirmar `vercel.json` tiene cache headers correctos + SPA fallback.

### D2 · Schema vs Types

1. Correr el skill `sync-schema` en modo dry-run (solo query, no modifica).
2. Comparar columnas de DB vs `src/types/database.ts`.
3. **Finding HIGH** si hay columnas en DB no reflejadas en types.
4. **Finding MEDIUM** si hay types en `database.ts` que no existen en DB (residuo).

### D3 · Migraciones

1. Listar todas las migraciones:
   ```bash
   ls supabase/migrations/*.sql
   ```
2. Verificar orden por timestamp.
3. Chequear que cada una termina con `NOTIFY pgrst, 'reload schema';`.
4. **Finding MEDIUM** si alguna no lo tiene (la app puede haber roto en el past).
5. Confirmar contra `information_schema.tables` que todas fueron aplicadas en producción (chequear tablas esperadas).

### D4 · Código: TypeScript + Build

1. `rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && npx tsc -b`
2. `npx vite build`
3. **Finding CRITICAL** si tsc falla.
4. **Finding HIGH** si vite build falla.
5. **Finding MEDIUM** si bundle inicial > 500 KB gzip > 145 KB.

### D5 · Convenciones (CLAUDE.md §6)

Grep por violaciones comunes:

1. `any` en código de producción:
   ```bash
   grep -rn ": any\b" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
   ```
2. Imports relativos con `../..`:
   ```bash
   grep -rn "from ['\"]\.\.\/\.\." src/ --include="*.ts" --include="*.tsx"
   ```
3. `useEffect` con `fetch` (debería ser React Query):
   ```bash
   grep -rn "useEffect" src/ --include="*.tsx" -A 5 | grep -B 5 "fetch("
   ```
4. Colores hex hardcodeados fuera de printables:
   ```bash
   grep -rn "#[0-9a-f]\{6\}" src/ --include="*.tsx" --include="*.ts" \
     | grep -v Printable | grep -v tailwind.config
   ```

**Finding LOW** por cada violación individual — priorizar por frecuencia.

### D6 · Testing (WIP)

Actualmente no hay tests. **Finding MEDIUM** permanente hasta que se agreguen.

Cuando existan, verificar:
- Coverage mínimo del módulo Finanzas (crítico).
- Tests de RLS con distintos roles.

### D7 · Documentación

1. `CLAUDE.md` existe y actualizado (chequear fecha en el archivo).
2. `docs/BITACORA.md` tiene entrada para la última fase.
3. `docs/PROCESO-Y-DECISIONES.md` refleja decisiones recientes.
4. `README.md` existe.
5. Skills en `.claude/skills/` están al día.

**Finding LOW** por cada gap.

### D8 · Deploy

1. Verificar último deploy en Vercel corresponde al commit `main` actual:
   ```bash
   git rev-parse HEAD
   ```
2. Chequear que producción responde y auth funciona (manual, no automatizable acá).
3. Confirmar env vars en Vercel dashboard.

**Finding HIGH** si el deploy actual es antiguo o falló.

## Formato del reporte

```
# Audit CEA NOCTUA · YYYY-MM-DD · fase actual N

## Resumen ejecutivo
[1-2 párrafos: estado general del proyecto, principales riesgos]

## Métricas
- Tablas en DB: N (RLS habilitado: M)
- Migraciones aplicadas: N
- Bundle inicial: X KB (gzip Y KB)
- TS errors: N
- Vite build: OK / FAIL
- Convenciones violadas: N instancias

## Findings

### CRITICAL (bloquean producción)
1. **[D1] tabla_x sin RLS**
   - Impacto: data expuesta al anon key.
   - Fix: `ALTER TABLE tabla_x ENABLE ROW LEVEL SECURITY;` + policies.
   - Priority: inmediata.

### HIGH (mergear antes del próximo deploy)
1. **[D2] Columnas en DB no reflejadas en types**
   - Ejemplos: `tabla_x.columna_nueva`
   - Fix: correr `sync-schema`.

### MEDIUM
…

### LOW
…

## Riesgos monitoreados (no findings pero worth watching)
- Bundle creciendo hacia el límite de 500 KB.
- Tabla `audit_log` con N rows — considerar particionado si > 1M.
- Sesión larga sin refresh de types — puede haber drift no detectado.

## Acciones recomendadas (top 3 en orden)
1. [Fix CRITICAL #1]
2. [Fix HIGH #1]
3. [Documentar decisión reciente en PROCESO-Y-DECISIONES.md]
```

## Después del reporte

- Si hay CRITICAL: pausar la fase actual y arreglar antes de continuar.
- Si hay HIGH: agendarlos para antes del próximo push.
- Si solo MEDIUM/LOW: seguir con la fase actual, agendar batch para "sprint de deuda técnica" cada 2 fases.

---
name: check-rls
description: Valida que una tabla (o todas) tenga RLS habilitado y políticas coherentes con los 3 patterns definidos en CLAUDE.md §3.3 — A Financial, B Member, C Catálogo. Úsalo antes de mergear cualquier migración que crea tabla nueva, o cuando hagas la auditoría de seguridad. Reporta findings priorizados (critical/high/medium/low).
---

# Check RLS · CEA NOCTUA

Auditoría de Row-Level Security. Verifica que toda tabla de `public` tenga RLS activo y política del patrón correcto según CLAUDE.md §3.3.

## Cuándo se invoca

- Después de escribir una migración con CREATE TABLE.
- Antes de mergear una PR con cambios de schema.
- En la auditoría periódica cada 2-3 fases.
- Cuando el usuario reporta errores 401/403 en Network tab.

## Inputs

- **Tabla específica:** `check-rls <table_name>` — audita solo esa tabla.
- **Todas:** `check-rls` — audita todo `public`.

## Checks

Ejecuta estas queries en el orden y reporta findings:

### 1. RLS habilitado

```sql
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename NOT LIKE 'audit_log%'  -- audit_log es especial
 ORDER BY rowsecurity ASC, tablename;
```

**Finding CRITICAL** si `rowsecurity = false` para cualquier tabla.

### 2. Políticas existen

```sql
SELECT tablename, COUNT(policyname) as policy_count
  FROM pg_policies
 WHERE schemaname = 'public'
 GROUP BY tablename
HAVING COUNT(policyname) = 0;
```

**Finding CRITICAL** si retorna filas — tabla con RLS activo pero sin políticas = todos bloqueados.

### 3. Coincidencia con Pattern A/B/C

Para cada tabla, revisar sus políticas:

```sql
SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, cmd;
```

Reglas de clasificación:

- **Pattern A (Financial):** SELECT y ALL usan `public.auth_rol() in ('admin','asistente')`.
  - Tablas esperadas: `pagos`, `caja_chica_vales`, `caja_chica_liquidaciones`, `tc_consumos`, `firmas`, `pagos_notificaciones`, `reintegros`.
- **Pattern B (Member):** SELECT permite `admin+asistente`, ALL permite solo `admin`.
  - Tablas esperadas: todas las `arriaza_*`, `la_*`, `ja_*`, `mma_*` si existen.
- **Pattern C (Catálogo):** SELECT permite cualquier autenticado, ALL permite `admin+asistente`.
  - Tablas esperadas: `empleados`, `entidades`, `proveedores`, `personas`, `tarjetas_credito`, `status_solicitud_pago`, `tipos_pago`, `miembros_board`.

**Finding HIGH** si una tabla no encaja en ningún patrón.
**Finding MEDIUM** si la política usa `true` como qual (equivale a "todos autenticados") — puede ser correcto para catálogos pero verificar.

### 4. `auth_rol()` function existe

```sql
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
 WHERE n.nspname = 'public'
   AND p.proname = 'auth_rol';
```

**Finding CRITICAL** si no existe — todas las policies dependen de esta función.

### 5. Recursión en policies

Buscar policies con self-reference:

```sql
SELECT tablename, policyname, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND qual LIKE '%usuarios%';
```

**Finding CRITICAL** si una policy consulta `usuarios` sin usar `security definer`. Causa recursión infinita (usuarios tiene su propia RLS).

## Formato del reporte

```
## Check RLS — CEA NOCTUA · YYYY-MM-DD

### Resumen
- Total tablas en public: N
- Con RLS habilitado: N
- Sin RLS: N ⚠
- Encajan en Pattern A/B/C: N
- Fuera de patrón: N ⚠

### Findings

#### CRITICAL
1. **tabla_x** — RLS deshabilitado. Correr `ALTER TABLE tabla_x ENABLE ROW LEVEL SECURITY;`.
2. …

#### HIGH
1. **tabla_y** — Política de write permite `authenticated` sin distinguir rol. Debería ser Pattern A o C.

#### MEDIUM
…

#### LOW
…

### Acción recomendada
1. Generar migración de fix.
2. Aplicar via `apply-migration`.
```

## Después del reporte

- Si hay CRITICAL, **no permitir merge** de la fase.
- Generar un `supabase/migrations/YYYYMMDDHHMMSS_rls_fix_faseNN.sql` que corrija.
- Aplicarla y re-auditar hasta cero CRITICAL.

## Fixes comunes

```sql
-- Enable RLS
ALTER TABLE public.tabla_x ENABLE ROW LEVEL SECURITY;

-- Pattern A · Financial
CREATE POLICY tabla_x_read ON public.tabla_x
  FOR SELECT USING (public.auth_rol() IN ('admin','asistente'));
CREATE POLICY tabla_x_write ON public.tabla_x
  FOR ALL
  USING (public.auth_rol() IN ('admin','asistente'))
  WITH CHECK (public.auth_rol() IN ('admin','asistente'));

-- Pattern C · Catálogo
CREATE POLICY tabla_x_read ON public.tabla_x
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tabla_x_write ON public.tabla_x
  FOR ALL
  USING (public.auth_rol() IN ('admin','asistente'))
  WITH CHECK (public.auth_rol() IN ('admin','asistente'));
```

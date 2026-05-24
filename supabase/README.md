# Supabase — Esquema (Fases 2, 3 y 4)

Este directorio contiene las migraciones SQL del esquema, la seguridad
(autenticación + RLS) y la semilla inicial de Board Assistant v2.

## Cómo aplicar

### Opción A — Supabase Studio (sin CLI)

1. Abre tu proyecto en https://supabase.com → SQL Editor → New query.
2. Aplica los archivos **en orden numérico** (`20260523000001_*`, `20260523000002_*`, …).
   Pega el contenido de cada archivo, ejecuta, y pasa al siguiente.
3. Verifica que las tablas aparezcan en Table Editor.

### Opción B — Supabase CLI

```powershell
# 1. Instala la CLI (PowerShell con scoop)
scoop install supabase

# 2. Vincula el proyecto remoto
supabase login
supabase link --project-ref <tu-project-ref>

# 3. Aplica las migraciones
supabase db push
```

## Orden y contenido

| # | Archivo | Qué crea |
|---|---|---|
| 0001 | `*_extensions_enums_helpers.sql` | `pgcrypto`, enums, secuencias `seq_voucher`/`seq_cc_vale`/`seq_miel_corr`, función `set_updated_at()` |
| 0002 | `*_identity.sql` | `miembros_board`, `empleados`, `entidades`, `autorizadores`, `tipos_pago`, `proveedores`, `tarjetas_credito` |
| 0003 | `*_agenda.sql` | `tareas`, `viajes` + `viaje_checklist`, `eventos`, `notas`, `perfiles` + sub-tablas, `kit_items`, `evento_religioso` |
| 0004 | `*_finance.sql` | `tc_consumos`, `reintegros`, `caja_chica_vales`, `caja_chica_liquidaciones`, `pagos`, `vouchers` |
| 0005 | `*_cea.sql` | `cea_todos`, `firmas`, `lavanderia`, `cea_directorio` |
| 0006 | `*_miel_sj.sql` | `miel_constancias` |
| 0007 | `*_arriaza.sql` | `att_viajes`, `att_tickets`, `att_hoteles`, `att_restaurantes`, `att_pins` |
| 0008 | `*_documentos_audit.sql` | `documentos`, `audit_log` |
| 0009 | `*_storage_bucket.sql` | Bucket `documentos` en Storage |
| 0010 | `*_rls_and_triggers.sql` | `enable row level security` en todas las tablas + triggers `set_updated_at` |
| **— Fase 3 —** | | |
| F3-0001 | `20260524000001_auth_schema.sql` | Enum `app_rol`, tabla `public.usuarios`, trigger `on_auth_user_created`, funciones `auth_rol()` / `es_admin()` / `mi_miembro_id()`, políticas RLS de `usuarios` |
| F3-0002 | `20260524000002_created_updated_by.sql` | `default auth.uid()` en `created_by`; función `set_updated_at_with_by` y re-attachment de triggers `updated_at` con/sin `updated_by` según la tabla |
| F3-0003 | `20260524000003_rls_policies.sql` | Políticas RLS para las 36 tablas: financieras (A), datos del miembro (B incluye sub-tablas), catálogo (C), + `documentos`, `audit_log` |
| F3-0004 | `20260524000004_audit_triggers.sql` | Función `audit_trigger()` y triggers en las 6 tablas financieras |
| F3-0005 | `20260524000005_storage_policies.sql` | Políticas en `storage.objects` para el bucket `documentos` |
| **— Fase 4 —** | | |
| F4-0001 | `20260525000001_seed_miembros_board.sql` | Inserta los 7 miembros (MAA, JA, LA, JM, AA, EG, PE). **Nombres placeholder** — edítalos cuando tengas los reales del HTML. |

## Reglas aplicadas (todas las tablas)

- PK: `uuid` con `default gen_random_uuid()`.
- `legacy_id bigint unique` reservado para futura migración desde el JSON.
- Dinero: `numeric(14,2)`. Moneda: enum `currency`.
- Estados: enums.
- Seriales (`VCH-0001`, `CC-0001`, `MSJ-0001`): secuencias en Postgres.
- Auditoría: `created_at`, `updated_at`, `created_by`, `updated_by`.
- Borrado lógico (`deleted_at`) en tablas financieras.
- RLS activado sin políticas — solo `service_role` accede en Fase 2.
- Documentos: tabla `documentos` + bucket Storage (reemplaza los base64).

## Enums que necesitan revisión contra el HTML

Estos enums tienen valores **placeholder**. Cuando subas
`reference/board-assistant-actual.html`, revisa y ajusta con
`ALTER TYPE ... ADD VALUE` o un nuevo migration:

- `task_priority`
- `task_status`
- `trip_status`
- `trip_type`
- `vale_status`
- `firma_status`
- `pago_tipo`
- `evento_tipo`

Los siguientes están confirmados del plan y no necesitan revisión:

- `currency` ('USD','GTQ','EUR','GBP')
- `reintegro_status` ('generada','firmada','presentada','procesada','reintegrada')
- `tc_tipo` ('corporativa','presidencia')

## Tablas cuya forma exacta debe revisarse contra el HTML

Las tablas no detalladas campo-a-campo en `PLAN-FASE-2.md` se crearon con
campos razonables. Cada una está marcada con un comentario `ajustar contra el HTML`:

- `empleados`, `entidades`, `autorizadores`, `tipos_pago`
- `eventos`, `perfiles` y sus sub-tablas
- `caja_chica_liquidaciones`, `pagos`, `vouchers`
- todas las tablas `cea_*`
- `miel_constancias`
- todas las tablas `att_*`

Cuando tengas el HTML, agrega un migration nuevo (`ALTER TABLE ... ADD/DROP/RENAME COLUMN`)
en lugar de modificar los archivos existentes.

## No incluido en Fase 2

- **Migración de datos** (`scripts/migrate.ts`): el usuario decidió empezar con
  Supabase en blanco. Si más adelante quieres cargar el export del `localStorage`,
  el campo `legacy_id` está reservado para eso en cada tabla.

## Fase 3 — Autenticación y RLS

### Patrones de políticas RLS aplicadas

| Patrón | Tablas | Lectura | Escritura |
|---|---|---|---|
| **A — Financiera** | `tc_consumos`, `reintegros`, `caja_chica_vales`, `caja_chica_liquidaciones`, `pagos`, `vouchers` | `admin`, `asistente`, `solo_lectura` | `admin`, `asistente` |
| **B — Datos del miembro** | `tareas`, `viajes`, `eventos`, `notas`, `perfiles` y sub-tablas (`viaje_checklist`, `perfil_vehiculos`, `perfil_familia`, `perfil_fechas`) | `admin`/`asistente` ven todo; `board_member` solo sus filas | mismo criterio |
| **C — Catálogo** | identidad + `kit_items`, `evento_religioso`, `cea_*`, `miel_constancias`, `att_*` | cualquier autenticado | solo `admin` |
| Especial | `documentos` | cualquier autenticado | `admin`, `asistente` |
| Especial | `audit_log` | solo `admin` | sin políticas (trigger SECURITY DEFINER) |

### Crear el primer usuario admin

1. Supabase → Authentication → Users → **Add user** (email + contraseña). El trigger `on_auth_user_created` crea la fila en `public.usuarios` con rol por defecto `solo_lectura`.
2. Supabase → SQL Editor, eleva el rol a `admin`:
   ```sql
   update public.usuarios
   set rol = 'admin'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```
3. Desde ese admin, en la app (módulo Admin, fases futuras) o por SQL, asignas los demás roles y enlazas a `miembro_id` para los `board_member`.

### MFA recomendado

El plan pide MFA (TOTP) para `admin` y `asistente`. Eso se habilita en
Supabase → Authentication → Multi-Factor Authentication, y por usuario.
No se fuerza vía SQL; revísalo manualmente al crear cada cuenta sensible.

### Variables de entorno

`.env` debe contener:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

(El frontend no necesita la `service_role key`.)

## Fase 4 — Capa de datos + módulo de referencia

### Tipos generados desde la base

`src/types/database.ts` está hecho a mano por ahora con sólo las tablas que
toca la Fase 4 (`entidades`, `usuarios`, `miembros_board`). En cuanto tengas
la Supabase CLI y un access token, regenera el archivo completo:

```powershell
$env:SUPABASE_ACCESS_TOKEN = '<tu-access-token>'
npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.ts
```

A partir de Fase 5 (cuando portes el resto de módulos) este archivo deberá
estar completo y siempre regenerado al cambiar el esquema.

### Realtime (opcional, ya configurado en el código)

El módulo Admin usa `useEntidadesRealtime()` para refrescar la tabla cuando
otro usuario crea/edita/borra. Para activarlo en Supabase:

1. Supabase Studio → Database → Replication.
2. Activa Realtime en la tabla `public.entidades`.
3. Sin este paso, la suscripción no falla — simplemente nunca emite eventos.

### Semilla de miembros

La migración `20260525000001_seed_miembros_board.sql` inserta los 7 miembros con
nombres placeholder iguales al código. Edita las filas en Supabase Studio
(Table Editor → `miembros_board`) cuando tengas los nombres reales.

## No incluido en Fase 4

- Los otros 12 módulos (Fase 5+, cada uno copia el patrón de Entidades).
- Generación de PDF, mapas, lógica de negocio compleja.

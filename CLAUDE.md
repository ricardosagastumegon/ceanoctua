# CLAUDE.md · CEA NOCTUA

> **Regla 0** — Toda mutación de datos pasa por Supabase con RLS activo y queda registrada en `audit_log`. Sin excepciones. Si un caso parece requerir bypass, es señal de que el modelo o la política están mal diseñados; ajusta el modelo, no la regla.

Este documento es la **fuente de verdad operativa** para trabajar en CEA NOCTUA con Claude Code. Léelo antes de cualquier cambio no trivial. Si algo aquí contradice lo que "recuerdas" de otra sesión, este archivo gana.

---

## 1 · Qué es CEA NOCTUA

**Board Assistant** para una asistente ejecutiva de junta directiva. Reemplaza un HTML monolítico legacy (1.7 MB con localStorage) por una app moderna con backend Postgres. Coordina la operación diaria de la junta: tareas, finanzas (caja chica), pagos, consumos de tarjetas corporativas, catálogos maestros y sub-vistas por miembro (LA, JA, JM, AA, EG, PE, MMA).

**No es** un sistema contable ni bancario — no ejecuta transacciones reales. Es un sistema de **coordinación interna** con registro auditado.

**Usuarios:**
- **Admin** (1): dueño. Puede todo.
- **Asistente** (1): Angeles Quezada. Puede escribir en Finanzas, CC Board y Admin salvo audit_log. RLS Pattern C se lo permite.
- **Solo lectura** (opcional): rol futuro no implementado.

---

## 2 · Stack y dependencias

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript strict |
| Estilos | Tailwind CSS con paleta custom (teal / sand / rust / gold / purple) |
| Router | React Router 6 con lazy loading por página |
| Data | React Query v5, factory `createCrudHooks` genérico |
| Backend | Supabase (Postgres 15 + Row-Level Security) |
| Auth | Supabase Auth email/password |
| Storage | Supabase Storage (comprobantes, firmas) |
| PDFs | Componentes React + `window.print` (sin librería) |
| Import | SheetJS `xlsx` para binarios; parser propio para CSV/TSV |
| Deploy | Vercel, dominio `cea.noctuapo.com` |
| Runtime local | Windows 11 · PowerShell 5.1 · Git Bash disponible |

**No usamos:** Redux, Zustand, MobX, Radix, shadcn, Chakra, MUI, tRPC, Prisma, Next.js, Server Components, backend en Node/Deno/Python, Postgres directo desde el cliente.

**Bundle target:** inicial < 500 KB gzip < 145 KB. Se logra con lazy routing y code splitting agresivo.

---

## 3 · Arquitectura

### 3.1 · Estructura de carpetas

```
src/
├── components/ui/          # Componentes base reusables (DataTable, Modal, PrintableModal, TextInput, Select, CsvImporter…)
├── lib/                    # Utilidades transversales (supabase, auth, dates, money)
├── modules/                # Un directorio por dominio funcional
│   ├── admin/              # Catálogos maestros + hooks CRUD genéricos
│   ├── board/              # Vistas por miembro (LA, JA, JM, AA, EG, PE, MMA)
│   ├── cc-board/           # Caja chica: vales, liquidaciones, vouchers
│   ├── dashboard/          # Home + KPIs globales
│   └── finanzas/           # Consumos TC, Pagos SP, Reintegros dashboard
├── types/database.ts       # Types generados/mantenidos de Supabase
└── main.tsx                # Entry point
supabase/
├── migrations/             # SQL versionado por fase (idempotente con `if not exists`)
└── scripts/                # Utilidades sueltas (reload-schema, seed, etc.)
scripts/                    # Node scripts (apply-sql.mjs, reset-password.mjs)
reference/finanzas-mockups/ # Mockups de referencia — committed
docs/                       # Bitácora, decisiones, notas persistentes
```

### 3.2 · Patrones de módulo

Cada módulo bajo `src/modules/` sigue este layout:

```
modules/<dominio>/<entidad>/
├── api.ts          # Wrappers de supabase.from(...)
├── hooks.ts        # useX / useCreateX / useUpdateX / useDeleteX (React Query)
├── XForm.tsx       # Form controlado que hace toInput/fromRow entre FormState y XInsert
├── XPrintable.tsx  # Vista imprimible (opcional pero preferido)
└── XSection.tsx    # UI de tabla + filtros + acciones + modales
```

### 3.3 · Patrones de RLS

Toda tabla nueva **debe** tener política de al menos uno de estos 3 patrones. Si no encaja, discutirlo antes de crearla.

- **Pattern A · Financial** (vales, liquidaciones, pagos, consumos, notificaciones):
  ```sql
  create policy read for select using (public.auth_rol() in ('admin','asistente'));
  create policy write for all
    using (public.auth_rol() in ('admin','asistente'))
    with check (public.auth_rol() in ('admin','asistente'));
  ```
- **Pattern B · Member** (tablas de un miembro específico, ej. arriaza_autos):
  ```sql
  create policy read for select using (public.auth_rol() in ('admin','asistente'));
  create policy write for all
    using (public.auth_rol() = 'admin')
    with check (public.auth_rol() = 'admin');
  ```
  La asistente puede LEER pero solo el admin escribe (ajustable según miembro).
- **Pattern C · Catálogo** (empleados, entidades, tarjetas, personas, status_sp):
  ```sql
  create policy read for select using (auth.uid() is not null);
  create policy write for all
    using (public.auth_rol() in ('admin','asistente'))
    with check (public.auth_rol() in ('admin','asistente'));
  ```

**Nunca** dejar una tabla sin RLS habilitado. `ALTER TABLE x ENABLE ROW LEVEL SECURITY;` es obligatorio.

### 3.4 · Convenciones de schema

- **PK:** `id uuid default gen_random_uuid() primary key`
- **Serial de negocio:** columna generada por trigger según `sequence` por año. Formato `{CODE}-YYYY-####` (ej. `VL-2026-0004`).
- **Timestamps:** `created_at`, `updated_at` (con trigger de update), `deleted_at nullable`. Soft delete siempre.
- **Auditoría:** trigger `audit_log_trigger` en cada tabla de negocio inserta en `audit_log` con `op/before/after/actor`.
- **FKs:** con nombre explícito `{tabla}_{campo}_fkey` para foreign keys críticos.
- **CHECK constraints:** todo lo semántico (montos > 0, enums coherentes, fechas ordenadas).

---

## 4 · Invariantes (no negociables)

Lista corta y estricta. Cada una tuvo un incidente real que la justifica.

| # | Regla | Por qué |
|---|---|---|
| **1** | Todo cambio de schema es una **migración SQL** en `supabase/migrations/` con timestamp. Nada de `ALTER TABLE` a mano en producción. | Reproducibilidad + auditabilidad + rollback. |
| **2** | Al final de **cada migración** que toque schema, agregar `NOTIFY pgrst, 'reload schema';`. Sin esto, PostgREST sirve el cache viejo y la app rompe con "column X not found in schema cache". | Incidente documentado en `memory/feedback_force_cache_invalidation.md`. |
| **3** | **RLS habilitado** en TODAS las tablas de `public`. Sin excepciones. | Sin RLS = data expuesta al mundo con el anon key. |
| **4** | **Personal JD (`personas`)** es la ÚNICA fuente de autorizadores/firmantes. La tabla `autorizadores` está deprecada. | Se creó en fase 15 justamente para consolidar. |
| **5** | **Serial de negocio siempre server-side** vía sequence + trigger. Nunca generar UUIDs de negocio en el cliente. | El cliente no tiene garantía de unicidad. |
| **6** | **Soft delete via `deleted_at`.** Nunca DELETE físico en tablas de negocio (excepto `pagos_notificaciones` que sí se marcan procesadas). | Se necesita historial para auditoría. |
| **7** | **Nunca `git push` sin autorización explícita** del usuario en la misma sesión. | Multiple cuentas de GitHub — riesgo alto de push a repo equivocado. |
| **8** | Múltiples cuentas Vercel/GitHub — **no asumir** que las credenciales cruzan proyectos. Verificar el team activo antes de deploy. | Documentado en `memory/feedback_multiple_accounts.md`. |
| **9** | **Nunca skips en hooks (`--no-verify`, `--no-gpg-sign`).** Si un hook falla, investigar y arreglar. | Los hooks existen por una razón. |
| **10** | **audit_log NUNCA se edita ni borra** desde la app. Solo escribe el trigger. | Es la única fuente de verdad histórica. |

---

## 5 · Método de trabajo

### 5.1 · Fases

El proyecto avanza en **fases numeradas**. Cada fase = 1 migración SQL + código correspondiente + commit(s) descriptivos + entrada en la bitácora.

Estado actual: fase **17** (Refactor Finanzas F-1 a F-5). Historial completo en [`docs/BITACORA.md`](docs/BITACORA.md).

Cada fase sigue el ciclo:

```
Plan (.md en raíz)  →  Migración SQL  →  Types actualizados  →
   Código React     →  Build verde     →  Commit(s)          →
Aplicar en Supabase → Verificar cache  →  Bitácora actualizada
```

### 5.2 · Antes de empezar una fase

1. Escribir un `PLAN-{TEMA}.md` en la raíz con secciones **Objetivo · Modelo · UI · Migración**.
2. Revisar mockups en `reference/` si existen.
3. Confirmar con el usuario el alcance antes de tocar código.

### 5.3 · Durante la fase

1. **Migración primero**, código después. Sin migración aplicada, el código no compila con types nuevos.
2. Regenerar `src/types/database.ts` manualmente (invocar skill `sync-schema` cuando exista).
3. Un módulo a la vez, un commit por unidad lógica coherente.
4. `npx tsc -b` verde antes de cada commit.
5. `npx vite build` verde antes de cada push.

### 5.4 · Al cerrar la fase

1. Aplicar migración en Supabase Studio (o vía `scripts/apply-sql.mjs`).
2. Correr `NOTIFY pgrst, 'reload schema';` (auto-append si se usó el script).
3. Verificar en la app deployada (Ctrl+Shift+R para bustear browser cache).
4. Agregar entrada a `docs/BITACORA.md` con fecha + commits + notas.
5. Si hubo una decisión de arquitectura, agregarla a `docs/PROCESO-Y-DECISIONES.md`.

### 5.5 · Skills útiles

Skills específicos de NOCTUA en `.claude/skills/`:
- **`apply-migration`** — aplica un `.sql` con auto-NOTIFY + verifica el resultado.
- **`sync-schema`** — regenera `src/types/database.ts` desde el schema real.
- **`check-rls`** — valida que una tabla tenga RLS + política coherente con los 3 patrones.
- **`audit-cea`** — auditoría integral (RLS + migraciones huérfanas + types desincronizados + bundle).

Skills genéricos que aplican: `verify`, `simplify`, `code-review`, `run`.

---

## 6 · Convenciones de código

### 6.1 · TypeScript

- **`strict: true`** en tsconfig. No relajar.
- Preferir **interfaces sobre types** para objetos con métodos; `type` para uniones/mapeos.
- **Nada de `any`.** Si no sabes el tipo, usa `unknown` y narrow con guards.
- **Imports absolutos** con `@/` prefix (ej. `@/lib/supabase`), nunca relativos con `../../..`.

### 6.2 · React

- **Función components** siempre. Class components están prohibidos.
- **Hooks al top-level.** Nada de hooks condicionales.
- **React Query** para toda data async. No `useEffect` + `fetch`.
- Estado local con `useState`; global con React Query cache.
- **Nunca `use client`** — no estamos en Next.js.

### 6.3 · Estilos

- **Tailwind únicamente.** No CSS-in-JS, no CSS modules, no `.css` sueltos.
- Paleta obligatoria: `teal / sand / rust / gold / purple` + `dark / dark-2 / dark-3`.
- No agregar colores nuevos sin actualizar `tailwind.config.js`.
- Para PDFs: preferir colores hex inline en `style={{}}` (Tailwind puede purgar clases en print).

### 6.4 · Comentarios

Regla general: **no comentar código obvio.** Solo agregar comentarios cuando:
- Hay una decisión no obvia que se toma (why, no what).
- Hay una restricción externa (bug de librería, workaround).
- Se difiere una feature con un motivo (marcar con `// DEFERRED · Fase N ·`).

Todos los comentarios en **español** (excepto docstrings de utils que exponen tipos).

### 6.5 · Commits

Formato:
```
[tipo]([módulo]): resumen imperativo en 50 caracteres

Descripción larga si aplica: qué cambió, por qué, qué queda pendiente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`.

Nunca `--amend` en commits ya pusheados. Nuevo commit siempre.

---

## 7 · Datos sensibles y seguridad

- **Nunca commitear** `.env`, `.env.local`, claves de Supabase service_role, PAT.
- **anon key** de Supabase SÍ va al frontend (es su propósito) — protegido por RLS.
- **Passwords de test:** usar solo emails ficticios o del propio dev.
- Si accidentalmente se comitea un secreto: rotar inmediatamente en Supabase + limpiar historial con `git filter-repo` o BFG.

---

## 8 · Deploy y operación

### 8.1 · Vercel

- Deploy automático desde `main` en el repo `ricardosagastumegon/ceanoctua`.
- `vercel.json` controla:
  - Cache headers (HTML no-store; assets 1 año immutable).
  - SPA fallback rewrite a `/index.html`.
- Env vars requeridas en Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### 8.2 · Supabase

- **Project ref:** `bbxieuyhzxqygkkxwvwo`
- **Region:** us-east-1 (verificar en dashboard)
- Migraciones se aplican **manualmente** en Supabase Studio SQL Editor.
- Backups: automáticos por Supabase (revisar plan). No hay estrategia adicional del dev.

### 8.3 · Rutas

- Local dev: `http://localhost:5173`
- Preview Vercel: `https://ceanoctua-<hash>.vercel.app`
- Producción: `https://cea.noctuapo.com`

---

## 9 · Cuando algo falla

Orden de diagnóstico ante un bug reportado por el usuario:

1. **¿Es de cache?** Errores tipo "column X not found in schema cache" → correr `NOTIFY pgrst, 'reload schema';` + Ctrl+Shift+R.
2. **¿Es de RLS?** Error 401/403 en la Network tab → verificar `public.auth_rol()` + política de la tabla.
3. **¿Es de types desincronizados?** TS compila pero runtime falla → regenerar `types/database.ts` desde el schema real.
4. **¿Es del schema?** `column does not exist` en Postgres → confirmar migración aplicada.
5. **¿Es del cliente?** Console errors con `contentscript.js` → NO es nuestro, es extensión del browser (MetaMask típico).

---

## 10 · Puntos de contacto rápidos

- **Dueño del proyecto:** Ricardo (`ricardosagastumegon@…`)
- **Usuaria clave operativa:** Angeles Quezada (asistente)
- **Repo GitHub:** `ricardosagastumegon/ceanoctua`
- **Deploy Vercel:** account `ricardosagastumegons-projects`
- **Supabase project:** `bbxieuyhzxqygkkxwvwo`

---

**Última actualización:** este archivo se actualiza en el mismo commit donde cambia una invariante o el stack. No dejarlo desactualizado.

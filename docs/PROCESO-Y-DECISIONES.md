# Proceso y Decisiones · CEA NOCTUA

Documento vivo de **decisiones de arquitectura y proceso**. Cada decisión se registra con contexto, alternativas consideradas, elección y consecuencia. Formato inspirado en ADR (Architecture Decision Records) pero relajado.

Cuando una decisión se revierte o supersede, no se borra — se marca **Superseded by** y se agrega la nueva entrada.

---

## D-001 · Migrar el HTML monolítico a React + Vite

- **Fecha:** 2026-01-15
- **Contexto:** El proyecto vivía como un único archivo `index.html` de 1.7 MB con JS inline, localStorage como base de datos, y sin backend. Crecía rápidamente y era imposible hacer cambios seguros.
- **Alternativas:**
  - Mantener HTML pero modularizar en múltiples archivos → seguía sin backend real.
  - Next.js → over-engineering para el tamaño del proyecto.
  - Vite + React + Supabase → simple, moderno, sin backend custom.
- **Decisión:** Vite + React 18 + TypeScript strict + Supabase.
- **Consecuencias:** Bundle inicial ~500 KB gzip 145 KB. Refactor completo tomó ~6 fases. localStorage se abandona; usuario carga data via Excel importer (fase 17).

---

## D-002 · Supabase como único backend (sin API custom)

- **Fecha:** 2026-01-20
- **Contexto:** ¿Necesitamos un backend en Node/Deno o basta con Supabase directo?
- **Alternativas:**
  - Backend NestJS/Express + Supabase como DB → +1 componente + más complejidad.
  - Cloudflare Workers como proxy → mismo problema.
  - Supabase con RLS → cliente consume directo, sin capa intermedia.
- **Decisión:** Supabase directo con RLS estricto y triggers para lógica de negocio.
- **Consecuencias:** Zero backend Node. Lógica de negocio en Postgres (triggers, functions, generated columns). Se necesita disciplina fuerte con RLS y CHECK constraints — un bug ahí = data corrupta.
- **Trade-off aceptado:** Portabilidad reducida (moverse fuera de Supabase requeriría reescribir triggers). Aceptable para un proyecto de escala pequeña/media con un solo cliente.

---

## D-003 · Row-Level Security con 3 patrones fijos

- **Fecha:** 2026-05-30 (fase 11)
- **Contexto:** Cada nueva tabla requería pensar la política de RLS desde cero. Inconsistencias frecuentes. Auditoría de fase 12 encontró una tabla completa con RLS deshabilitado.
- **Alternativas:**
  - Un solo pattern "admin + asistente hacen todo" → no diferencia data operativa de catálogo.
  - Muchos patterns por caso → inconsistencias, difícil de auditar.
- **Decisión:** 3 patterns fijos documentados en CLAUDE.md §3.3:
  - **A · Financial:** admin + asistente escriben.
  - **B · Member:** admin escribe, asistente lee.
  - **C · Catálogo:** cualquier autenticado lee, admin + asistente escriben.
- **Consecuencias:** Toda tabla nueva DEBE encajar en uno de estos. Si no, se levanta discusión antes de crearla. Auditoría es una query simple ("¿RLS habilitado? ¿política cumple A/B/C?").
- **Skills asociadas:** `check-rls`.

---

## D-004 · Serial de negocio server-side vía sequences por año

- **Fecha:** 2026-05-31 (fase 11)
- **Contexto:** Los vales, liquidaciones, pagos, consumos necesitan un identificador humano corto (`VL-2026-0004`) además del UUID. ¿Dónde se genera?
- **Alternativas:**
  - Cliente lo calcula con `count(*) + 1` → race conditions.
  - Cliente genera un UUID acortado → no legible.
  - Sequence Postgres por año → atómico, incremental, legible.
- **Decisión:** `create sequence per_year_{tabla}_{year}` + trigger `before insert` que compone el serial `{PREFIX}-YYYY-####`.
- **Consecuencias:** Serial nunca colisiona. Reset natural cada año. El código de cliente jamás genera IDs de negocio.
- **Formato definido:**
  - Vales: `VL-YYYY-####`
  - Caja Chica Liq: `CC-YYYY-####`
  - Solicitudes de Pago: `SP-YYYY-####`
  - Firmas/Reintegros: `FR-YYYY-####`
  - Consumos TC: `{EMPRESA_CODE}-YYYY-####` (fase 17)

---

## D-005 · Soft delete via `deleted_at`

- **Fecha:** 2026-05-31 (fase 11)
- **Contexto:** El sistema requiere auditoría permanente. Si se borra un vale, ¿cómo reconstruir por qué?
- **Alternativas:**
  - DELETE físico + audit_log guarda el snapshot → audit_log crece linealmente + queries de audit son costosas.
  - Soft delete con `deleted_at nullable` → el row nunca desaparece.
- **Decisión:** Soft delete con `deleted_at`. Todas las queries de list filtran `is null` en `deleted_at`.
- **Consecuencias:** DB crece perpetuamente. Aceptable dado el volumen bajo (~cientos de rows/año).
- **Excepción:** `pagos_notificaciones` sí se marca como `procesado = true` sin soft delete (equivale semánticamente).

---

## D-006 · Auditoría automática por trigger

- **Fecha:** 2026-05-31 (fase 11)
- **Contexto:** ¿Cómo asegurar que TODA mutación queda registrada, incluso las que hace un dev con acceso directo a DB?
- **Alternativas:**
  - Escribir a audit_log desde el cliente → un cliente malicioso puede omitir.
  - Middleware en Supabase Edge Function → complejidad + latencia.
  - Trigger Postgres en cada tabla de negocio → transparente, atómico, no evitable.
- **Decisión:** Función `audit_log_trigger()` + `after insert/update/delete` en cada tabla de negocio.
- **Consecuencias:** Cada operación paga ~1 ms extra. `audit_log` crece. Se puede desactivar el trigger a nivel de DB si un dev necesita bulk load — pero eso requiere `superuser`, no `authenticated`.

---

## D-007 · Personal JD (personas) reemplaza autorizadores

- **Fecha:** 2026-06-04 (fase 15)
- **Contexto:** Existían `autorizadores` y `firmantes` como tablas separadas. Además, muchos miembros de la junta directiva también autorizaban. Data duplicada 3x.
- **Alternativas:**
  - Mantener 3 tablas con FK cruzadas.
  - Una tabla `personas` con flags `es_jd`, `es_autorizador`, `es_firmante`.
- **Decisión:** Tabla única `personas` con flags booleanos.
- **Consecuencias:** UI unificada (`PersonasCatalog` con chips). Migración one-time de `autorizadores → personas` con lookup por nombre. La tabla `autorizadores` queda huérfana pero no se dropea (backup histórico).

---

## D-008 · Multi-vale en liquidaciones (M:N junction)

- **Fecha:** 2026-06-07 (fase 17)
- **Contexto:** El modelo original tenía `caja_chica_vales.liquidacion_id` (1 vale → 1 liquidación). Pero en la operación real, una liquidación puede saldar varios vales pequeños.
- **Alternativas:**
  - Dejar 1:N y forzar al usuario a crear una liquidación por vale → fricción alta.
  - Junction table M:N `liquidacion_vales` → modelo correcto.
- **Decisión:** DROP `caja_chica_vales.liquidacion_id` + CREATE `liquidacion_vales(liquidacion_id, vale_id)`.
- **Consecuencias:** Trigger `mark_vale_as_assigned` cambia el estado del vale al vincular/desvincular. El form usa checkboxes multi-select.

---

## D-009 · Bandeja de Notificaciones de Pagos

- **Fecha:** 2026-06-07 (fase 17)
- **Contexto:** El flujo era: crear liquidación con `forma_pago = "Solicitud de Pago"` → separadamente crear el pago manualmente copiando datos. Fricción y error humano.
- **Alternativas:**
  - Auto-crear el pago al marcar "Solicitud de Pago" → pérdida de control (¿y si el usuario no quiere?).
  - Notificar al módulo Pagos con opción de crear → conserva control.
- **Decisión:** Tabla `pagos_notificaciones` + panel visible en Pagos. Al hacer click "+ Nueva solicitud" en una notif, el form abre pre-llenado. La notif se marca procesada al guardar el pago.
- **Consecuencias:** Nueva UX pattern del "buzón". Puede escalar a otros flujos (ej. "reintegros pendientes"). El botón PAGOS se abrió después para todas las liquidaciones (no solo SP) — el usuario decide.

---

## D-010 · SheetJS para .xlsx binario en importers

- **Fecha:** 2026-06-08 (fase 17 · bonus)
- **Contexto:** El usuario tiene sus datos en Excel (`.xlsx`). El CsvImporter inicial solo aceptaba CSV/TSV. Hostigar al usuario a "Guardar como CSV" era mala experiencia.
- **Alternativas:**
  - Solo CSV → mal UX.
  - Backend en Supabase Edge que parsee → complejidad + latencia.
  - SheetJS en el cliente → +340 KB de bundle, pero lazy.
- **Decisión:** SheetJS `xlsx@0.18.5` con lazy loading. El chunk solo se descarga cuando el usuario abre el modal de importer.
- **Consecuencias:** Bundle inicial no crece. Primer clic en "Importar" tarda ~1 seg extra. Trade-off aceptable.

---

## D-011 · PostgREST cache: `NOTIFY pgrst, 'reload schema'` obligatorio

- **Fecha:** 2026-06-07 (fase 17, aprendizaje de dolor)
- **Contexto:** Aplicamos la migración de fase 17. Frontend rompe con "Could not find column X in schema cache" aunque el DDL fue exitoso.
- **Root cause:** PostgREST (la API que sirve Supabase) cachea el schema en memoria al arrancar. DDL nuevo no invalida ese cache automáticamente.
- **Alternativas:**
  - Restart PostgREST manualmente → requiere acceso admin infra.
  - Esperar el ciclo automático de refresh → hasta 10 min de app rota.
  - `NOTIFY pgrst, 'reload schema';` desde SQL → efecto en <5 seg.
- **Decisión:** Regla obligatoria: cada migración termina con `NOTIFY`. `scripts/apply-sql.mjs` lo auto-appendea si falta.
- **Consecuencias:** Ninguna nueva migración rompe la app por cache stale. Regla codificada en CLAUDE.md §4 · invariante 2.

---

## D-012 · Vercel cache headers: HTML no-store, assets 1 año immutable

- **Fecha:** 2026-06-08 (fase 17 hotfix)
- **Contexto:** Después de deploys, usuario veía la versión vieja de la app hasta hacer Ctrl+Shift+R.
- **Root cause:** Vercel/Cloudflare cacheaba `index.html` con TTL largo. El HTML apunta a assets hasheados (nuevos por build), pero si el HTML es viejo, apunta a assets viejos.
- **Alternativas:**
  - Query string cache buster → hack feo.
  - Service Worker que fuerza update → complejidad.
  - HTTP cache headers correctos → limpio.
- **Decisión:** `vercel.json` con:
  - `/` y `/index.html` → `Cache-Control: no-store, no-cache, must-revalidate`.
  - `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (los hashes garantizan unicidad).
- **Consecuencias:** Cada deploy es visible inmediatamente. Ctrl+Shift+R ya no requerido. **BUG:** en el commit inicial se perdió el rewrite de SPA fallback → 404 al refrescar. Hotfix commit `6b4d9b9`.

---

## D-013 · Sin librería de UI (Radix/shadcn) — todo custom

- **Fecha:** 2026-01-20
- **Contexto:** ¿Usar Radix, shadcn, Chakra, MUI o custom?
- **Alternativas:**
  - shadcn → excelente base pero copia mucho código.
  - Radix → primitives + estilos custom → sí es opción.
  - Custom desde cero → control total, bundle mínimo.
- **Decisión:** Custom desde cero con Tailwind.
- **Consecuencias:** Componentes propios: `Modal`, `PrintableModal`, `DataTable`, `TextInput`, `Select`, `TextArea`, `StepTracker`, `Toast`, `ConfirmDialog`, `CsvImporter`. Bundle mínimo. Trade-off: cero accesibilidad "por defecto" — hay que agregarla manualmente (WIP).

---

## D-014 · PDFs vía React + window.print (sin librería)

- **Fecha:** 2026-05-31 (fase 11)
- **Contexto:** Vales, liquidaciones, pagos, consumos requieren PDF descargable.
- **Alternativas:**
  - `jsPDF` → API imperativa, difícil componer.
  - `react-pdf` (rendering) → +2 MB bundle.
  - `html2canvas + pdf-lib` → canvas snapshot pesado.
  - React component + `window.print` + CSS `@media print` → cero librería, control total.
- **Decisión:** Componentes `XPrintable.tsx` renderizados dentro de `PrintableModal`. El usuario hace `Ctrl+P` o botón Imprimir → dialog nativo del browser → "Guardar como PDF".
- **Consecuencias:** Cero librería. UX aceptable (2 clicks: preview → imprimir). Trade-off: no se puede embedar imágenes external ni fuentes custom sin `@font-face` — hasta ahora no ha sido un problema.

---

## D-015 · Skills propios de NOCTUA (fase 17 + bonus)

- **Fecha:** 2026-06-08 (fase 17)
- **Contexto:** Cada sesión de Claude Code repite: apply migration, sync types, check RLS, audit. Es fricción repetitiva.
- **Alternativas:**
  - Documentar en CLAUDE.md y confiar en que Claude siga las instrucciones → funciona pero cada vez requiere que Claude re-descubra los pasos.
  - Crear Skills en `.claude/skills/` → invocables con `Skill` tool, contexto encapsulado.
- **Decisión:** 4 skills iniciales:
  - `apply-migration` — auto-NOTIFY + verificación.
  - `sync-schema` — regenerar `types/database.ts`.
  - `check-rls` — validar patterns A/B/C en una tabla.
  - `audit-cea` — auditoría integral.
- **Consecuencias:** Menos fricción entre sesiones. Skills bien mantenidos son documentación viva y ejecutable.

---

## D-016 · Extender `audit_trigger` a catálogos que se crean después de fase 3

- **Fecha:** 2026-07-12 (fase 18)
- **Contexto:** La función `public.audit_trigger()` de fase 3 (2026-05-24) se attachó **solo a las 6 tablas financieras** (`tc_consumos`, `reintegros`, `caja_chica_vales`, `caja_chica_liquidaciones`, `pagos`, `vouchers`). Los catálogos posteriores (empleados, entidades, personas, status_sp, tarjetas, tipos_pago) NO tienen audit_trigger — cambios en el catálogo se ejecutan sin dejar rastro histórico. Al crear el catálogo Vehículos (fase 18), enfrenté la decisión de seguir ese patrón o divergir.
- **Alternativas:**
  - Seguir el patrón actual: catálogos sin audit_trigger. Ventaja: consistencia con los 6 catálogos ya existentes. Desventaja: viola la Regla 0 (CLAUDE.md §4 invariante 10 · "audit_log NUNCA se edita ni borra desde la app. Solo escribe el trigger").
  - Divergir: agregar audit_trigger al nuevo catálogo. Ventaja: cumple Regla 0. Desventaja: inconsistencia con los otros 6 catálogos.
- **Decisión:** Divergir a favor de la Regla 0. Vehículos lleva `audit_trigger`. Los otros catálogos existentes NO se retrofittean (el costo de hacerlo es rehacer 6 migraciones + testing, sin beneficio inmediato).
- **Consecuencias:**
  - A partir de fase 18, **todo catálogo nuevo lleva `audit_trigger`**.
  - Los 6 catálogos originales quedan como deuda técnica documentada. Si en algún momento la asistente o el admin toca un catálogo de forma sospechosa, no hay rastro. Riesgo bajo (los catálogos cambian pocas veces al año) pero explícito.
  - La divergencia queda anotada como comentario en el header de cada migración de catálogo nueva a partir de fase 18.
- **How to apply:** En cada nueva migración de catálogo, agregar el bloque `do $$ begin if exists (select 1 from pg_proc where proname = 'audit_trigger') then ... end if; end $$;` con `create trigger audit_<tabla>` — ver `20260711000001_fase18_vehiculos.sql` líneas 61-74 como referencia.

---

## D-017 · Módulo T&T: portar completo a React vs. hosting HTML estático

- **Fecha:** 2026-07-12 (fase 19 · planning)
- **Contexto:** El proveedor entregó T&T como archivo HTML único standalone (~5000 líneas de vanilla JS + Leaflet + localStorage). El README de integración asume trasplantar el HTML dentro del monolito HTML original de Board Assistant — pero NOCTUA ya migró de ese monolito a React + Supabase en fase 1. Dos caminos posibles.
- **Alternativas:**
  - **A · Hosting estático del HTML:** subir `TT_modulo.html` a `/public/tt.html` y linkearlo desde el menú. Ventaja: 1 h de trabajo, cero refactor. Desventaja: rompe 4 invariantes de CLAUDE.md §4 (invariante 3 sin RLS · invariante 10 sin audit_log · el "stack" §2 sin vanilla JS · datos en localStorage por navegador = un-user, no multi-user).
  - **B · Portar completo al stack:** 20 tablas nuevas, 14 sub-módulos React, ~19 h. Ventaja: cumple Regla 0 y todas las invariantes; multi-user real; backup automático; auditoría; consistencia visual. Desventaja: 19x más caro.
  - **C · Híbrido:** portar solo el schema y las páginas de listado a React, dejar los forms de servicios como iframes al HTML original. Ventaja: costo medio. Desventaja: los forms de HTML no pueden persistir en Supabase sin código intermedio — igual necesitarías endpoint REST o similar.
- **Decisión:** **B · Portar completo**. Confirmado explícitamente por el usuario el 2026-07-12: *"al lenguaje y arquitectura que hoy tengamos"*.
- **Consecuencias:**
  - Fase 19 se descompone en 6 sub-fases (F19-0 a F19-5) — plan detallado en `PLAN-TT-TOUR-Y-TRAVEL.md`.
  - Recursos reutilizables de NOCTUA (PrintableModal, DataTable, Modal, createCrudHooks, CsvImporter, Storage bucket, RLS Pattern A) reducen mucho el trabajo. Solo lo específico de T&T (los 14 forms + itinerario dinámico + map Leaflet + calendar) es realmente nuevo.
  - Bundle target: mantener < 500 KB inicial vía lazy routing agresivo. Leaflet lazy-lazy dentro de la página TT.
  - **Regla nueva:** todo proveedor externo que entregue un módulo standalone en HTML+vanilla se traduce, nunca se copia-pega. Registrado en memory `feedback_provider_html_modules.md`.

---

## D-018 · Bootstrap del AuthProvider: `getUser()` en vez de `getSession()`

- **Fecha:** 2026-07-12 (fase 19-0 · debug post-deploy)
- **Contexto:** Bug crítico intermitente en producción — la app se quedaba en splash "Cargando…" forever en la mayoría de sesiones (en varias computadoras). El `AuthProvider` llamaba `supabase.auth.getSession()` que jamás resolvía la Promise, así que `setLoading(false)` nunca corría. El primer fix defensivo agregó timeout de 8s + `.finally()`, lo que evitó el bloqueo eterno pero dejó al usuario con `session=null` → `profile=null` → pantalla "No hay perfil cargado" (ver `AUDIT-2026-07-12.md` finding C-1).
- **Root cause identificado:** `supabase.auth.getSession()` lee el token de `localStorage` (no hace fetch) y espera un evento `INITIAL_SESSION` de `onAuthStateChange`. Ese evento en presencia de extensiones que monkey-patchean `window.postMessage` (MetaMask, Rabby, Phantom, Coinbase Wallet, etc.) NUNCA se dispara. Los warnings de `contentscript.js:14083` (`MaxListenersExceededWarning`, `orphaned data for stream`) que apareció en la consola confirman que había extensiones saturando el `EventEmitter` global. El usuario confirmó que pasa en varias computadoras — probablemente muchos tienen alguna wallet crypto instalada.
- **Alternativas:**
  - **A · `getUser()` en vez de `getSession()`:** hace fetch HTTP a `/auth/v1/user` con el bearer token. Resuelve o rechaza siempre (no depende de eventos locales). Contras: requiere leer el token de `localStorage` manualmente para reconstruir la `Session`. La `Session` reconstruida tiene solo `user` — el resto de campos (`access_token`, `refresh_token`, `expires_at`) vienen del `localStorage`. Suficiente para el `AuthContext`.
  - **B · Invalidar el token al fallar y forzar re-login:** más agresivo — el usuario tendría que volver a loguear cada vez que el bootstrap se cuelga. Malo UX.
  - **C · Downgrade `@supabase/supabase-js` a una versión anterior:** riesgoso — otras versiones podrían tener otros bugs. Y no fixea el root cause.
  - **D · Migrar a un cliente HTTP directo (sin supabase-js):** rewrite masivo. Fuera de alcance.
- **Decisión:** **A · `getUser()` + reconstrucción de Session desde `localStorage`**. Además, mantener el timeout defensivo (reducido a 5s porque `getUser()` ya no debería colgarse — el timeout es red de seguridad para casos raros como network offline).
- **Consecuencias:**
  - Bootstrap ahora siempre resuelve. La app carga bien aunque haya extensiones crypto instaladas.
  - Un fetch HTTP extra por bootstrap (~50-200ms latencia). Aceptable — ya sucede al llamar `loadProfile()` inmediatamente después de todos modos.
  - Si el token está expirado, `getUser()` devuelve `error` y caemos limpiamente al login (comportamiento correcto).
  - **NO se cambia el flujo de `signIn` / `signOut`** — esos no tienen el bug porque son operaciones activas del usuario, no bootstrap pasivo.
- **How to apply:** ver [`src/lib/auth.tsx`](src/lib/auth.tsx) commit posterior a `b7ff827`. Patrón replicable si en el futuro `supabase-js` reintroduce el bug: cualquier operación "leer estado local" debe ser reemplazada por una llamada HTTP real.

---

## Plantilla de nueva decisión

```
## D-NNN · Título corto

- **Fecha:** YYYY-MM-DD
- **Contexto:** el problema o pregunta.
- **Alternativas:** las que se consideraron.
- **Decisión:** la elegida y por qué.
- **Consecuencias:** trade-offs, efectos secundarios.
- **Supersedes:** D-XXX (opcional, si reemplaza otra).
```

# Pendientes · CEA NOCTUA

Lista viva de items **por hacer** que no bloquean la operación diaria pero merecen atención. Se actualiza al cierre de cada fase y al aplicar cualquier fix parcial.

Formato: cada item con **origen** (dónde se detectó), **impacto**, **estimado**, **estado**. Cuando se cierra, mover a la sección "✅ Cerrados" con la fecha y el commit.

---

## 🔴 Bloqueadores de producción (fix inmediato)

_(vacío al 2026-07-12 · el C-1 se resolvió en commit `895ad26`)_

---

## 🟡 Deuda técnica (agenda dentro de las próximas 2 fases)

### DT-1 · Setup de vitest + primeros tests unitarios

- **Origen:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding M-2
- **Impacto:** Regresiones detectadas solo en manual QA. En una app con 30 migraciones y ~25 módulos, es riesgoso. El bug del bootstrap (C-1) hubiera sido detectado en un test.
- **Estimado:** 30 min para setup + 1 test del AuthProvider (garantiza que el timeout dispara + `loading=false` siempre). Luego, ir agregando tests por módulo conforme se toque.
- **Alcance mínimo aceptable:**
  - `vitest` + `@testing-library/react` como devDeps
  - `src/lib/auth.test.tsx` con 3 casos: (a) bootstrap OK, (b) bootstrap con timeout, (c) `loadProfile` throws
  - Script `npm test` en `package.json`
  - CI opcional (fuera de alcance mínimo)
- **Estado:** Pendiente. Agendar **antes de F19-1**.

### DT-2 · 27 de 30 migraciones históricas sin `NOTIFY pgrst`

- **Origen:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding M-1
- **Impacto:** Ninguno práctico (ya están aplicadas hace tiempo, el cache está fresh). Solo relevante si se re-aplican por rollback + apply de una migración vieja sin usar `scripts/apply-sql.mjs`.
- **Estimado:** 0 min (no vale la pena tocar). La regla ya está codificada en `scripts/apply-sql.mjs` que auto-appende `NOTIFY`. Toda migración nueva escrita a partir de fase 18 termina con `NOTIFY pgrst, 'reload schema';`.
- **Estado:** Aceptado como deuda documentada. No hacer.

### DT-3 · `att_pins` deprecada pero aún viva

- **Origen:** [`docs/REPORTE-ESTADO-TT-ACTUAL.md`](REPORTE-ESTADO-TT-ACTUAL.md) §3.5 · comentario de fase 8
- **Impacto:** Ninguno funcional (nadie la usa, no está en types). Cosmético: 1 tabla + 1 índice + 1 policy RLS + 1 audit_trigger (post F19-0) consumiendo un slot en `pg_tables`.
- **Estimado:** 15 min · migración `drop table if exists public.att_pins`.
- **Estado:** Aceptar por ahora. Dropear cuando estemos ciertos de que nadie tiene planes de usarla (F19-5 · itinerario final decidirá si el mapa necesita pines por-servicio en vez de por-viaje).

### DT-4 · Actualizar `usuarios.nombre` de todos los usuarios con NULL

- **Origen:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding M-3
- **Impacto:** Estético — topbar renderiza `null` en el nombre.
- **Estimado:** 1 SQL UPDATE por usuario afectado. Al 2026-07-12 solo Angeles (`ff19eebc-d239-446e-92f7-4210fa67a60f`).
- **Script listo:** [`supabase/scripts/fix-usuarios-nombres.sql`](../supabase/scripts/fix-usuarios-nombres.sql)
- **Estado:** Pendiente que el usuario lo aplique en Supabase Studio.

---

## 🟢 Housekeeping / mejoras de proceso

### HK-1 · Skills propios de NOCTUA en `.claude/skills/`

Los 4 skills existentes (`apply-migration`, `sync-schema`, `check-rls`, `audit-cea`) están OK. Idea futura si aparecen patrones repetitivos:

- **`bootstrap-fix`** — auto-diagnóstico del "Cargando…" (comprobar env vars + getUser + loadProfile + audit_log) por si el bug del C-1 reaparece en otra forma
- **`gen-service-module`** — generador para F19-1..F19-5: dado un nombre de servicio, crea `services/<name>/api.ts`, `hooks.ts`, `<Name>Form.tsx`, `<Name>Printable.tsx` con el pattern estándar

### HK-2 · Validación end-to-end pendiente de F19-0

- **Origen:** F19-0 fase actual
- **Qué falta:**
  1. Confirmar que el fix C-1 dejó la app cargando bien (después del deploy de `895ad26`)
  2. Aplicar `fix-usuarios-nombres.sql` (DT-4)
  3. Prueba real del soft-delete: crear viaje test-soft-delete + hijos → borrar → validar `deleted_at` + `audit_log`
- **Estado:** Pendiente que el usuario lo valide. Sin esto no cerramos F19-0 y no arrancamos F19-1.

### ~~HK-3 · Fix permanente del webhook GitHub→Vercel · usar Deploy Hook~~ ✅

Cerrado el 2026-08-07 en commit `b3b5802`. Setup ejecutado:
- Vercel Deploy Hook creado: `https://api.vercel.com/v1/integrations/deploy/prj_kdnc2WS0hHmZdnMI5RKJdVjdez0u/n04ti0SrEf`
- GitHub webhook id `662696047` apuntando a esa URL, event `push`, active
- Delivery test confirmada: `status: OK`, latencia 4.59s

Ya no depende de GitHub App de Vercel ni de OAuth tokens múltiple-cuenta. Redundante con el webhook viejo (ambos coexisten).

---

## Fase actual en curso

**F19 · CERRADA** el 2026-08-09. Los 14 servicios T&T ya operan en producción con:
- Schema 17 tablas nuevas + Regla 0 completa
- CRUD end-to-end (14 forms + sections)
- ItineraryModal + BackupModal + FinishedFolder
- Skill `import-tt-backup` para cargar JSON del standalone HTML

Ver [`docs/BITACORA.md`](BITACORA.md) fase 19 completa.

## Deferred a polish futuro (no bloquean uso)

### DT-5 · 14 Printables (vistas imprimibles por servicio)

- **Origen:** F19-3d — el HTML standalone tiene una vista imprimible tipo "boarding pass" por cada servicio con logo Arriaza + gradient + total. En CEA solo el ItineraryModal es imprimible.
- **Impacto:** No poder exportar/imprimir un ticket individual como PDF (workflow legacy del standalone).
- **Estimado:** ~4h (1 printable template shared + 14 variantes por servicio).

### DT-6 · Share modal WhatsApp (html2canvas)

- **Origen:** F19-3f — el HTML tiene botones "🎁 Compartir" que exportan la tarjeta del viaje como imagen PNG para pegar en WhatsApp.
- **Impacto:** Estético / conveniencia. Los usuarios pueden hacer screenshot manual.
- **Estimado:** ~2h (agregar html2canvas como lazy dep + generar canvas del TripCard + descargar).

### DT-7 · Calendar interactivo lateral

- **Origen:** F19-3e — el HTML tiene un calendario lateral que muestra los días con viajes coloreados por estado. En CEA hay solo el mapa Leaflet.
- **Impacto:** Menor — el listado ya cumple el rol de navegación temporal.
- **Estimado:** ~3h.

### DT-8 · Skill `check-rls-full` para monitoreo semanal

- **Origen:** [D-021](PROCESO-Y-DECISIONES.md#d-021) · incidente RLS off en 34 tablas.
- **Impacto:** Prevenir que se repita el incidente sin ser detectado.
- **Estimado:** 30 min (query SQL diagnóstico + skill wrapper).

### DT-9 · Import backup: mapping completo de servicios en BackupModal UI

- **Origen:** F19-3f MVP.
- **Impacto:** El botón "Importar JSON" solo importa metadatos del viaje. Los servicios (14 tipos) requieren usar el skill `import-tt-backup` manualmente.
- **Estimado:** ~3h (portar la lógica del skill al TypeScript del modal).

---

## ✅ Cerrados (histórico corto)

| Fecha | ID | Cerrado en commit |
|---|---|---|
| 2026-08-09 | **F19 completa** · T&T con 14 servicios + backup + itinerary + docs | commits `b347470..683abd3` (~7500 LOC, 40+ archivos) |
| 2026-08-09 | **INCIDENTE RLS 34 tablas** · re-enable + ADR D-021 | migración `20260813000002_fix_rls_reenable.sql` |
| 2026-08-09 | **C-1 v4** · auth con timeout + auto-nuke storage | `2bf31cd` fix(auth) · ADR D-020 |
| 2026-08-09 | **M-3** · Angeles.nombre corregido | aplicado por usuario en Supabase |
| 2026-08-09 | **DT-4** · usuarios.nombre NULL fix | mismo aplicado por usuario |
| 2026-08-07 | **HK-3** · Deploy Hook manual GitHub→Vercel | `b3b5802` chore(test) · webhook id 662696047, delivery OK 4.59s |
| 2026-08-07 | **C-1 · getSession() cuelga forever** · validado por usuario | `895ad26` fix(auth) — reemplazo por getUser() · app cargando OK |
| 2026-07-12 | **F19-0** · Regla 0 compliance att_* | `1a767d0` feat(arriaza) + `b7ff827` fix defensivo previo |
| 2026-07-11 | **Fase 18** · Catálogo Vehículos | `6a5f343` feat(admin) |

---

**Última actualización:** 2026-07-12 · post-fix C-1. Actualizar cada vez que se cierre un item o se agregue uno nuevo.

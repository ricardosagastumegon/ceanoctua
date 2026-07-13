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

### HK-3 · Reconectar el webhook GitHub→Vercel de forma permanente

- **Origen:** debug del 2026-07-12
- **Impacto:** El webhook se rompe periódicamente (segunda vez este mes). Cuando pasa, los pushes no auto-deployan hasta que se reconecta manualmente.
- **Estimado:** 5 min · en Vercel Settings → Git → Disconnect + Connect de nuevo (última vez que se hizo así funcionó por ~2 semanas).
- **Estado:** Reconectado hoy 2026-07-12. Si se rompe otra vez, considerar mover la config a Vercel CLI + `vercel.json` (más complicado, pero más estable).

---

## Fase actual en curso

**F19-0** · Regla 0 compliance de las 13 tablas `att_*` (Arriaza T&T).

- ✅ Migración aplicada (`20260712000001_fase19_0_att_regla0.sql`)
- ✅ Types actualizados
- ✅ Código soft-delete-aware en 10 archivos
- ✅ Build verde
- ⏳ Validación end-to-end (bloqueado por HK-2)

## Siguiente

**F19-1** · 5 servicios simples del [`PLAN-TT-TOUR-Y-TRAVEL.md`](../PLAN-TT-TOUR-Y-TRAVEL.md) — tiendas, reuniones, rutas, pois, restaurantes. Estimado 3 h.

**Prerequisitos para arrancar F19-1:**
- HK-2 completo (validación F19-0)
- Idealmente: DT-1 (vitest setup) para no acumular más deuda

---

## ✅ Cerrados (histórico corto)

| Fecha | ID | Cerrado en commit |
|---|---|---|
| 2026-07-12 | **C-1 · getSession() cuelga forever** | `895ad26` fix(auth) — reemplazo por getUser() |
| 2026-07-12 | **F19-0** · Regla 0 compliance att_* | `1a767d0` feat(arriaza) + `b7ff827` fix defensivo previo |
| 2026-07-11 | **Fase 18** · Catálogo Vehículos | `6a5f343` feat(admin) |

---

**Última actualización:** 2026-07-12 · post-fix C-1. Actualizar cada vez que se cierre un item o se agregue uno nuevo.

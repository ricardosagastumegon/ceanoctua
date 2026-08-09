# Bitácora · CEA NOCTUA

Registro cronológico de cambios de fondo. **No es un changelog** (para eso está `git log`), es el diario de decisiones y contexto de cada fase. Cada entrada explica **por qué** más que **qué**.

Formato: `## Fase N · YYYY-MM-DD · Título` seguido de bullets Objetivo / Cambios / Comentarios.

---

## Bootstrap fix · 2026-07-12 · C-1 CRITICAL del AUDIT

**Objetivo:** arreglar el bug intermitente "Cargando…" eterno / "No hay perfil cargado" que bloqueaba la app en producción para la mayoría de sesiones.

**Ver:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding C-1 + ADR [D-018](PROCESO-Y-DECISIONES.md#d-018).

**Cambios:**
- `src/lib/auth.tsx` — bootstrap ahora usa `supabase.auth.getUser()` (fetch HTTP real) en vez de `getSession()` (que espera evento local que nunca llega con extensiones crypto tipo MetaMask instaladas).
- Reconstrucción de `Session` desde `localStorage` para exponerla al `AuthContext`.
- Timeout defensivo reducido de 8s a 5s (getUser() ya no cuelga; el timeout es solo red de seguridad para network offline).
- Se mantienen `.catch`/`.finally` y try/catch alrededor de `loadProfile` (garantiza `setLoading(false)` siempre).

**Housekeeping incluido:**
- `supabase/scripts/fix-usuarios-nombres.sql` — script para arreglar `usuarios.nombre = NULL` de Angeles (finding M-3).

**Regresa al día siguiente:** F19-1 · servicios simples del PLAN-TT-TOUR-Y-TRAVEL.md (tiendas, reuniones, rutas, pois, restaurantes).

---

## Fase 19 · 2026-07-12 → 2026-08-09 · T&T Tour & Travel completo

**Objetivo:** portar el módulo standalone HTML de T&T (14 servicios + itinerario + calendar + map Leaflet) al stack de NOCTUA — React + TypeScript strict + Supabase con RLS Pattern A + triggers de audit.

### F19-1 · Schema completo T&T (2026-08-09)

Migración `20260813000001_fase19_1_att_tt_completo.sql`:
- ALTER `att_viajes` · `trip_no text unique` + `manual_status` (Solicitado/En planeación/En curso/Finalizado) + sequence `att_viaje_seq` + trigger auto-gen `TT-YYYY-####`.
- CREATE 17 tablas nuevas: `att_rentas`, `att_tours`, `att_aeronaves`, `att_acuaticos`, `att_ferries`, `att_terrestres`, `att_tiendas`, `att_actividades` + `att_actividad_tickets` + `att_actividad_subtickets`, `att_reuniones`, `att_rutas`, `att_pois`, `att_day_plans` + `att_day_plan_rows`, `att_day_notes`, `att_hotel_habitaciones`.
- Todas con Regla 0: PK uuid, FK cascade, AuditCols, deleted_at, RLS Pattern A, triggers audit_trigger + set_updated_at_with_by.

**Bug encontrado y corregido en el proceso**: la migración original usaba `update_updated_at_column()` que no existe en CEA — se cambió a `set_updated_at_with_by()` (nombre canónico desde fase 4).

### F19-2 · API + hooks + cascade viajes

- 13 pares api.ts + hooks.ts para los servicios nuevos (rentas, tours, aeronaves, etc.).
- Infra compartida: `constants/serviceMeta.ts` (14 servicios · TT_SVC_META), `constants/countries.ts` (~213 países con aliases), `constants/airports.ts` (~180 IATA), `utils.ts`, `branding.ts`, `shared/PaymentFields.tsx`, `shared/OwRtFields.tsx`.
- `viajes/api.ts` extendido: cascade soft-delete alcanza 17 tablas nuevas + nietos (habitaciones, tickets de actividad, day_plan_rows) + bisnietos (subtickets).
- Sync auto reunión → day_plan_rows implementado en `reuniones/api.ts::syncReunionToDayPlan` desde React Query hook onSuccess.
- Reutilización de `createCrudHooks` factory de `src/lib` para hooks estándar.
- Intento de helper genérico `makeTripChildApi` descartado: el union de tablas hacía imposible tipar sin recurrir a `any` (violación §6.1). Cada api.ts tiene CRUD inline directo contra Supabase (~30 LOC c/u).

### F19-3 · UI completa (4 bloques + fixes)

**F19-3a** · Playwright setup + smoke tests (2/2 pass · guarda contra C-1).

**F19-3b** · 5 shared UI: `CountryPicker` (autocomplete con aliases), `AirportPicker` (autocomplete IATA), `PaymentMethodSelect` (lee tarjetas_credito), `EstadoPagoBadge`, `ManualStatusSelect`.

**F19-3c** · Rebuild AttPage completo: hero gradient + KPIs (Viajes/En curso/Próximos) + toolbar (búsqueda + filtro estado + sort) + grid trip cards. TripCard con flag país + trip_no + auto-status + ManualStatusSelect + dropdown "+ Agregar Servicios" (14 opciones).

**Bug encontrado y corregido**: color `navy` no estaba en tailwind.config → gradient hero invisible → tsc-verde pero UI-rota. Fix agregando `navy: '#0d2b2e'`.

**Bug encontrado y corregido (recurrente)**: C-1 volvió tras 1h porque `getUser()` no refresh el token expirado. Fix v3 con `refreshSession()` retry. Aún se colgaba por lock interno de supabase-js → fix v4 (final): `withTimeout(3s, ...)` por operación + `nukeSessionStorage()` + auto-redirect `/login` cuando falla. Ver ADR D-020.

**Incidente de seguridad** durante F19-3: Supabase Advisor reportó 34 tablas de `public` con RLS deshabilitado (att_* viejas + finanzas + catalogos). Fix inmediato: `supabase/migrations/20260813000002_fix_rls_reenable.sql` re-habilita RLS en las 34. Causa raíz sin confirmar — sospecha: rollback parcial mal manejado del primer intento de F19-1, o cambio silencioso de Supabase. Ver ADR D-021.

**F19-3d** · 14 servicios con UI (4 bloques): Tiendas + Rutas + POIs + Reuniones (bloque 1) · Tours + Aeronaves + Rentas (bloque 2, con `shared/PaymentFields`) · Acuáticos + Ferries + Terrestres (bloque 3, con `shared/OwRtFields`) · Actividades con tickets+subtickets anidados + Hoteles con habitaciones múltiples (bloque 4).

**Fix UX en el camino**: se eliminó el sub-nav de tabs que duplicaba el dropdown "+ Agregar Servicios". Ahora todas las Sections se renderean apiladas (paridad HTML).

**F19-3e** · ItineraryModal + DayPlanModal + DayNoteModal. Botón 📋 en cada TripCard abre ItineraryModal (día por día desde fecha_ini→fecha_fin, con rows del day_plan y notas). Modal imprimible con `window.print()`.

**F19-3f** · BackupModal (export JSON completo de todas las att_* + import MVP de metadatos del viaje) + FinishedFolder (viajes con manual_status='Finalizado' en grid separado con botón "↩ Reactivar").

### F19-4 · Skill import-tt-backup

Documenta el mapping completo campo por campo del JSON del standalone HTML → INSERTs SQL para las tablas CEA. Cubre los 14 servicios + subtablas + preservación de tripNo + idempotencia via `on conflict`. Ver [`.claude/skills/import-tt-backup.md`](../.claude/skills/import-tt-backup.md).

### F19-5 · QA + docs cierre

- Playwright: 3 smoke tests pass (login, bundle, /arriaza sin errores). CRUD tests skippeados (necesitan E2E_USER + E2E_PASS).
- Bundle inicial: **141.23 KB gzip** (target 145 · +0.29 vs pre-F19). Route `/arriaza` lazy: **84.54 KB gzip**.
- Deferred a polish futuro: 14 printables por servicio, Share modal con html2canvas, Calendar interactivo lateral.
- Total: **17 tablas nuevas + 40+ archivos TS + ~7,500 LOC** en F19 completa.

---

## Fase 20 · próximos pasos posibles

Ideas post-F19 (no comprometidos):
- Skill `check-rls-full` para auto-detectar tablas con "Policy Exists RLS Disabled" antes de que Supabase Advisor las flaggée
- Vitest setup + tests unitarios (DT-1)
- Printables por servicio (F19 polish)
- Share to WhatsApp (F19 polish)
- Calendar lateral interactivo en /arriaza (F19 polish)


**Estado:** planificación completa. Ver [PLAN-TT-TOUR-Y-TRAVEL.md](../PLAN-TT-TOUR-Y-TRAVEL.md) para el detalle. Descompuesto en 6 sub-fases (F19-0 a F19-5), estimado ~19 h de trabajo.

**Alcance confirmado por el usuario:**
- Los 14 servicios se implementan todos (nada se difiere)
- Portar completo al stack de NOCTUA (no hosting estático del HTML)
- Igual prioridad que otros items pendientes

**Entregables recibidos como input:**
- `TT_modulo.html` (~5000 líneas standalone) del proveedor
- `README_INTEGRACION_TT_CEA.md` con instrucciones de integración

**Comentarios:**
- El HTML asume integración en el monolito HTML original de Board Assistant. NOCTUA ya migró de ese monolito en fase 1. Copiar-pegar rompería 4 invariantes de CLAUDE.md §4 (stack, RLS, audit_log, storage). Se traduce al modelo NOCTUA en su totalidad.
- 20 tablas nuevas (15 raíz + 5 sub) + 6 enums + 2 catálogos globales (aeropuertos_iata, paises_catalogo con seed).
- Reusa: PrintableModal, DataTable, Modal, createCrudHooks, CsvImporter, Storage bucket comprobantes, RLS Pattern A.

---

## Fase 18 · 2026-07-12 · Catálogo Vehículos (flota empresa)

**Objetivo:** agregar catálogo para la flota vehicular de la empresa. Distinto de `arriaza_autos` (autos personales de LA · fase 13).

**Cambios de schema:**
- Tabla `vehiculos` con 6 campos + auditoría + soft delete
- Índice único parcial `vehiculos_placa_activa_uidx` en `(placa) where deleted_at is null`
- Triggers `set_updated_at` + `audit_trigger`
- RLS Pattern C · Catálogo

**Cambios de UI:**
- Módulo nuevo `src/modules/admin/vehiculos/` con api, hooks, VehiculoForm, VehiculosSection
- Sub-tab "Vehículos" en AdminPage entre Tarjetas y Status SP
- Reusa CatalogPage genérico

**Divergencia intencional documentada:**
Los otros catálogos (empleados, entidades, personas, status_sp, tarjetas, tipos_pago) NO tienen `audit_trigger` — solo lo tienen las 6 tablas financieras según fase 3. Vehículos SÍ lo lleva porque la Regla 0 (CLAUDE.md §4 invariante 10) dice "audit_log NUNCA se edita ni borra… solo escribe el trigger". Ver ADR D-016 en `docs/PROCESO-Y-DECISIONES.md`.

**Comentarios:**
- Sin validación de formato de placa (queda pendiente de confirmar con el usuario).
- Fase pequeña — 45 min de trabajo total, siguió el patrón canonical de `status_solicitud_pago` (fase 16 · F-0).

**Commits clave:** commit fase 18 = `2520eb1` .. HEAD (pendiente push explícito).

---

## Fase 17 · 2026-06-07 → 2026-06-08 · Refactor Finanzas F-1 a F-5

**Objetivo:** Reorganizar el módulo Finanzas para reflejar el modelo real de la operación: Vales (desembolso vs a entidad), Liquidaciones con multi-vale, Reintegros como dashboard read-only, Consumos TC con line items y notificaciones, Pagos con bandeja de origen.

**Cambios de schema:**
- Enum `vale_tipo` (`desembolso`, `entidad`) + 4 columnas nullable en `caja_chica_vales`.
- Tabla junction `liquidacion_vales` (M:N) reemplaza el `liquidacion_id` que estaba en vales.
- Nuevos campos en `caja_chica_liquidaciones` (producto_servicio, forma_pago, reintegrar_a_persona_id, totales calculados por trigger).
- `caja_chica_liq_rows.factura`.
- 5 nuevos campos en `tc_consumos` + tabla `consumo_renglones` con trigger que recalcula el total.
- `tarjetas_credito.color` para gallery visual.
- **Rename `pagos.estado → pagos.status`** + `status_id` FK al catálogo `status_solicitud_pago` (fase 16).
- Tabla nueva `pagos_notificaciones` con RLS.

**Cambios de UI:**
- Vales: 2 botones (+ Nuevo Vale · + Vale a Entidad), dropdowns invertidos según tipo, botón + Liquidar por fila.
- Liquidaciones: multi-vale via checkboxes, botón 💸 PAGOS (siempre visible desde el hotfix).
- Reintegros: reescrito como dashboard read-only sobre vales tipo=entidad.
- Consumos TC: gallery de cards por tarjeta con color custom, botón + TC CORP, botón Estado de Cuenta (PDF vía print).
- Pagos: panel Notificaciones lateral púrpura, PagoForm con status_id del catálogo, timeline horizontal con círculos y fechas.
- ConsumoPrintable nuevo: header púrpura-azul según mockup image37/image23.
- PagoPrintable: timeline horizontal reemplaza el vertical StepTracker.

**Bonus (no en el plan):**
- SheetJS `xlsx` para importer binario.
- CsvImporter genérico + 6 importadores wireados (Entidades, Personal JD, Empleados, Proveedores, Tarjetas, Status SP, Tipos Pago, Vales, Consumos TC, Liquidaciones, Pagos).
- Datalist para sub-listas de tareas con 9 categorías.

**Comentarios:**
- El botón PAGOS originalmente se mostraba solo cuando `forma_pago = 'Solicitud de Pago'` — mala asunción. Se abrió después para **siempre visible** con canEdit=true.
- El PostgREST schema cache mordió al primer test post-migración. Se agregó `NOTIFY pgrst, 'reload schema';` como práctica obligatoria en `scripts/apply-sql.mjs` y al final de cada migración.
- El `vercel.json` inicial rompió SPA fallback al limpiar `_comment` fields. Hotfix commit `6b4d9b9`.

**Commits clave:** `eea3cea` (schema+types), `de34af6` (multi-vale+notifs), `3778a8b` (importer+gallery), `2c32585` (4 catálogos importer), `c4da61f` (SheetJS+printables), `f54d5f3` (+ Liquidar+TC CORP), `a9f32e0` (anti-cache), `91e12cc` (PAGOS siempre+PDF estado cuenta), `6b4d9b9` (SPA fallback fix).

---

## Fase 16 · 2026-06-05 · F-0 estructural de Finanzas

**Objetivo:** Preparar el terreno para el refactor F. Reorganizar tabs y crear el catálogo `status_solicitud_pago`.

**Cambios:**
- Nueva tabla `status_solicitud_pago` con 6 filas seed (Generado → En Solicitud de Firma → Firmado → Presentado → Procesado → Pagado).
- FinanzasPage con 5 tabs en el orden correcto (Vales · Liquidaciones · Reintegros · Consumos TC Corp · Pagos), removida Vouchers.
- Hash navigation entre tabs.

**Comentarios:**
- El catálogo es requisito de F-5. Sin él, la fase 17 no compila el `pagos.status_id`.
- Vouchers queda deprecado en UI pero la tabla `vouchers` permanece para no romper migración.

---

## Fase 15 · 2026-06-04 · Personal JD (personas)

**Objetivo:** Consolidar todos los "quienes firman/autorizan/son JD" en una sola tabla `personas` con flags. Reemplaza `autorizadores` (que quedaba huérfana + duplicada).

**Cambios:**
- Nueva tabla `personas` con `es_jd`, `es_autorizador`, `es_firmante` (bools).
- FK migradas desde `autorizadores` hacia `personas` (via lookup por nombre).
- Seed de 12 personas desde el Excel del cliente.
- PersonasCatalog en Admin con chips coloreados de roles.

**Comentarios:**
- El Excel original venía en CP1252 leído como UTF-8 → mojibake. Se transliteró manualmente (Ã© → é).
- La tabla `entidades.direccion` (no `dir`) — solo `autorizadores`/`personas` usan `dir`. Diferencia esencial descubierta a golpes en el seed.

---

## Fase 14 · 2026-06-03 · Firma → Pago link

**Objetivo:** Cerrar el ciclo firmas ↔ pagos. Cuando un pago necesita firma de un firmante, guardar la referencia bidireccional.

**Cambios:**
- Columna `pago_id` en tabla `firmas` con FK.
- Trigger que actualiza el estado del pago cuando la firma se registra.

---

## Fase 13 · 2026-06-02 · Arriaza sub-tablas

**Objetivo:** Modelar la profundidad de datos del miembro Arriaza (LA) — el que más información maneja: residencias, autos, mascotas, staff, salud, docs, holding, servicios.

**Cambios:**
- 8 tablas hijas nuevas: `arriaza_autos`, `arriaza_residencias`, `arriaza_mascotas`, `arriaza_staff`, `arriaza_docs`, `arriaza_salud`, `arriaza_holding`, `arriaza_servicios`.
- Todas siguen el Pattern B de RLS (asistente lee, admin escribe).
- ArriazaPanel con navegación por sub-tab.

**Comentarios:**
- Esta fase decidió el patrón "sub-tablas de miembro" que luego se generalizará si otros miembros crecen.
- El miembro LA tiene ~40% del volumen de datos del sistema.

---

## Fase 12 · 2026-06-01 · Audit fixes

**Objetivo:** Correcciones de una auditoría adversarial. 3 findings críticos + 4 medios.

**Fixes críticos:**
- **C-1:** RLS Pattern C bloqueaba asistente en tablas CEA. Se agregó `admin OR asistente` a las policies de write.
- **C-2:** Trigger `sync_vale_liquidacion_link` perdía el estado previo del vale al desvincular. Se agregó columna `estado_previo`.
- **C-3:** Faltaban CHECK constraints en montos, fechas y enums. Se agregaron 7.

**Fixes medios:**
- Tabla huérfana `cea_directorio` — DROP.
- Índices faltantes en columnas usadas por queries frecuentes.
- Trigger `updated_at` faltante en 2 tablas.
- `deleted_at` no chequeado en queries de list.

---

## Fase 11 · 2026-05-30 → 2026-05-31 · CC Board rewrite

**Objetivo:** Reescribir Caja Chica Board (vales, liquidaciones, vouchers) desde cero con el modelo correcto: seriales, estados, RLS. Reemplaza el HTML monolítico legacy.

**Cambios:**
- 4 tablas nuevas: `caja_chica_vales`, `caja_chica_liquidaciones`, `caja_chica_liq_rows`, `vouchers`.
- Enums `vale_status`, `pago_estado`, `tc_tipo`.
- Sequences per-año con format `VL-YYYY-####`, `CC-YYYY-####`, `VCH-YYYY-####`.
- Triggers de audit_log en las 4.
- Modulo `lavanderia` (submodulo LA).
- `pagos` con StepTracker de 6 pasos y `step_dates` array.
- 8 firmantes iniciales en `firmas`.

**Comentarios:**
- Esta es la fase que marcó el fin del HTML monolítico como fuente de verdad. A partir de aquí el DB es el único.
- Se decidió NO migrar el localStorage — el usuario cargaría data via Excel más tarde (que se materializó en Fase 17 con los importers).

---

## Fases 1-10 (pre-Claude Code) · 2026-01 → 2026-05

Fundaciones del proyecto: setup Vite/React/TS, config Supabase, RLS baseline, esquema básico de `usuarios` + `miembros_board`, primera versión de la UI de Board sin CC Board.

Detalle en git log (`git log --oneline --before=2026-05-29`).

---

## Ejemplo de siguiente entrada (plantilla)

```
## Fase N · YYYY-MM-DD · Título corto

**Objetivo:** una frase que explique por qué.

**Cambios de schema:** (si aplican)
- Tabla X…
- Enum Y…

**Cambios de UI:**
- Módulo X…

**Comentarios:** decisiones, incidentes, workarounds.

**Commits clave:** `hash1`, `hash2`.
```

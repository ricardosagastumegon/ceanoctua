# Bitácora · CEA NOCTUA

Registro cronológico de cambios de fondo. **No es un changelog** (para eso está `git log`), es el diario de decisiones y contexto de cada fase. Cada entrada explica **por qué** más que **qué**.

Formato: `## Fase N · YYYY-MM-DD · Título` seguido de bullets Objetivo / Cambios / Comentarios.

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

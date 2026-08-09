# PLAN · Integración completa del módulo T&T en CEA (Fase 19)

> Supersede parcialmente [`PLAN-TT-TOUR-Y-TRAVEL.md`](PLAN-TT-TOUR-Y-TRAVEL.md) — el HTML entregado el 2026-08-09 amplía significativamente el alcance (share/backup/print/rooms múltiples/actividad-tickets/etc.).

**Fecha:** 2026-08-09 · **Fase:** 19 · **Estimado total:** ~24 h (5 sub-fases + carga de backup)

---

## 1 · Objetivo

Portar el módulo standalone `TT_modulo.html` (5759 LOC, 14 servicios, 22 modales, backup portable, share WhatsApp, itinerario por días) a la arquitectura CEA (**React 18 + Vite + TS strict + Supabase RLS + React Query v5 + Tailwind**), preservando **toda** la funcionalidad y reglas de negocio.

**Fuente de verdad:** el HTML entregado. Si algo en CEA choca con la lógica del HTML, se adapta CEA — **no la lógica del módulo**.

**Al final:** importar el JSON de respaldo que el usuario tenga desde el standalone HTML.

---

## 2 · Estrategia arquitectónica

### 2.1 · Nombramiento y schema

**Decisión:** mantener el prefijo `att_*` (consistente con las 13 tablas ya en Regla 0). Mapeo HTML → Supabase:

**Existentes (13, ya en Regla 0):**
- `att_viajes` — necesita ALTER: agregar `trip_no text unique` + `manual_status text` (Solicitado/En planeación/En curso/Finalizado). El `estado` (enum `trip_status`) que ya existe se calcula por fechas y coexiste con el workflow manual.
- `att_tickets` + `att_ticket_pax` + `att_ticket_segments` + `att_ticket_pay_records` (ya OK — sólo agregar cols de estado_pago/pagado_con si faltan)
- `att_hoteles` + `att_hotel_services` (extras) + `att_hotel_pay_records`
- `att_restaurantes` + `att_restaurant_diners` + `att_restaurant_services` + `att_restaurant_pay_records`
- `att_pins` (deprecada — dejar como está)

**Nuevas (17):**
1. `att_hotel_habitaciones` — hotel.rooms[] (feature nueva: N habitaciones)
2. `att_rentas` — trip.rentas · extras como JSONB (`[{label, amount}]`)
3. `att_tours` — trip.tours
4. `att_aeronaves` — trip.aeronaves
5. `att_acuaticos` — trip.acuaticos (con `tipo OW/RT` + campos `ret_*`)
6. `att_ferries` — trip.ferries (con `tipo OW/RT` + `servicio_para Personas/Vehículos`)
7. `att_terrestres` — trip.terrestres (con `tipo OW/RT`)
8. `att_tiendas` — trip.tiendas (sin costo)
9. `att_actividades` — trip.actividades (parent)
10. `att_actividad_tickets` — actividad.ticketsActividad[]
11. `att_actividad_subtickets` — ticketActividad.subtickets[]
12. `att_reuniones` — trip.reuniones (sin costo — sync a day_plan_rows desde React Query, NO desde trigger)
13. `att_rutas` — trip.rutas (sin costo — link + descripcion)
14. `att_pois` — trip.pois · puntos como JSONB (`[{nombre, descripcion}]`)
15. `att_day_plans` — trip.dayPlans (parent)
16. `att_day_plan_rows` — dayPlan.rows[]
17. `att_day_notes` — trip.dayNotes

**Total al final del F19:** 13 (existentes) + 17 nuevas = **30 tablas `att_*`**.

**Simplificaciones vs plan inicial:**
- `renta.extras` y `poi.puntos` van como **JSONB** en vez de tabla hija (arrays de objetos simples que siempre se fetch/edit con el parent).
- **No creamos `att_*_pay_records`** por cada servicio nuevo. El HTML sólo tiene `estatus_pago` + `estado_pago` + `pagado_con` como columnas escalares. Menos ruido, matches HTML behavior.
- **Sync reunión → day_plan_rows queda en React Query** (mutation onSuccess), NO en trigger SQL. Simplifica ediciones cruzadas.

### 2.2 · Reglas obligatorias por tabla nueva

Cada tabla nueva **debe** cumplir (Regla 0 + CLAUDE.md §3.4):

- PK `id uuid default gen_random_uuid()`
- `viaje_id uuid references att_viajes(id) on delete cascade`
- `AuditCols` completos: `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`
- Trigger `audit_trigger` para `audit_log`
- Trigger `update_updated_at`
- RLS **Pattern A** (Financial — admin + asistente rw)
- Índices compuestos: `(viaje_id) where deleted_at is null`
- Migración con `NOTIFY pgrst, 'reload schema';` al final

### 2.3 · Serial de negocio

- `att_viajes.tripNo` → sequence `att_viaje_seq_{año}` + trigger. Formato `TT-YYYY-####`.
- Los servicios NO llevan serial visible (son hijos de viaje).

### 2.4 · Storage de archivos

El HTML sólo guarda **nombre** del archivo (`confirmFile`). En CEA:
- **Fase 19-3** (backend files): usar **Supabase Storage** bucket `att-comprobantes/{viaje_id}/{servicio_tipo}/{uuid}-{filename}`.
- Los archivos NO se importan del backup (el HTML nunca los tuvo, sólo el nombre).

### 2.5 · Assets externos del HTML

- **Leaflet 1.9.4** — ya usado en `ArriazaMap.tsx`, mantener.
- **html2canvas 1.4.1** — nueva dep. Lazy import solo cuando se abre "share/download image".
- **Google Fonts Nunito + Montserrat** — ya cargadas en `index.html`.
- **Logos base64 Arriaza** — inline como constantes en `src/modules/arriaza/branding.ts`.
- **TT_AIRPORTS** (~180) → `src/modules/arriaza/data/airports.ts`.
- **TT_COUNTRIES** (~213) → `src/modules/arriaza/data/countries.ts` + aliases.

### 2.6 · Impacto en bundle

Bundle actual: 141 KB gzip / 145 target. Riesgo alto.

**Mitigaciones:**
- **Ruta `/arriaza` lazy** (ya lo está en el router).
- `html2canvas` → dynamic import solo al hacer share.
- `leaflet` → ya lazy en la ruta.
- Airport + Country data → separados, lazy import per-modal.
- El módulo T&T entero debería sumar <200KB gzip a la ruta lazy (no al bundle inicial).

**Nueva memoria:** [[bundle-att-lazy-loading]] — target: bundle inicial se mantiene <145 KB gzip.

---

## 3 · Sub-fases (ejecución secuencial)

### F19-1 · Schema completo (~3 h)

**Deliverable:** 1 migración SQL con las 16 tablas nuevas + FKs + índices + RLS + triggers + NOTIFY.

- `supabase/migrations/20260813000001_fase19_1_att_completo.sql`
- Types: regenerar `src/types/database.ts` (skill `sync-schema`)
- Verificar RLS con skill `check-rls` en todas las nuevas

**Commit:** `feat(arriaza): F19-1 · schema completo T&T (16 tablas + RLS Pattern A)`

---

### F19-2 · Módulos CRUD de los 11 servicios nuevos + itinerario (~8 h)

**Deliverable:** por cada servicio, el patrón CLAUDE.md §3.2:

```
src/modules/arriaza/{servicio}/
├── api.ts        # supabase.from() + soft-delete cascade
├── hooks.ts      # useX / useCreateX / useUpdateX / useDeleteX
├── {X}Form.tsx   # form controlado (paridad 1:1 con modal del HTML)
└── {X}Printable.tsx  # vista imprimible (paridad con ttShow{X}Flyer)
```

**Orden:**
1. `tiendas`, `rutas`, `reuniones`, `pois` (simples, sin costo) — 1.5 h
2. `tours`, `aeronaves`, `terrestres` (moderados) — 2 h
3. `rentas` (con extras hijos), `acuaticos`, `ferries` (con OW/RT) — 2 h
4. `actividades` (con `tickets + subtickets` anidados) — 1.5 h
5. `att_day_plans` + `att_day_notes` + auto-sync reunión → day_plan (1 h)

**Extensión de servicios existentes:**
- `hoteles`: agregar `att_hotel_habitaciones` (rooms múltiples) + migración de datos viejos a 1 habitación
- `tickets` y `restaurantes`: agregar `estatusPago`/`estadoPago`/`pagadoCon`/`confirmFile` (ya casi todo existe)

**Reunion auto-sync:** trigger SQL en `att_reuniones` que inserta/actualiza fila en `att_day_plan_rows` con `_reunion_id = new.id` — así el sync es transaccional, no del cliente.

**Commit por lote:** 5 commits (uno por bloque del orden arriba).

---

### F19-3 · Rebuild de `AttPage.tsx` con feature parity (~7 h)

**Deliverable:** `src/modules/arriaza/AttPage.tsx` completamente reescrito. Reemplaza los actuales 250 LOC con ~800 LOC organizados en subcomponentes:

```
src/modules/arriaza/
├── AttPage.tsx                    # composición general (hero + grid + folder)
├── AttHero.tsx                    # hero con logo + stats + CTA crear viaje
├── AttToolbar.tsx                 # search + filters + sort + [Share dashboard] + [Backup]
├── TripsList.tsx                  # lista de viajes activos
├── TripCard.tsx                   # card con head + body + services toggle + itinerary toggle
│   ├── TripCardHead.tsx           # flag + tripNo + title + dest + dates + manual status select
│   ├── TripCardServices.tsx       # lista colapsable de servicios agregados
│   ├── TripCardAddMenu.tsx        # dropdown "+ Agregar Servicios" (14 opciones)
│   ├── TripCardProgress.tsx       # timeline de planificación día × día
│   └── TripCardItinerary.tsx      # panel del Itinerario General inline
├── TripViewModal.tsx              # vista previa modal
├── TripFormModal.tsx              # crear/editar viaje (con country picker + IATA)
├── FinishedFolder.tsx             # carpeta "Viajes Realizados" (grid coloreado)
├── ShareModal.tsx                 # resumen para WhatsApp (usa html2canvas lazy)
├── BackupModal.tsx                # respaldo/restore + HTML portable + JSON
├── ItineraryModal.tsx             # itinerario final imprimible (PDF via window.print)
├── DayPlanModal.tsx               # detalle Horario|Itinerario del día
├── DayNoteModal.tsx               # nota corta del día
├── CalendarSide.tsx               # calendario lateral con navegación por mes
├── MapSide.tsx                    # mapa lateral compact + expandible
├── shared/
│   ├── PaymentMethodSelect.tsx    # lee state.tcPresiCards de Supabase
│   ├── CountryPicker.tsx          # autocomplete con aliases
│   ├── AirportPicker.tsx          # autocomplete IATA
│   ├── FileUploadChip.tsx         # sube a Storage bucket
│   ├── EstadoPagoBadge.tsx        # colores por estado
│   └── ManualStatusSelect.tsx     # dropdown Solicitado/En planeación/…
├── services/                      # forms + printables por servicio
│   ├── tickets/…                  # (extender existente)
│   ├── hotel/…                    # (extender existente + rooms)
│   ├── restaurantes/…             # (extender existente)
│   ├── renta/…                    # (nuevo)
│   ├── tours/…                    # (nuevo)
│   ├── aeronave/…                 # (nuevo)
│   ├── acuatico/…                 # (nuevo)
│   ├── ferry/…                    # (nuevo)
│   ├── terrestre/…                # (nuevo)
│   ├── tiendas/…                  # (nuevo)
│   ├── actividades/…              # (nuevo)
│   ├── reunion/…                  # (nuevo)
│   ├── ruta/…                     # (nuevo)
│   └── poi/…                      # (nuevo)
├── printable/
│   ├── PrintableShell.tsx         # header con logo + footer estándar
│   ├── {N}Printable.tsx           # 14 templates (uno por servicio)
│   └── ItineraryPrintable.tsx     # itinerario completo
├── data/
│   ├── airports.ts                # TT_AIRPORTS (~180)
│   ├── countries.ts               # TT_COUNTRIES (~213) + aliases
│   └── serviceMeta.ts             # TT_SVC_META (colores, íconos por tipo)
└── branding.ts                    # logos base64 Arriaza
```

**Estilo:** Tailwind con paleta CEA existente (teal / sand / rust / gold / purple / navy). Los colores custom por servicio (14) se declaran como config Tailwind extend en `tailwind.config.js`.

**Sin CSS-in-JS**, sin `<style>` inline (excepto en Printables donde print-cleanup lo requiere per CLAUDE.md §6.3).

**Print CSS:** agregar módulo `src/modules/arriaza/print.css` con las reglas `@media print` del HTML.

**Sin `use client`**, sin Next.js — Vite + React puro (invariante CLAUDE.md §6.2).

**Commits:** 8-10 commits temáticos por bloque (hero+toolbar+trips-list, form+view modals, itinerary+dayplan, calendar+map, share, backup, printables, folder, wiring final).

---

### F19-4 · Skill nuevo `import-tt-backup` + carga del backup real (~2 h)

**Deliverable:**

1. **Nuevo skill** `.claude/skills/import-tt-backup.md` — recibe un JSON del formato standalone HTML y lo transforma a INSERTs Supabase:
   - Mapea `state.ttTrips[i]` → INSERT en `att_viajes` (preservando `tripNo`)
   - Por cada viaje, INSERTs a las 14 sub-tablas
   - Maneja migraciones de esquema viejo:
     - `hotel.tipoHab/tarifa` planos → 1 fila en `att_hotel_habitaciones`
     - `actividad.tarifa/personas` planos → 1 fila en `att_actividad_tickets`
   - No importa archivos (solo `confirm_file_name`)
   - `preserveIds` opcional (por defecto genera UUIDs nuevos)
   - Skip filas con `deleted_at` (no importar borrados)
   - Idempotente: si el `tripNo` ya existe → SKIP con warning

2. **Script generado en scratch**: `supabase/scripts/import-tt-{fecha}.sql` con los INSERTs listos para aplicar.

3. **Ejecución**: el usuario aplica el SQL en Supabase Studio.

**Commit:** `feat(skills): import-tt-backup skill + data del standalone HTML importada`

---

### F19-5 · QA + docs + cierre (~2 h)

1. Skill `verify` sobre F19-5 completo:
   - `npx tsc -b` verde
   - `npx vite build` verde
   - Bundle inicial <145 KB gzip (crítico)
2. QA manual guiado:
   - Crear un viaje test con al menos 1 servicio de cada uno de los 14 tipos
   - Validar Itinerario Final en línea + modal imprimible
   - Share dashboard image + share single trip image
   - Export JSON → Import JSON → datos coinciden
   - Ctrl+P → PDFs generados correctamente
3. Docs:
   - Update `docs/BITACORA.md` — entrada F19-1..F19-5 con commits
   - Update `docs/PROCESO-Y-DECISIONES.md` — ADR D-019 "port T&T HTML → React con feature parity"
   - Update `docs/PENDIENTES.md` — cerrar F19-1..F19-5, agregar cualquier deuda residual
   - Actualizar [`docs/REPORTE-ESTADO-TT-ACTUAL.md`](docs/REPORTE-ESTADO-TT-ACTUAL.md) marcándolo obsoleto

**Commit final:** `docs(bitacora): cierra F19 · T&T integrado completo con paridad HTML`

---

## 4 · Prerequisitos que se **saltan** por autorización explícita del usuario

El PENDIENTES.md exige `HK-2` + `DT-1` antes de F19-1. Con este plan explícito, el usuario está autorizando:

- **HK-2** (validación E2E de F19-0): asumida OK porque F19-1 la va a ejercitar mucho más
- **DT-1** (vitest): se posterga a **post-F19** (nueva deuda: DT-5 "tests para módulo T&T")
- **DT-4** (Angeles nombre): sigue pendiente pero no bloquea

Se agregarán en PENDIENTES.md después de F19-5.

---

## 5 · Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Bundle inicial pasa 145 KB gzip | Alta | Rompe target | Ruta `/arriaza` lazy + `html2canvas`/`leaflet` dynamic import + audit al cierre |
| Sync auto reunión → day_plan diverge entre trigger SQL y UI cache | Media | Datos inconsistentes | React Query `invalidate(['att_day_plans'])` tras cada mutación de `att_reuniones` |
| RLS Pattern A bloquea Angeles en escritura | Baja | 403 en runtime | `check-rls` skill valida cada tabla nueva antes del commit |
| Formato del backup JSON del usuario cambia entre versiones del HTML standalone | Media | Import falla | Skill `import-tt-backup` con validador de esquema y warnings claros |
| html2canvas rompe con emojis en Windows | Media | Share genera imagen vacía | Test manual + fallback: mostrar toast con instrucciones si canvas queda blanco |
| Datos "efqwrqe" test en producción se mezclan con los reales del backup | Baja | Confusión | Borrarlos antes de importar (soft-delete) |
| Sequence `att_viaje_seq_{año}` colisiona con tripNo del backup | Alta | Duplicate key | Skill `import-tt-backup` bumpea la sequence al max(tripNo) del backup antes de INSERT |

---

## 6 · Ejecución

**Modo:** Auto — voy fase por fase, commit al terminar cada una, push solo cuando el usuario autorice explícitamente.

**Punto de control después de cada fase:**
- F19-1: `tsc` + `check-rls` verdes → **commit local, sigo F19-2**
- F19-2: `tsc` + smoke test un servicio → **commit local, sigo F19-3**
- F19-3: `tsc` + `vite build` + bundle <145 KB gzip → **commit local, pido push antes de F19-4**
- F19-4: skill funciona con backup del usuario → **aplico SQL en Supabase**
- F19-5: `verify` verde + QA manual → **push final + cierre F19**

**Estimado calendario:**
- Si voy sin bloqueos: **1 sesión larga o 2 sesiones normales** (24 h netas de trabajo)
- Si el usuario prefiere spread: **1 fase por sesión × 5 sesiones**

---

## 7 · Checklist antes de arrancar F19-1

- [ ] Usuario aprueba este plan
- [ ] Usuario confirma que puede aplicar la migración SQL en Supabase Studio al terminar F19-1
- [ ] Usuario tiene listo el archivo JSON del backup del standalone HTML (para F19-4)
- [ ] Rama actual `main` limpia (`git status` OK) — ya confirmado en el contexto
- [ ] Sin pushes destructivos: nunca `--force`, nunca `--no-verify` (invariantes 7 y 9)

---

**Autor:** plan generado automáticamente el 2026-08-09 tras analizar `TT_modulo.html` (5759 LOC) + estado actual de `src/modules/arriaza/`.

**Próximo paso:** el usuario responde con **GO** para arrancar F19-1, o pide ajustes al plan.

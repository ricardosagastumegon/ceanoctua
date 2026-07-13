# PLAN · Fase 19 · T&T (Tour & Travel)

**Objetivo:** portar el módulo standalone HTML/vanilla-JS de T&T (14 servicios + itinerario por días + calendario + mapa) al stack de NOCTUA (React 18 + Vite + TypeScript strict + Supabase + RLS), respetando la Regla 0 y las 10 invariantes de [CLAUDE.md](CLAUDE.md).

**Estado actual:** módulo entregado como archivo HTML único (`TT_modulo.html`) con `localStorage['boardState2'].ttTrips`. **NO se copia-pega.** Se traduce al modelo de NOCTUA.

**Referencia autoritativa:** el HTML entregado + `README_INTEGRACION_TT_CEA.md`.

**Alcance confirmado por el usuario:**
1. Los 14 servicios se implementan (nada se difiere).
2. Prioridad igual al resto de items pendientes.
3. Portar completo al stack actual — no hosting estático del HTML.

---

## 1 · Modelo de datos (Supabase)

### 1.1 Enums nuevos

| Enum | Valores |
|---|---|
| `viaje_manual_status` | `Solicitado`, `En planeación`, `En curso`, `Finalizado` |
| `estado_pago` | `Reservado`, `Pagado`, `Pago parcial`, `A pagar en propiedad`, `Cancelado` |
| `tipo_ruta` | `OW`, `RT` |
| `ferry_servicio_para` | `Personas`, `Vehículos` |
| `traslado_tipo_servicio` | `Privada`, `Colectiva`, `Otro` |
| `ticket_categoria` | `Económica`, `Premium Economy`, `Ejecutiva`, `Primera Clase` |

### 1.2 Tabla raíz: `viajes`

```sql
create table public.viajes (
  id             uuid primary key default gen_random_uuid(),
  serial         text unique,                       -- TT-YYYY-#### (trigger)
  title          text not null,
  country        text,
  country_code   text,                              -- ISO2 para el mapa
  dest           text not null,
  participants   text,
  reason         text,
  start_date     date not null,
  end_date       date not null,
  manual_status  viaje_manual_status not null default 'Solicitado',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  check (end_date >= start_date)
);
```

+ trigger `set_updated_at`, `audit_trigger`, sequence `viajes_seq_YYYY` para serial `TT-YYYY-####`.

### 1.3 Sub-tablas de itinerario

```sql
create table public.viaje_dia_plans (
  id           uuid primary key default gen_random_uuid(),
  viaje_id     uuid not null references public.viajes(id) on delete cascade,
  fecha        date not null,
  dia          text,        -- ej. "Día 7"
  lugar        text,
  created_at, updated_at, deleted_at,
  unique(viaje_id, fecha) where deleted_at is null
);

create table public.viaje_dia_plan_rows (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.viaje_dia_plans(id) on delete cascade,
  orden        int not null,
  horario      time,
  itinerario   text,
  fuente_reunion_id uuid references public.viaje_reuniones(id) on delete set null,
  created_at, updated_at
);

create table public.viaje_dia_notes (
  id           uuid primary key default gen_random_uuid(),
  viaje_id     uuid not null references public.viajes(id) on delete cascade,
  fecha        date not null,
  texto        text not null,
  created_at, updated_at, deleted_at,
  unique(viaje_id, fecha) where deleted_at is null
);
```

### 1.4 Tablas de los 14 servicios

**Patrón común a todos** (columnas base):

```sql
id              uuid primary key default gen_random_uuid(),
viaje_id        uuid not null references public.viajes(id) on delete cascade,
comprobante_url text,          -- Supabase Storage
created_at, updated_at, deleted_at
```

**Servicios con costo** agregan además:

```sql
estatus_pago  text,             -- texto libre "Depósito 50% pagado"
estado_pago   estado_pago not null default 'Reservado',
pagado_con    text              -- referencia a tarjetas_credito o texto libre
```

#### Los 14 servicios con sus campos específicos

| # | Tabla | Campos específicos | Total |
|---|---|---|---|
| 1 | `viaje_tickets` | titulo, aerolinea, reservado, categoria, pnrs text[], tipo tipo_ruta, salida, retorno, checkin_ini/fin, origen/origen_ciudad/etd, destino/destino_ciudad/eta, escala/escala_tiempo, ret_* (todos los origen/destino/escala de retorno) | Σ pax(tarifa+extras) |
| 1a | `viaje_ticket_pax` (sub) | ticket_id FK, orden, nombre, nacionalidad, pasaporte, usuario, ticket_num, asiento, equipaje_personal/carryon/documentado, tarifa, extras | — |
| 2 | `viaje_hotels` | nombre, ciudad, direccion, telefono, reserva_nombre, pax, reservado, tipo_habitacion, early_checkin, confirmacion, checkin date, checkout date, **noches int GENERATED**, desayuno, cancelacion, tarifa | tarifa×noches + Σextras |
| 2a | `viaje_hotel_extras` (sub) | hotel_id FK, orden, label, amount | — |
| 3 | `viaje_restaurantes` | nombre, descripcion, ciudad, direccion, telefono, tipo_servicio, reserva_nombre, pax, reservado, fecha, horario, confirmacion, monto_pax, cancelacion | monto_pax×pax |
| 4 | `viaje_rentas` (vehículo) | nombre, ciudad, direccion, telefono, tipo_veh, desc_veh, reservado, reserva_nombre, confirmacion, recepcion_fecha/hora/dir, entrega_fecha/hora/dir, dias, tarifa, deposito, cancelacion | tarifa×dias + deposito + Σextras |
| 4a | `viaje_renta_extras` (sub) | renta_id FK, orden, label, amount | — |
| 5 | `viaje_tours` | prestador, ciudad, direccion, telefono, tipo_servicio, descripcion, reservado, reserva_nombre, confirmacion, fecha, hora, inclusiones, personas, dias, duracion, tarifa, cancelacion | tarifa×personas |
| 6 | `viaje_aeronaves` | prestador, ciudad, direccion, telefono, tipo_aeronave, capacidad, tipo_servicio, descripcion, reservado, reserva_nombre, confirmacion, origen, destino, fecha, hora, inclusiones, tarifa, extras_desc, monto_extras, cancelacion | tarifa + monto_extras |
| 7 | `viaje_acuaticos` | prestador, ciudad, direccion, telefono, tipo_embarcacion, capacidad, tipo_servicio traslado_tipo_servicio, tipo_servicio_otro, descripcion, reservado, reserva_nombre, confirmacion, tipo tipo_ruta, fecha, origen, destino, etd, eta, ret_fecha, ret_origen, ret_destino, ret_etd, ret_eta, inclusiones, tarifa, extras_desc, monto_extras, cancelacion | tarifa + monto_extras |
| 8 | `viaje_ferries` | igual que acuáticos + `servicio_para ferry_servicio_para` | tarifa + monto_extras |
| 9 | `viaje_terrestres` | prestador, ciudad, direccion, telefono, tipo_veh, tipo_servicio, tipo_servicio_otro, reservado, reserva_nombre, personas, confirmacion, tipo tipo_ruta, fecha, origen, destino, etd, eta, ret_* (retorno), inclusiones, tarifa (por persona), extras_desc, monto_extras, cancelacion | tarifa×personas + monto_extras |
| 10 | `viaje_actividades` | evento, ciudad, direccion, descripcion, duracion, fecha, inicio, fin, reservado, confirmacion, lugares, reserva_nombre, personas, tiene_tickets bool, inclusiones, tarifa, extras_desc, monto_extras | tarifa×personas + monto_extras |
| 10a | `viaje_actividad_tickets` (sub) | actividad_id FK, orden, nombre, ticket_num, lugar | — |
| 11 | `viaje_tiendas` (sin costo) | nombre, ciudad, direccion, telefono, apertura time, cierre time, detalle | — |
| 12 | `viaje_reuniones` (sin costo) | cita, asunto, fecha, hora, participantes, ciudad, direccion — **trigger que crea/actualiza fila en `viaje_dia_plan_rows`** | — |
| 13 | `viaje_rutas` (sin costo) | nombre, fecha, descripcion, link_gmaps | — |
| 14 | `viaje_pois` | titulo, ciudad | — |
| 14a | `viaje_poi_puntos` (sub) | poi_id FK, orden, nombre, descripcion | — |

**Total:** 15 tablas raíz + 5 sub-tablas = **20 tablas nuevas**.

### 1.5 Catálogos globales nuevos

```sql
create table public.aeropuertos_iata (   -- seed con los ~180 del HTML original
  code text primary key,
  city text not null,
  name text not null,
  country text not null
);

create table public.paises_catalogo (    -- seed con los ~75 del HTML original
  code text primary key,      -- ISO2
  name text not null,
  flag text,                  -- emoji
  lat numeric(9,6),
  lng numeric(9,6)
);
```

Ambos con RLS Pattern C (cualquier autenticado lee, admin/asistente escribe).

### 1.6 RLS

**Pattern A · Financial** en las 20 tablas del módulo T&T (viajes son parte de la operación de la asistente):

```sql
create policy X_read on public.X
  for select using (public.auth_rol() in ('admin','asistente'));
create policy X_write on public.X
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));
```

### 1.7 Triggers obligatorios en cada tabla

1. `set_updated_at` (helper de fase 1)
2. `audit_trigger` (helper de fase 3) — Regla 0
3. Trigger específico de `viaje_reuniones` que sincroniza `viaje_dia_plan_rows` (idempotente sobre `fuente_reunion_id`)
4. `viaje_hotels.noches` como `generated column` (checkout - checkin)

### 1.8 Al final de la migración

```sql
NOTIFY pgrst, 'reload schema';   -- invariante 2 · CLAUDE.md §4
```

---

## 2 · Frontend (React)

### 2.1 Estructura de carpetas

```
src/modules/tt/
├── shared/
│   ├── PaymentSelector.tsx           # dropdown "Pagado con" desde tarjetas_credito
│   ├── EstadoPagoBadge.tsx           # 5 colores según estado_pago
│   ├── ManualStatusSelect.tsx        # workflow del viaje
│   ├── OWRTToggle.tsx                # OW/RT switch
│   ├── AirportAutocomplete.tsx       # buscador contra aeropuertos_iata
│   ├── PrintableHeader.tsx           # header con logo Arriaza + gradient
│   ├── ttColors.ts                   # 14 colores por servicio (constantes)
│   ├── ttHelpers.ts                  # ttFmtDate, ttMoney, fórmulas de total
│   └── LazyLeaflet.tsx               # wrapper que carga Leaflet on-demand
├── viajes/
│   ├── api.ts
│   ├── hooks.ts
│   ├── TripForm.tsx
│   ├── TripCard.tsx                  # tarjeta expandible (servicios + itinerario)
│   ├── TripsSection.tsx              # dashboard con toolbar
│   ├── TripPreviewModal.tsx          # vista previa detallada
│   └── FinalizedFolder.tsx           # carpeta "Viajes Realizados"
├── itinerary/
│   ├── ItineraryBuilder.tsx          # arma días desde servicios (memoized)
│   ├── DayBlock.tsx                  # renderiza un día con sus eventos
│   ├── DayPlanForm.tsx
│   ├── DayNoteForm.tsx
│   └── ItineraryPrintable.tsx        # vista imprimible completa
├── calendar/
│   └── TripCalendar.tsx              # calendar view mes con pines
├── map/
│   └── TripMap.tsx                   # Leaflet con países marcados (lazy)
├── services/                         # UN subfolder por servicio
│   ├── tickets/
│   │   ├── api.ts, hooks.ts
│   │   ├── TicketForm.tsx
│   │   ├── PaxEditor.tsx             # ADD PAX
│   │   ├── PnrManager.tsx            # PNR múltiple
│   │   ├── RouteFields.tsx           # bloque de origen/destino/escala
│   │   └── TicketPrintable.tsx       # boarding-pass style
│   ├── hotels/ ...
│   ├── restaurantes/ ...
│   ├── rentas/ ...
│   ├── tours/ ...
│   ├── aeronaves/ ...
│   ├── acuaticos/ ...
│   ├── ferries/ ...
│   ├── terrestres/ ...
│   ├── actividades/ ...
│   ├── tiendas/ ...
│   ├── reuniones/ ...
│   ├── rutas/ ...
│   └── pois/ ...
└── TTPage.tsx                        # entry point (route /tt)
```

### 2.2 Componentes reutilizables clave

- **`PaymentSelector`** — reemplaza el `ttPaymentMethods()` que leía de `state.tcPresiCards`. Aquí lee de `tarjetas_credito` (catálogo ya existente de fase 11) filtrando `tipo = 'presidencia'`. Fallback: input libre.
- **`PrintableHeader`** — un `<header>` con logo Arriaza + gradient parametrizable por color del servicio (14 variantes). Reemplaza `ttLogoCorner()` + los headers en línea del HTML original.
- **`OWRTToggle`** — 2 botones con estilo del HTML original. Estado controlado.
- **`AirportAutocomplete`** — reemplaza `ttAirportSearch/ttPickAirport`. Query contra `aeropuertos_iata` con debounce.
- **`LazyLeaflet`** — `React.lazy(() => import('./map/TripMap'))` con Suspense fallback. Leaflet solo se descarga al abrir el mapa. Target: no engordar el bundle inicial más de 20 KB.
- **`ttColors`** — objeto con los 14 colores fijos + gradients + light/dark, portado tal cual del `TT_SVC_META` del HTML original.

### 2.3 Página raíz + routing

```tsx
// src/App.tsx (agregar)
const TTPage = lazy(() => import('@/modules/tt/TTPage'));

<Route path="/tt" element={<TTPage />} />
```

Menú principal: agregar link "🌍 Tour & Travel" entre "Finanzas" y "Admin".

### 2.4 Bundle budget

- Inicial: mantener **≤ 500 KB / 145 KB gzip** (Regla del bundle target en CLAUDE.md §2).
- Chunk `TTPage.js`: ≤ 200 KB gzip (lazy).
- Chunk `Leaflet.js`: ≤ 60 KB gzip (lazy dentro de TT).

Toda importación pesada (SheetJS, Leaflet, sub-componentes de servicios) debe ser lazy.

### 2.5 PDFs / imprimibles

Reuso del pattern `PrintableModal` + `window.print` (fase 11) — ya validado con Vale/Liquidación/Pago/Consumo. Los 14 servicios más el itinerario final = 15 componentes `XPrintable.tsx` con su gradient propio.

Logo Arriaza: los base64 del HTML original (`TT_LOGO_WHITE`, `TT_LOGO_COLOR`) se guardan **una sola vez** en `src/modules/tt/shared/logo.ts` como export const. No se re-embeben por servicio.

---

## 3 · Migración por sub-fases

Fase 19 se descompone en **6 sub-fases** para permitir revisar y aplicar migraciones intermedias.

### F19-0 · Fundación (~2 h)

**Migración `20260713000001_fase19_0_tt_fundacion.sql`:**
- 6 enums nuevos
- 3 catálogos globales: `aeropuertos_iata` (seed 180 filas), `paises_catalogo` (seed 75 filas)
- Tabla `viajes` + trigger de serial + `set_updated_at` + `audit_trigger`
- Tablas `viaje_dia_plans`, `viaje_dia_plan_rows`, `viaje_dia_notes`
- Todas con RLS Pattern A
- NOTIFY al final

**Frontend:**
- `src/modules/tt/TTPage.tsx` con placeholder
- `src/modules/tt/shared/*` (colors, helpers, logo, PaymentSelector, EstadoPagoBadge, ManualStatusSelect, PrintableHeader)
- `src/modules/tt/viajes/*` completo (api, hooks, TripForm, TripCard, TripsSection sin servicios, FinalizedFolder)
- Route `/tt` en el router
- Menú principal: link "Tour & Travel"

**Entregable:** puedes crear/editar/borrar viajes, verlos en dashboard, cambiar `manual_status`. Sin servicios ni itinerario todavía.

### F19-1 · Servicios simples (~3 h)

**Migración `20260713000002_fase19_1_tt_servicios_simples.sql`:**
- 5 tablas: `viaje_tiendas`, `viaje_reuniones`, `viaje_rutas`, `viaje_pois`, `viaje_poi_puntos`
- Trigger de `viaje_reuniones` → `viaje_dia_plan_rows`

**Frontend:**
- 4 módulos completos: `services/tiendas/*`, `services/reuniones/*`, `services/rutas/*`, `services/pois/*`
- Cada uno: api, hooks, XForm, XPrintable
- Botón "+ Agregar Servicios" en `TripCard` con dropdown de solo estos 4

### F19-2 · Servicios medios (~3 h)

**Migración `20260713000003_fase19_2_tt_servicios_medios.sql`:**
- 5 tablas + 2 sub-tablas: `viaje_restaurantes`, `viaje_hotels` + extras, `viaje_rentas` + extras, `viaje_tours`, `viaje_actividades` + tickets

**Frontend:**
- 5 módulos completos con extras (chip editor reusable)
- Ampliar el dropdown "+ Agregar Servicios"
- Fórmulas de total específicas

### F19-3 · Servicios OW/RT (~4 h)

**Migración `20260713000004_fase19_3_tt_servicios_owrt.sql`:**
- 4 tablas: `viaje_aeronaves`, `viaje_acuaticos`, `viaje_ferries`, `viaje_terrestres`

**Frontend:**
- 4 módulos con `OWRTToggle` + `RouteFields` (origen/destino/etd/eta) + retorno condicional
- Terrestre + Ferry: campo `servicio_para` (ferry) y `tipo_servicio_otro` (todos)

### F19-4 · Tickets aéreos (~4 h)

Este servicio es el más complejo — se le da su propia sub-fase.

**Migración `20260713000005_fase19_4_tt_tickets.sql`:**
- `viaje_tickets` + `viaje_ticket_pax`

**Frontend:**
- `services/tickets/`:
  - `PaxEditor.tsx` (ADD PAX con equipaje)
  - `PnrManager.tsx` (chips múltiples)
  - `RouteFields.tsx` (con IATA autocomplete)
  - `TicketForm.tsx` (compone todo)
  - `TicketPrintable.tsx` (boarding-pass style con logo)

### F19-5 · Itinerario + calendario + mapa (~3 h)

Sin migración nueva.

**Frontend:**
- `itinerary/`:
  - `ItineraryBuilder.tsx` (query de todos los servicios del viaje, memo por trip_id, arma `Day[]`)
  - `DayBlock.tsx` (renderiza un día con sus eventos + plan + nota)
  - `DayPlanForm.tsx`, `DayNoteForm.tsx`
  - `ItineraryPrintable.tsx` (vista completa imprimible)
- `calendar/TripCalendar.tsx` (mes, pines por viaje)
- `map/TripMap.tsx` (Leaflet lazy)
- Panel en línea colapsable en `TripCard` (equivalente al `ttRenderInlineItinerary` del HTML)

---

## 4 · Reutilización de infraestructura existente

Ya tenemos en NOCTUA todo esto, se reusa tal cual:

| Existe en NOCTUA | Uso en T&T |
|---|---|
| `PrintableModal` (fase 11) | 15 vistas imprimibles |
| `Modal` genérico | forms de servicios |
| `DataTable` | listados internos si aplican |
| `Toast` + `ConfirmDialog` | UX |
| `createCrudHooks` (fase 12+) | 20 tablas × 4 hooks cada una |
| `CsvImporter` (fase 17) | opcional para bulk import de viajes |
| Storage bucket `comprobantes` (fase 11) | archivos de confirmación |
| Trigger `audit_trigger` (fase 3) | attach a las 20 tablas |
| `PaymentSelector` (nuevo) | lee `tarjetas_credito.tipo='presidencia'` (fase 11) |
| RLS Pattern A (fase 12) | todas las 20 tablas |

---

## 5 · Estimaciones

| Sub-fase | SQL | Frontend | Total |
|---|---|---|---|
| F19-0 · Fundación | 45 min | 75 min | 2 h |
| F19-1 · Simples | 30 min | 150 min | 3 h |
| F19-2 · Medios | 30 min | 150 min | 3 h |
| F19-3 · OW/RT | 45 min | 195 min | 4 h |
| F19-4 · Tickets | 30 min | 210 min | 4 h |
| F19-5 · Itinerario+cal+map | 0 | 180 min | 3 h |
| **TOTAL** | **~3 h** | **~16 h** | **~19 h** |

**Aceptable dividir en 2 sesiones**: F19-0/1/2 en una sesión (~8 h), F19-3/4/5 en otra (~11 h).

---

## 6 · Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Bundle crece más de 500 KB | Lazy Leaflet + lazy TTPage + lazy sub-módulos por servicio (import dinámico dentro de TripCard cuando el usuario abre el form) |
| 20 tablas × trigger audit = mucho ruido en `audit_log` | Aceptable. Regla 0 no negociable. Si el volumen molesta, particionar `audit_log` por mes (fuera de alcance de F19). |
| El seed de 180 aeropuertos + 75 países pesa | Seed va en SQL, no en el bundle. Frontend consulta bajo demanda con paginación. |
| Componentes muy repetitivos (14 forms parecidos) | Generar helpers/HOCs para los bloques comunes: `ServiceBaseFields` (estatus/estado/pagado_con), `ServicePricingBlock` (tarifa+extras+total), `ContactBlock` (ciudad/direccion/telefono). |
| Traducción de fechas/formato del original | El HTML usa español latino sin tildes en algunos lugares. Normalizar todo con `formatDate()` de `@/lib/dates`. |
| Sincronización `viaje_reuniones → viaje_dia_plan_rows` | Trigger Postgres con `on conflict do update` + FK `fuente_reunion_id` para evitar duplicados. Idempotente. |
| Los 14 gradientes de los printables | Objeto `ttColors` centralizado — un solo cambio si el usuario pide re-brand |

---

## 7 · Criterios de éxito (medibles)

### Al cerrar F19-0
- [ ] `SELECT count(*) FROM aeropuertos_iata;` = 180
- [ ] `SELECT count(*) FROM paises_catalogo;` = 75
- [ ] Puedes crear viaje "Test 1" con serial `TT-2026-0001` y verlo en `/tt`
- [ ] `audit_log` tiene 1 row `op='INSERT'` para el viaje creado
- [ ] `manual_status` editable desde el dropdown de la card
- [ ] Al marcar "Finalizado", el viaje sale del dashboard y aparece en la carpeta

### Al cerrar F19-2
- [ ] Puedes agregar Hotel + Restaurante + Renta con extras al viaje
- [ ] Total del viaje calculado en la card == suma manual
- [ ] Vistas imprimibles de cada uno se ven consistentes con el HTML original (gradient + logo)

### Al cerrar F19-3 y F19-4
- [ ] Ticket con RT + PNR múltiple + 3 pax con equipaje se guarda y se imprime
- [ ] IATA autocomplete funciona con búsqueda por código/ciudad/país
- [ ] Los 4 servicios OW/RT tienen su bloque de retorno oculto/mostrado según toggle

### Al cerrar F19-5
- [ ] Itinerario final agrupa cronológicamente todos los servicios del viaje
- [ ] Reunión creada agrega automáticamente una fila en el DayPlan de esa fecha
- [ ] Calendario muestra los viajes del mes con pines de color
- [ ] Mapa carga solo cuando el usuario lo abre (verificar Network tab)
- [ ] `npx vite build`: bundle inicial ≤ 500 KB / 145 KB gzip

### Auditoría final
- [ ] Skill `check-rls` en las 20 tablas nuevas: 0 findings CRITICAL
- [ ] `npx tsc -b` exit 0
- [ ] `npx vite build` exit 0
- [ ] `docs/BITACORA.md` actualizado con entradas de Fase 19-0 a 19-5
- [ ] `docs/PROCESO-Y-DECISIONES.md` con al menos 2 ADRs nuevos (D-016 sobre el patrón de sub-módulos de servicios, D-017 sobre el trigger de sync reunión↔dayplan)

---

## 8 · Lo que NO se hace en F19 (fuera de alcance)

- **Migración de datos** desde el HTML original (nadie lo usa aún en NOCTUA, no hay data histórica que preservar)
- **Sincronización con calendarios externos** (Google Calendar, Outlook) — puede venir en F20
- **Notificaciones automáticas por email** — F20
- **API pública para clientes** — no aplica
- **Mobile app dedicada** — el diseño responsive del HTML sirve por ahora
- **Multi-tenant** (varios clientes de Arriaza) — F30+
- **Currency conversion** — todos los montos en USD como en el HTML original. Si se necesita GTQ, se agrega columna `moneda` a los servicios más adelante

---

## 9 · Aprobación

Antes de empezar F19-0, confirma:

1. **¿Los 14 servicios sí van todos?** (usuario confirmó ✅ el 2026-07-12)
2. **¿Nombre del módulo en el menú principal?** "Tour & Travel" o algo más corto (T&T)
3. **¿Personal JD como participantes?** Los `participants` del HTML son texto libre. ¿Enlazamos con `personas` (fase 15) o dejamos texto libre?
4. **¿Tarjetas Presi como "Pagado con"?** El HTML usa `state.tcPresiCards` — asumo que en NOCTUA usamos `tarjetas_credito` donde `tipo='presidencia'` (fase 11)
5. **¿Prioridad de las sub-fases?** Sugerido: en orden F19-0 → F19-5. ¿O algún servicio urgente antes?

Al confirmar, arranco con F19-0.

---

**Última actualización:** 2026-07-12 · Plan creado a partir del entregable `TT_modulo.html` + `README_INTEGRACION_TT_CEA.md`.

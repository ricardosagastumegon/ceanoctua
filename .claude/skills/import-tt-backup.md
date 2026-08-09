---
name: import-tt-backup
description: Convierte un JSON exportado del standalone TT_modulo.html en INSERTs SQL para las tablas att_* de CEA. Uso cuando el usuario tiene un backup del HTML y quiere migrarlo a CEA sin usar el importador UI (que hace solo metadatos del viaje).
---

# import-tt-backup

Este skill toma un JSON con la estructura `{ boardState2: { ttTrips: [...] } }`
(o `{ ttTrips: [...] }` sin envelope) del **standalone TT_modulo.html** y
genera un archivo `.sql` con INSERTs listos para pegar en Supabase Studio.

Cubre los **14 servicios** + hijos (habitaciones, tickets de actividad, subtickets)
+ dayPlans + dayNotes. Preserva los `tripNo` cuando existen. Genera UUIDs nuevos
para todos los IDs (no colisiona con existentes).

## Cuándo usarlo

- El usuario dice "carga mi backup", "importa el JSON del HTML", "migra viajes desde standalone"
- El BackupModal de la app solo importa metadatos del viaje — este skill hace el mapping completo.
- El usuario provee un archivo `.json` o pega el contenido directamente.

## Cómo usarlo

Cuando el usuario pida importar un backup:

1. **Pide el archivo o el JSON pegado**. Si te pasan un path, léelo con Read. Si pegan el JSON directo, guárdalo en el scratchpad primero.
2. **Valida la estructura** — debe tener `ttTrips` (o `boardState2.ttTrips`) como array de viajes.
3. **Genera** un `.sql` en `supabase/scripts/import-tt-<fecha>.sql` con los INSERTs.
4. **Presenta al usuario** el archivo generado + resumen (cuántos viajes, cuántos servicios totales).
5. **Instruye** al usuario a copiar/pegar el SQL en Supabase Studio SQL Editor y correr.
6. **Post-import**: sugiere refrescar la app con Ctrl+Shift+R.

## Mapping de campos HTML → CEA

### att_viajes (parent · uno por trip)

| HTML | CEA |
|---|---|
| `id` | (ignorar · CEA usa uuid) |
| `tripNo` | `trip_no` |
| `title` | `titulo` |
| `start` | `fecha_ini` |
| `end` | `fecha_fin` |
| `country` | `pais` |
| `dest` | `destino` |
| `participants` | `acompanantes` |
| `reason` | `proposito` |
| `manualStatus` | `manual_status` |
| (auto) | `estado`: 'planificado' |

### att_tickets (`trip.tickets[]`)

| HTML | CEA |
|---|---|
| `aerolinea` | `aerolinea` |
| `codigoReserva` / `numeroReserva` | `codigo_reserva` |
| `numeroTicket` | `numero_ticket` |
| `numeroVuelo` | `numero_vuelo` |
| `tipoVuelo` | `tipo_vuelo` (OW/RT si aplica) |
| `origen` | `origen` |
| `destino` | `destino` |
| `salida` | `fecha_salida` |
| `retorno` | `fecha_llegada` |
| `asiento` | `asiento` |
| `categoria` | `clase` |
| `totalTicket` (calculado) | `monto` |
| `notas` | `notas` |

Los ticket.pax[] van a `att_ticket_pax` (subtabla existente pre-F19).

### att_hoteles (`trip.hotels[]`)

| HTML | CEA |
|---|---|
| `nombre` | `nombre` |
| `direccion` | `direccion` (nueva) o `location` (legacy) |
| `ciudad` | `ciudad` |
| `checkin` | `checkin` |
| `checkout` | `checkout` |
| `noches` (calculado) | `nights` |
| `confirmacion` | `confirmacion` |
| `cancelacion` | `cancel_policy` |
| `comentarios` | `notas` |

**`hotel.rooms[]`** → **`att_hotel_habitaciones`** (una fila por room):
- `reservaNombre` → `reserva_nombre`
- `pax` → `pax`
- `tipoHab` → `tipo_hab`
- `desayuno` → `desayuno`
- `tarifa` → `tarifa`
- `noches` → `noches`

**`hotel.extras[]`** → **`att_hotel_services`** (subtabla existente pre-F19):
- `{ label, amount }` → `{ nombre, monto }`

### att_restaurantes (`trip.restaurantes[]`)

| HTML | CEA |
|---|---|
| `nombre` | `nombre` |
| `descripcion` | `descripcion` (nueva o `notas`) |
| `ciudad` | `ciudad` |
| `direccion` | `direccion` |
| `telefono` | `telefono` |
| `tipoServicio` | `tipo_servicio` |
| `reservaNombre` | `reserva_nombre` |
| `pax` | `pax` |
| `fecha` | `fecha` |
| `horario` | `horario` |
| `confirmacion` | `confirmacion` |
| `montoPax` | `monto_por_pax` |
| `cancelacion` | `cancelacion` |

### att_rentas (`trip.rentas[]`)

Todos los campos son 1:1 con snake_case en CEA:
`nombre, ciudad, direccion, telefono, tipoVeh→tipo_veh, descVeh→desc_veh, reservado, reservaNombre→reserva_nombre, confirmacion, recepcionFecha→recepcion_fecha, recepcionHora→recepcion_hora, recepcionDir→recepcion_dir, entregaFecha, entregaHora, entregaDir, dias, tarifa, deposito, cancelacion, estatusPago→estatus_pago, estadoPago→estado_pago, pagadoCon→pagado_con, confirmFile→confirm_file_name`.

**`renta.extras[]`** (array de `{label, amount}`) → JSONB directo en `extras`.

### att_tours (`trip.tours[]`)

Fields: `prestador, ciudad, direccion, telefono, tipoServicio, descripcion, reservado, reservaNombre, confirmacion, fecha, hora, inclusiones, personas, dias, duracion, tarifa, cancelacion, estatusPago, estadoPago, pagadoCon, confirmFile`.

### att_aeronaves (`trip.aeronaves[]`)

Fields: `prestador, ciudad, direccion, telefono, tipoAeronave→tipo_aeronave, capacidad, tipoServicio, descripcion, reservado, reservaNombre, confirmacion, origen, destino, fecha, hora, inclusiones, tarifa, extras, montoExtras→monto_extras, cancelacion, estatusPago, estadoPago, pagadoCon, confirmFile`.

### att_acuaticos / att_ferries / att_terrestres (OW/RT)

Common OW/RT fields (`tipo, fecha, origen, destino, etd, eta, retFecha→ret_fecha, retOrigen→ret_origen, retDestino→ret_destino, retEtd→ret_etd, retEta→ret_eta`).

Extras por servicio:
- **acuaticos**: `tipoEmbarcacion→tipo_embarcacion, capacidad, tipoServicio, tipoServicioOtro→tipo_servicio_otro, descripcion, inclusiones, tarifa, extras, montoExtras, cancelacion`.
- **ferries**: idem acuaticos + `servicioPara→servicio_para (Personas/Vehículos)`.
- **terrestres**: `tipoVeh→tipo_veh, tipoServicio, tipoServicioOtro, reservaNombre, personas, inclusiones, tarifa, extras, montoExtras, cancelacion`.

Todos: `prestador, ciudad, direccion, telefono, reservado, confirmacion, estatusPago, estadoPago, pagadoCon, confirmFile`.

### att_tiendas (`trip.tiendas[]`)

Fields: `nombre, ciudad, direccion, telefono, apertura, cierre, detalle`. Sin costo.

### att_actividades (`trip.actividades[]`)

Padre: `evento, ciudad, direccion, descripcion, duracion, fecha, inicio, fin, reservado, cancelacion, comentarios, estatusPago, estadoPago, pagadoCon, confirmFile`.

**`actividad.ticketsActividad[]`** → **`att_actividad_tickets`**:
- `nombres, personas, confirmacion, lugares, tarifa, extras, montoExtras→monto_extras, tieneSubtickets→tiene_subtickets`.

**`ticketActividad.subtickets[]`** → **`att_actividad_subtickets`**:
- `nombre, ticket, lugar`.

### att_reuniones (`trip.reuniones[]`)

Fields: `cita, asunto, fecha, hora, participantes, ciudad, direccion, confirmFile`.

**Nota:** al insertar reuniones, este skill NO auto-crea filas en `att_day_plan_rows`.
Cuando el usuario abra el viaje en CEA, puede editar cada reunión (guardar sin cambios)
para disparar el `syncReunionToDayPlan` del hook y generar la fila del itinerario.
Alternativamente, el skill puede generar los INSERTs de `att_day_plan_rows` directamente
si se detecta que el standalone tiene `dayPlans[]` con filas `_reunionAuto=true`.

### att_rutas (`trip.rutas[]`)

Fields: `nombre, fecha, descripcion, link`.

### att_pois (`trip.pois[]`)

Fields: `titulo, ciudad, puntos` (JSONB array de `{nombre, descripcion}`).

### att_day_plans + att_day_plan_rows (`trip.dayPlans[]`)

- `dayPlan.dia, dayPlan.fecha, dayPlan.lugar` → `att_day_plans`.
- `dayPlan.rows[]` (`{horario, itinerario, _reunionAuto, _reunionId}`) → `att_day_plan_rows`.
  - `_reunionAuto=true` → `es_auto_reunion=true`.
  - `_reunionId` requiere resolver el UUID nuevo del att_reuniones correspondiente
    (tracking id-HTML → id-CEA durante la generación).

### att_day_notes (`trip.dayNotes[]`)

Fields: `fecha, texto` (viaje_id inferido del padre).

## Formato del SQL generado

```sql
BEGIN;

-- Trip 1: TT-2026-0001
with viaje_ins as (
  insert into public.att_viajes (
    trip_no, titulo, fecha_ini, fecha_fin, pais, destino,
    acompanantes, proposito, manual_status, estado
  ) values (
    'TT-2026-0001', 'Miami Junta Directiva', '2026-01-15', '2026-01-20',
    'Estados Unidos', 'Miami', 'AL, JA', 'Reunión anual', 'En planeación', 'planificado'
  )
  returning id
)
insert into public.att_hoteles (viaje_id, nombre, ciudad, checkin, checkout, nights)
select id, 'Ritz Carlton', 'Miami', '2026-01-15', '2026-01-19', 4 from viaje_ins;
-- (más INSERTs con SELECT id from viaje_ins per trip)

-- Trip 2: TT-2026-0002 …

COMMIT;
NOTIFY pgrst, 'reload schema';
```

## Reglas importantes

1. **Idempotencia**: usar `on conflict (trip_no) do nothing` para skipear viajes ya importados.
2. **Preservar tripNo**: si el HTML tiene tripNo válido, incluirlo en el INSERT. Si no, dejar `null` y el trigger auto-genera uno nuevo.
3. **Escape SQL**: strings con `'` deben ser `''` (dobles). Usa `format('%L', valor)` en dynamic SQL.
4. **Verificar imports**: después de generar el SQL, escribir un query de verificación:
   ```sql
   select count(*) from public.att_viajes where trip_no in ('TT-2026-0001', ...);
   ```
5. **Nunca DELETE**: solo INSERTs. Si el usuario quiere reemplazar, primero soft-delete manual.
6. **NOTIFY pgrst al final**: obligatorio (invariante 2 · CLAUDE.md §4).

## Salida esperada

Al terminar la generación, presenta al usuario:

```
✅ Script generado: supabase/scripts/import-tt-2026-08-09.sql

📊 Resumen:
  - 12 viajes procesados
  - 45 tickets, 20 hoteles (con 32 habitaciones), 18 restaurantes
  - 15 tours, 5 aeronaves, 8 rentas
  - 3 acuáticos, 2 ferries, 12 terrestres
  - 6 tiendas, 24 actividades (con 40 tickets, 15 subtickets)
  - 8 reuniones, 3 rutas, 4 POIs
  - 15 dayPlans (con 62 filas), 8 dayNotes

📋 Aplicar:
  1. Abrí Supabase Studio SQL Editor
  2. Copiá el contenido de import-tt-2026-08-09.sql
  3. Run → "Run without RLS" (falso positivo del linter)
  4. Verificá con: select count(*) from att_viajes where trip_no like 'TT-%'
  5. Ctrl+Shift+R en la app para refrescar cache

⚠️ Si algún viaje falla, el resto se completa. Ver output para diagnosticar.
```

## Limitaciones conocidas

- **Archivos adjuntos**: `confirmFile` en el HTML es solo el nombre del archivo,
  no el binario. El skill preserva el nombre pero no puede recuperar el file
  original.
- **Legacy IDs**: no se preservan (colisiones con existentes son un riesgo).
  Este skill genera todo nuevo. Si necesitas trazabilidad con el HTML, usa
  el nuevo `trip_no` como puente.
- **Timezone**: fechas/horas se importan literalmente sin conversión. Si el HTML
  usaba una TZ distinta, ajustar manualmente antes de aplicar.

# PLAN · T&T Servicios 9–10 · Traslado Terrestre y Actividades

Documento fuente: `SECCION DE EVENTOS Y TRASLADO TERRESTRE.docx` (2026-09-23).

## Objetivo

Reconstruir los dos servicios en la misma línea de los ocho anteriores:
formulario según el documento, PDF con logo y color propio, entrada al
itinerario y aporte al total del viaje.

Ambas tablas existen del port de la Fase 19 y **están vacías** (0 filas).

## Traslado Terrestre

Ya tiene casi todo, incluidas las columnas de ruta OW/RT y `personas`.

| Columna | Por qué |
|---|---|
| `ruta text` | El documento pide, solo en el modo OW, un campo libre "Ruta:" además de origen y destino. En RT los rótulos "Ruta: Salida" y "Ruta: Retorno" son encabezados, no campos. |
| `monto`, `moneda`, `confirmacion_path` | Lo mismo que los cuatro servicios anteriores. |

Se reemplaza el `att_terrestres_estado_pago_check` viejo por la lista
unificada de 6 valores, eliminando el viejo en la misma migración.

**Total:** tarifa por persona × cantidad de personas **+ monto de extras**.
Distinto de acuático y ferry, que no multiplican por personas.

**Color:** terracota, pedido explícitamente en el documento. Hoy
`SERVICE_META.terrestre` es un gris azulado; se cambia.

## Actividades

Aquí sí hay una decisión de modelo.

La tabla `att_actividades` sólo guarda el evento, sus fechas y el pago. Le
faltan los dos bloques que pide el documento:

| Columna | Bloque del documento |
|---|---|
| `participantes text` | Participantes, como chips igual que en el viaje |
| `confirmacion text` | No. de Confirmación |
| `reserva_nombre`, `lugares`, `personas` | Información de participante |
| `tiene_tickets boolean` | "No. de Ticket: casilla para selección si es que aplica" |
| `inclusiones`, `tarifa`, `extras`, `monto_extras` | Información de precio |
| `monto`, `moneda`, `confirmacion_path` | Como el resto de servicios |

**Total:** tarifa por persona × cantidad de personas + monto de extras.

### La lista de tickets

El documento pide que, al marcar la casilla, se abra una lista repetible de
`{Nombre, No. de Ticket, Lugar}`.

Existen ya dos tablas del port viejo, **ambas vacías**, que no encajan:

- `att_actividad_tickets` — un bloque repetible de participantes **con su
  propia tarifa y extras**. El documento pone el precio a nivel del evento,
  una sola vez, no por bloque.
- `att_actividad_subtickets` — `{nombre, ticket, lugar}`, que sí es lo que
  pide el documento, pero cuelga de `att_actividad_tickets` y no del evento.

Se crea **`att_actividad_entradas`** colgando directo de `att_actividades`,
con RLS Pattern A, triggers de auditoría y soft delete, y se marcan las dos
viejas como deprecadas con un comentario. No se borran en esta migración: se
agenda su eliminación en `docs/PENDIENTES.md`, igual que se hizo con
`att_pins` (DT-3).

## Migración

- `20260923000006_fase22_terrestre.sql`
- `20260923000007_fase22_actividades.sql`

Idempotentes y terminando en `NOTIFY pgrst, 'reload schema';`.

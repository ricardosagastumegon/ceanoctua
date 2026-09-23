# PLAN · T&T Servicios 5–8 · Tours, Aeronave, Acuático y Ferry

Documento fuente: `SECCIÓN DE TOURS, RENTA DE AERONAVES, SERVICIOS ACUÁTICOS Y FERRY.docx`
(2026-09-23, con cuatro mockups de formulario).

## Objetivo

Reconstruir los cuatro servicios siguiendo la misma línea de Ticket Aéreo, Hotel,
Restaurante y Renta: formulario según el documento, PDF con logo y color propio,
entrada al itinerario general y aporte al total del viaje.

Las cuatro tablas ya existen del port de la Fase 19 y **están vacías** (0 filas),
así que no hay riesgo de datos al cambiar restricciones.

## Modelo · qué falta en cada tabla

Las cuatro comparten tres huecos:

| Columna | Por qué |
|---|---|
| `monto numeric(14,2)` | Sin ella el servicio aporta cero al total del viaje y no sale en "Costo por servicio". |
| `moneda currency` | El resto de servicios ya la tiene; el total del viaje advierte si se mezclan. |
| `confirmacion_path text` | El documento pide "Cargar confirmación". Hoy solo existe `confirm_file_name`, que guarda el nombre sin el archivo. |

Y las cuatro arrastran el `*_estado_pago_check` viejo con la lista de 5 valores
(`Reservado / Pagado / Pago parcial / A pagar en propiedad / Cancelado`). Se
reemplaza por la lista unificada de 6 que ya usan los otros servicios:
`HOLD / PAGO PARCIAL / CONFIRMADO / CANCELADO / ABIERTO / A PAGAR EN PROPIEDAD`.

**La restricción vieja se busca por nombre exacto y se elimina en la misma
migración que crea la nueva.** Fue lo que rompió la renta el 22 de septiembre:
quedaron las dos activas y ninguna fila podía cumplir ambas.

### Tours · además

| Columna | Por qué |
|---|---|
| `hora_fin time` | El documento pide "Inicio: hora — fin: hora". Hoy solo existe `hora`, que pasa a ser la de inicio. |
| `incluye_alimentacion boolean` | "Incluye alimentación: SI/NO". |
| `alimentacion_detalle text` | "Si es SI: despliega casilla para escribir". |

El mockup del formulario no trae estos tres campos; el documento lo advierte
explícitamente ("Este formulario no tiene un par de cosas que sí te pido
arriba"), así que manda el texto.

Aeronave, Acuático y Ferry ya tienen todas sus columnas de negocio, incluidas
las de ruta OW/RT (`tipo`, `fecha`, `origen`, `destino`, `etd`, `eta` y sus
gemelas `ret_*`).

## Totales

| Servicio | Fórmula |
|---|---|
| Tours | tarifa por persona × cantidad de personas |
| Aeronave | tarifa de servicio + monto de extras |
| Acuático | tarifa de servicio + monto de extras |
| Ferry | tarifa de servicio + monto de extras |

Se guardan en `monto` al grabar, igual que la renta, para que el viaje sume sin
recalcular la fórmula de cada servicio.

## UI

Un color por servicio, ya definidos en `SERVICE_META` y coincidentes con los
mockups:

| Servicio | Color | Ícono |
|---|---|---|
| Tour | verde `#2a6e24` | 🗺️ |
| Renta de Aeronave | teal profundo `#0b5c6e` | 🛩️ |
| Traslado Acuático | aqua `#0e7490` | 🚤 |
| Servicio Ferry | azul-morado `#3b4d8a` | ⛴️ |

Por servicio: `full-api.ts` (total + subida de confirmación), `XFormModal.tsx`,
`XPrintable.tsx` sobre `ServicePrintable`, y `XSection.tsx` con los cuatro
botones que pide el documento — vista previa, editar, eliminar y cargar
confirmación.

Acuático y Ferry reutilizan `shared/OwRtFields.tsx`, que ya resuelve el selector
OW/RT y los campos de retorno.

## Itinerario

`viajes/itinerary-events.ts` ya recoge los cuatro. Al agregar `hora_fin` en
tours y con las rutas OW/RT de acuático y ferry, cada uno aporta sus fechas:
tours un evento, acuático y ferry uno por trayecto cuando son RT.

## Migración

Una por servicio, en el orden del documento:

- `20260923000002_fase22_tours.sql`
- `20260923000003_fase22_aeronave.sql`
- `20260923000004_fase22_acuatico.sql`
- `20260923000005_fase22_ferry.sql`

Todas idempotentes (`if not exists` / `if exists`) y terminando en
`NOTIFY pgrst, 'reload schema';`.

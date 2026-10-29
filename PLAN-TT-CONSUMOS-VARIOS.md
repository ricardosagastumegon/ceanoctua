# Plan · Consumos Varios del viaje (T&T)

## Objetivo

Al cerrar un viaje le entregan a la asistente un reporte de los gastos menudos que
se pagaron con tarjeta durante el camino: propinas, taxis, un café, una farmacia.
Son decenas de renglones chiquitos y **no se capturan uno por uno** — se registran
como **un total bajo un concepto**, por ejemplo *"CONSUMOS VARIOS Sra. Arriaza"*,
con su monto y su tarjeta, para después solicitar el reintegro.

Pedido del usuario el 2026-10-29: *"necesito registrar esos gastos peeeero NO uno
por uno, si no como un total y bajo un concepto (…) y espacio para agregar monto y
selección de TC, para luego solicitar el reintegro"*.

Es **opcional por construcción**: solo existe en los viajes donde entregaron ese
reporte, y el viaje que no lo tenga ni muestra la sección.

## Modelo

### Por qué una tabla nueva y no `att_cargos`

`att_cargos` ya tiene la idea correcta —un cobro con su descripción, su monto, su
tarjeta y su fecha— pero está amarrado a un servicio: su CHECK solo acepta los once
tipos y `servicio_id` es `not null`. Un consumo varios no pertenece a ningún
servicio, pertenece al viaje. Meterlo ahí obligaría a guardar el id del viaje en una
columna llamada `servicio_id`, que es una trampa para el próximo que lea la tabla.
Y el editor de cargos vive dentro del modal de cada servicio, así que de todos modos
habría que construirle una entrada propia: el ahorro era aparente.

### La tabla

```sql
create table if not exists public.att_consumos_varios (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,

  -- Texto libre a proposito. No es catalogo: cambia con quien viaja y con lo
  -- que reportan. "CONSUMOS VARIOS Sra. Arriaza".
  concepto text not null,

  monto numeric(14,2) not null default 0,
  moneda public.currency not null default 'USD',

  -- La tarjeta y el texto del dia que se capturo, igual que en att_cargos:
  -- renombrar una tarjeta en Admin no puede reescribir un reporte de hace meses.
  pagado_con text,
  pagado_con_id uuid references public.tarjetas_credito(id),

  fecha date,
  fecha_cargo date,

  estado_pago text not null default 'CONFIRMADO',
  cancelado_en date,
  reintegro numeric(14,2) not null default 0,
  reintegro_nota text,

  -- El detalle del reporte, si se quiere que salga en el papel. No afecta la
  -- suma: el monto es el monto.
  notas text,

  -- El reporte escaneado, en el bucket `tt-documentos` que ya usan los once
  -- servicios.
  reporte_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
```

Las ocho columnas que la liquidación pide en `COMUNES` —`monto`, `reintegro`,
`moneda`, `estado_pago`, `cancelado_en`, `pagado_con`, `pagado_con_id`,
`fecha_cargo`— están todas. Por eso una sola entrada en `MAPEO` basta para que el
registro aparezca en los reportes sin tocarlos.

CHECKs: `monto >= 0`, `reintegro >= 0 and reintegro <= monto` (el mismo que
`att_cargos`), y `estado_pago` con la lista moderna del módulo —`HOLD`,
`PAGO PARCIAL`, `CONFIRMADO`, `CANCELADO`, `ABIERTO`, `A PAGAR EN PROPIEDAD`—
porque es la que entienden `cancelarServicio()` y `reactivarServicio()`. El
default es `CONFIRMADO`: este dinero ya se gastó, por definición.

### Cuidado con `reintegro`

En este sistema `reintegro` significa *dinero que volvió* —un cargo reversado, un
servicio cancelado con devolución— y resta del neto: `neto = monto − reintegro`. No
es la **solicitud de reintegro** a la empresa, que es lo que la asistente llama así.
Si se usara para eso, la tarjeta aparecería en cero en la liquidación justo cuando
hay que cobrarla. Por eso la columna existe por paridad con los demás servicios pero
la sección no la expone, y la solicitud vive en Finanzas.

### Las dos fechas

`fecha` es el día del reporte —o el corte del viaje— y `fecha_cargo` es cuándo pegó
en el estado de cuenta. La liquidación por período usa `fecha_cargo ?? fecha`, la
misma regla que los demás servicios. Capturar una sola alcanza; capturar ninguna
manda el renglón al bloque *Sin fecha*, que es justo para eso.

### Varios renglones por viaje

Uno por persona o por tarjeta: *CONSUMOS VARIOS Sra. Arriaza* en una Amex y otro
renglón en otra tarjeta. Cada uno con un solo monto. Un reporte que mezcla dos
tarjetas se parte en dos renglones, porque así es como va a aparecer en el estado de
cuenta — y cuadrar tarjetas es a lo que va la liquidación.

### RLS y auditoría

Igual que el resto de T&T: lectura con `public.puede('tt','observador')`, escritura
con `public.puede('tt','editor')`, triggers `set_updated_at` y `audit_trigger`,
soft delete por `deleted_at`.

## UI

### La sección

Módulo nuevo en `src/modules/arriaza/consumos-varios/` con el layout del repo:
`api.ts`, `hooks.ts`, `ConsumoVariosFormModal.tsx`, `ConsumoVariosPrintable.tsx`,
`ConsumosVariosSection.tsx`.

Entra como una clave más de servicio, `varios`, en `SERVICE_META` — 🧾, vino
`#8c2f39`, distinto del rust del restaurante y del magenta de actividades. Con eso
aparece en **"+ Agregar Servicios"**, la sección se monta sola en los viajes que ya
tengan uno, y el encabezado del viaje suma su monto al total.

### El formulario

Concepto, monto y moneda, tarjeta con el `PaymentMethodSelect` que ya existe, fecha
del reporte, fecha de cargo, notas, y el botón de adjuntar — el mismo
`ConfirmacionBoton` de los demás servicios, guardando en
`tt-documentos/consumos-varios/<id>/`.

### La hoja imprimible

`ServicePrintable` con el concepto, el monto, la tarjeta, las fechas y el detalle de
las notas. Es el papel que se adjunta a la solicitud de reintegro.

### Dónde NO aparece

En el **Itinerario General** no entra: no es un evento, no tiene hora, y el
itinerario es el documento que se comparte. Sí entra en la liquidación del viaje, en
la liquidación por período y en el resumen del viaje, porque las tres leen `MAPEO`.

## Migración y puntos de código

1. `supabase/migrations/2026…_tt_consumos_varios.sql` — tabla, índice por viaje,
   CHECKs, triggers, RLS y `NOTIFY pgrst, 'reload schema';`.
2. `src/types/database.ts` — Row / Insert / Update de la tabla.
3. `constants/serviceMeta.ts` — `varios` en `ServiceKey`, `SERVICE_META` y
   `SERVICE_KEYS`; se queda en `SERVICE_KEYS_MENU`.
4. `shared/cancelacion.ts` — `att_consumos_varios` en `TablaServicio`.
5. `viajes/liquidacion.ts` — una entrada en `MAPEO`. Eso solo lo mete en los tres
   reportes.
6. `viajes/service-counts.ts` — `TABLA_POR_SERVICIO` y `CON_MONTO`.
7. `TripServicesPanel.tsx` — `READY_SERVICES` y el render de la sección.
8. El módulo nuevo: cinco archivos.

## Fuera de alcance · fase siguiente

- **El puente a Finanzas.** Un botón *"Enviar a Consumos TC"* que cree la fila en
  `tc_consumos` con `origen = 'T&T'` y el id del registro, para que el gasto no se
  cuente dos veces entre la liquidación del viaje y el reporte de Finanzas. Decisión
  del usuario el 2026-10-29: primero que el registro y la liquidación queden bien.
- **CHF.** El enum `currency` es `USD / GTQ / EUR / GBP`. Un consumo en francos
  suizos no cabe hoy en ninguna tabla del sistema, no solo en esta. Cuando aparezca
  se agrega al enum en su propia migración.

# PLAN · Liquidación de viajes y consumo por tarjeta

Pedido del usuario, 2026-09-23:

> Necesito que cada viaje pueda tener una Liquidación del viaje para reporte
> financiero (…) importante que esta liquidación debe de tener una casilla en
> la cual cada servicio tenga la info de con qué se ha pagado ya que al final
> se reporta cuánto se consumió cada TC.

Y sobre los servicios cancelados:

> Cada servicio debería de tener un botón que al cancelar pregunte si se tiene
> un reintegro total, o parcial, y espacio para ingresar el reintegro, para que
> este pueda restar o no al total pagado del servicio, y este a su vez
> modificar el total del viaje y por ende de la liquidación.

---

## Lo que ya está resuelto

- Los **10 servicios con costo** guardan `monto` y `moneda`.
- Desde el commit `5371982` guardan también **`pagado_con_id`**, la llave de la
  tarjeta en `tarjetas_credito`. Antes solo había un texto, y sumar por tarjeta
  no era confiable.
- Reuniones no entra: no tiene costo.

---

## 1 · Cancelación con reintegro

### El modelo

Tres columnas nuevas en cada servicio con costo:

| Columna | Para qué |
|---|---|
| `cancelado_en date` | Cuándo se canceló. Distinto de la fecha del servicio. |
| `reintegro numeric(14,2)` | Cuánto volvió. `null` o `0` = no hubo. |
| `reintegro_nota text` | Por qué fue parcial, número de nota de crédito, etc. |

**`monto` no se toca.** Es lo que se le cargó a la tarjeta y así tiene que
quedar registrado. Lo que cambia es el **neto**:

```
neto = monto − coalesce(reintegro, 0)
```

Ese neto es el que suma al total del viaje y a la liquidación.

Guardar las dos cifras y no solo la resta importa para conciliar con el estado
de cuenta: la tarjeta va a mostrar un cargo y, por separado, un abono.

### El flujo

Un botón **✕ Cancelar** en cada renglón de servicio, junto a editar y borrar.
Abre una ventana que pregunta:

1. **¿Hubo reintegro?** — Total · Parcial · Ninguno
2. Si es **Total**, el monto se propone completo y no hace falta escribirlo.
3. Si es **Parcial**, se escribe cuánto volvió.
4. Nota opcional.

Al confirmar: `estado_pago = 'CANCELADO'`, `cancelado_en = hoy`, y el
reintegro. El servicio **sigue apareciendo** en el viaje y en la liquidación,
marcado como cancelado y con su neto.

Cancelar no es borrar: un servicio cancelado con reintegro parcial costó
dinero, y ese dinero tiene que aparecer en el reporte.

---

## 2 · Liquidación por viaje

Un botón **Liquidación** en la pantalla del viaje, junto a Itinerario y
Compartir. Abre una hoja imprimible con:

1. **Encabezado** — viaje, correlativo, fechas, participantes.
2. **Un renglón por servicio**, sin detalle: tipo, nombre corto, fecha, cargo,
   reintegro, neto, estado de pago y con qué se pagó. No van pasajeros, ni
   habitaciones, ni números de ticket.
3. **Resumen por tarjeta** — cargos, reintegros y neto de cada TC en ese viaje.
   Esta es la parte que el usuario necesita para reportar consumo.
4. **Total del viaje**, con aviso si hay monedas mezcladas.

---

## 3 · Liquidación por período

La misma idea pero cruzando todos los viajes: *"cuánto consumió la Amex GT
entre enero y marzo"*.

- Filtros: rango de fechas y, opcionalmente, una tarjeta.
- Agrupa por tarjeta, y dentro de cada una por viaje.
- Mismas tres columnas: cargos, reintegros, neto.

### Qué fecha manda · resuelto el 2026-09-23

La **liquidación del viaje no filtra por fechas**: lleva todos los servicios
del viaje, se hayan comprado cuando se hayan comprado. Palabras del usuario:

> la liquidación es específica de un viaje creado, no de una fecha de inicio
> (…) quiero tener una liquidación de todos los servicios ingresados en el
> viaje, sin importar cuándo se hayan comprado.

Lo que sí se agregó es **`fecha_cargo`** en cada servicio: la fecha en que se
cobró la tarjeta, que puede ser meses antes del viaje. Es opcional y sirve
para el control de las TC contra el estado de cuenta. Cuando el reporte por
período se construya, usará esa fecha y caerá a la del servicio si está
vacía.

---

## Migraciones

- `20260923000012_cancelacion_reintegro.sql` — las tres columnas en los diez
  servicios.
- `20260923000013_fecha_cargo.sql` — solo si se escoge la opción B.

Las vistas de la liquidación se arman en el cliente sobre los servicios; no
hace falta tabla nueva.

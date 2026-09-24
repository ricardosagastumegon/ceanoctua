# Plan · Liquidación por período (DT-11)

## Objetivo

Hoy la liquidación es **por viaje**. Para pagar las tarjetas no sirve: el estado de
cuenta de una tarjeta no viene separado por viaje, viene por mes. Hace falta el
reporte al revés — **un rango de fechas, todos los viajes, agrupado por tarjeta**.

Pedido del usuario el 2026-09-23: *"me parece fantástico por período porque puedo
sacar información por TC para pagos"*.

## Modelo

**No hay migración.** Las dos columnas que esto necesita ya existen en las 10 tablas
de servicio desde la migración `20260923000011` y `...012`:

- `pagado_con_id` → a qué tarjeta se cargó
- `fecha_cargo` → cuándo se cobró

### La fecha que manda

Un servicio ocurre un día y se cobra otro. Un hotel de diciembre se puede haber
pagado en octubre, y es en el estado de cuenta de octubre donde aparece. Entonces:

```
fecha efectiva = fecha_cargo  ?? fecha propia del servicio
```

Se usa `fecha_cargo` cuando está capturada, y se cae a la fecha del servicio cuando
no. Es la regla que ya dejó anotada `docs/PENDIENTES.md` en DT-11.

### Lo que NO puede pasar

Un servicio con monto pero **sin ninguna de las dos fechas** no cabe en ningún
período. Si simplemente se filtrara, desaparecería de todos los reportes y el
usuario pagaría de menos sin enterarse. Por eso el reporte lleva un bloque aparte
—**Sin fecha**— que los lista siempre, fuera del rango. Es el único caso en que la
hoja muestra algo que no pertenece al período: prefiero que sobre a que falte.

### Qué entra

Solo renglones con dinero (`cargo > 0` o `reintegro > 0`). A diferencia de la
liquidación por viaje, que lista todo el viaje, este reporte es de consumo: un
servicio en 0 es ruido entre lo que hay que pagar.

Los cancelados sí entran, con su cargo y su reintegro, porque el cargo y el abono
aparecen por separado en el estado de cuenta.

### Consulta

Se traen las 10 tablas completas y se filtra en el cliente, en vez de armar el
filtro en PostgREST. La condición real es sobre `coalesce(fecha_cargo, fecha)`, que
en PostgREST obliga a un `or(and(...),and(...))` distinto por tabla — diez cadenas
a mano, cada una una oportunidad de equivocarse en silencio en un reporte de
dinero. Con 3 viajes y 6 servicios con monto hoy, y un puñado de viajes al año, no
hay razón para pagar ese riesgo. Si algún día crece, esto se convierte en una
función RPC y el cambio queda encerrado en un solo archivo.

## UI

Pantalla nueva: **Liquidación por período**, desde el botón en la barra de T&T,
junto a Respaldo.

Mismo lenguaje visual que la liquidación por viaje — azul marino y gris, logo,
sin íconos — porque es el mismo tipo de documento y se archiva igual.

```
┌─ controles (no se imprimen) ─────────────────────┐
│  Desde [ ]  Hasta [ ]   Mes actual · Mes pasado · Año │
└──────────────────────────────────────────────────┘
┌─ hoja ───────────────────────────────────────────┐
│  LIQUIDACIÓN POR PERÍODO            [logo]       │
│  1 sep 2026 — 30 sep 2026                        │
│                                                  │
│  RESUMEN POR TARJETA                             │
│   Amex GT Term. 864   4 serv.  1,240.00          │
│   Visa Term. 1122     2 serv.    310.00          │
│                                                  │
│  AMEX GT TERM. 864 ─────────────── neto 1,240.00 │
│   fecha · viaje · servicio · detalle · cargo ·   │
│   reintegro · neto                               │
│  VISA TERM. 1122 ──────────────────  neto 310.00 │
│   …                                              │
│                                                  │
│  SIN FECHA (fuera del período, revisar)          │
│   …                                              │
│                                                  │
│  TOTAL DEL PERÍODO                     1,550.00  │
└──────────────────────────────────────────────────┘
```

El resumen va arriba porque es lo que se mira primero: cuánto se le debe a cada
tarjeta. El detalle por tarjeta va abajo, para cuadrar contra el estado de cuenta
renglón por renglón.

Cada renglón dice **de qué viaje viene**, que es lo que distingue este reporte del
de un viaje suelto.

## Migración

Ninguna.

## Archivos

| Archivo | Qué |
|---|---|
| `viajes/liquidacion.ts` | Exportar `MAPEO`, `COMUNES` y los helpers, para no tener el mapeo de los 10 servicios en dos lugares |
| `viajes/liquidacion-periodo.ts` | **nuevo** · `useLiquidacionPeriodo(desde, hasta)` |
| `LiquidacionPeriodoModal.tsx` | **nuevo** · la hoja |
| `AttPage.tsx` | El botón |

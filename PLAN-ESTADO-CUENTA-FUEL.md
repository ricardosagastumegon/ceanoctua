# PLAN · Estado de cuenta del proveedor de combustible

## Objetivo

Saber **cuánto queda del depósito** con Aeroclub de Guatemala Gasolinera, sin
tener que abrir el Excel que manda el proveedor.

La cuenta es **exclusiva de TG-OBI** (confirmado con el usuario, 2026-09-29).
No se comparte con vehículos ni con otras aeronaves, así que el saldo que
calcule CEA **sí puede cuadrar** con el del proveedor. Eso es lo que hace
viable todo lo demás.

No es un pago por consumo: hay un **depósito** de Q25,856.20 del que se
consume y que se va **reponiendo**. El down payment ya se hizo al inicio.

> Dato observado: el estado de cuenta cierra con Q24,736.20 disponibles y el
> depósito es Q25,856.20. La diferencia, **Q1,120.00, es exactamente la última
> factura** (FER2048075 del 22/04/26) — todavía sin reponer. Confirma que
> Q25,856.20 es el **nivel objetivo** del depósito.

## Cómo funciona la cuenta

Del análisis del estado de cuenta (299 movimientos, 2 may 2024 → 22 abr 2026):

| En el Excel | Qué es | Efecto |
|---|---|---|
| **Cargos** `FER…` | Una factura de fuel | Consume el depósito |
| **Abonos** `AP…` `AG…` | Una reposición | Recarga el depósito |
| **S.Final** negativo | Saldo **a favor** | Lo disponible |

La fórmula `S.Anterior + Cargos − Abonos = S.Final` se cumple en las 299 filas
sin un solo salto. Totales: 216 cargos por Q261,756.90 (cuadra con el
`* total cliente *` de la hoja) y 76 abonos por Q283,029.80.

**En CEA el signo se invierte**: disponible en positivo. El negativo del Excel
es la contabilidad del proveedor, para quien nosotros somos un pasivo.

### La cadena del pago

El usuario: *«se hace una solicitud por cada factura con su vale, y la mayoría
de las veces contabilidad agrupa solicitudes y hace un solo pago que abarca un
grupo de facturas»*.

Verificado contra el Excel: **67 de 75 abonos son la suma exacta de un grupo de
facturas pendientes.** Ejemplos: `2354.10 = FER2033637 + FER2033663`,
`2821.50 = FER2033687 + FER2033747`.

```
registro de fuel  ──1:1──>  Solicitud de Pago
                                   │
                                   └──N:1──>  reposición al proveedor
                                                = 1 abono = 1 comprobante
```

Por eso **el comprobante vive en la reposición, no en cada SP**: un solo pago
bancario cubre varias solicitudes, y duplicar el archivo en cada una sería
tener el mismo papel en N lugares. La SP conserva su
`comprobante_storage_path` para todo lo demás del módulo de Pagos; acá no se
usa.

## Modelo

Tres tablas nuevas. El estado de cuenta **no se guarda**: se calcula, igual que
la liquidación del crucero. Guardar el saldo corriente sería guardar la misma
verdad tres veces y darle tres formas de quedar mal.

### `avn_fuel_cuentas`
Una por aeronave. Hoy solo TG-OBI.
- `aeronave_id` único, `proveedor`, `proveedor_nit`, `moneda`
- `deposito_objetivo` — el nivel al que se repone (Q25,856.20)
- `alerta_minimo` — cuando el disponible baja de aquí, la pantalla avisa
- `historico_hasta date` — la fecha hasta la que manda la historia importada.
  Los registros de CEA anteriores a esa fecha **no entran al saldo**: ya están
  en la historia y se contarían dos veces.

### `avn_fuel_movimientos`
Los 299 movimientos importados del Excel del proveedor. Solo historia.
- `cuenta_id`, `tipo` (`saldo_inicial` | `cargo` | `abono`)
- `fecha`, `documento`, `comentario`, `monto`

### `avn_fuel_abonos`
Las reposiciones hechas desde CEA, de aquí en adelante.
- `cuenta_id`, `fecha`, `monto`, `moneda`
- `documento` — el `AP`/`AG`/`NC` que devuelve el proveedor
- `comprobante_path`, `comprobante_nombre` — la boleta o la transferencia
- `notas`

### `avn_fuel_abono_registros`
Qué facturas cubre cada reposición.
- `abono_id`, `registro_id`

### El saldo

```
disponible = saldo_inicial
           + Σ abonos históricos      + Σ reposiciones de CEA
           − Σ cargos históricos      − Σ registros de CEA no anulados
                                        (con fecha > historico_hasta)
```

Un registro **anulado** no cuenta: ya deja de sumar al total facturado y por la
misma razón no consume depósito.

## UI

Pestaña nueva en la aeronave, junto a *Ficha y documentos* y *Combustible*:
**Estado de cuenta**.

1. **Cabecera** — el disponible grande y en positivo, el depósito objetivo, y
   cuánto falta para reponerlo. En ámbar si baja del mínimo: con límite de
   crédito en cero, quedarse sin saldo es quedarse sin fuel.
2. **Movimientos** — fecha, documento, comentario, cargo, abono y el saldo
   corriendo. Las facturas de CEA se distinguen de las importadas y llevan su
   👁 al registro completo.
3. **＋ Reposición** — fecha, monto, documento, comprobante, y la **selección
   de las facturas que cubre**. La pantalla verifica que la suma de las
   facturas cuadre con el monto, como el formulario del crucero con los abonos.
4. **Conciliación** — «Saldo según Aeroclub al __/__/__: Q____» y la
   diferencia contra el de CEA. Es lo que caza errores; el espejo solo los
   esconde.

## Migración

1. `20260929000002_fuel_cuenta.sql` — las cuatro tablas, RLS con
   `puede('aeronaves', …)`, triggers de `updated_at` y `audit_trigger`.
2. Script de una sola vez que lee el `.xls` y carga los 299 movimientos con
   `tipo`, `fecha`, `documento`, `comentario` y `monto`, más el saldo inicial
   de −3,463.30 y `historico_hasta = 2026-04-22`.
3. Verificación: el saldo que calcule CEA con la historia cargada tiene que dar
   **exactamente Q24,736.20 disponibles**. Si no da, la importación está mal.

De aquí en adelante no hay más importaciones: las facturas ya las captura CEA y
las reposiciones se registran en la pantalla. El Excel del proveedor solo se
usa para conciliar.

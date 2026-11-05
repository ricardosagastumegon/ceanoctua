# G · Finanzas

El módulo que se pidió con más detalle. Antes de entrar: **CEA no mueve dinero.** Registra solicitudes, autorizaciones y constancias. El desembolso lo ejecuta una persona en un banco, fuera del sistema. Un registro marcado «Pagado» significa *«alguien confirmó que se pagó»*, no *«el sistema pagó»*.

---

## 1 · Las seis secciones y quién las ve

| Sección | Tabla principal | Marca «interna» | La ve un supervisor |
|---|---|:---:|:---:|
| Vales | `caja_chica_vales` | sí | ❌ |
| Liquidaciones | `caja_chica_liquidaciones` | sí | ⚠️ sólo la concreta, por enlace de firma |
| Reintegros | `reintegros` | sí | ❌ |
| Consumos TC Corp | `tc_consumos` (corporativa) | no | ✅ |
| Consumos TC Pres | `tc_consumos` (presidencia) | sí | ❌ |
| Pagos | `pagos` | no | ✅ |

«Interna» marca la operación de quien lleva el sistema. Un supervisor ve dos secciones completas, más el detalle puntual de una liquidación cuando llega a ella desde un enlace de firma.

**Importante sobre la separación Corp / Pres:** no son tablas distintas. Es la misma tabla `tc_consumos` filtrada por el tipo de tarjeta (`tc_tipo`: `corporativa` | `presidencia`). La separación es de presentación. **En la base, quien puede leer una puede leer la otra** — la política de `tc_consumos` es por rol, no por tipo de tarjeta.

---

## 2 · Las cinco entidades y cómo se enlazan

```
 ┌──────────────────┐
 │ caja_chica_vales │  VL-2026-####
 │  (adelanto de    │
 │   efectivo)      │
 └────────┬─────────┘
          │ liquidacion_vales  (tabla de unión)
          ▼
 ┌──────────────────────────┐
 │ caja_chica_liquidaciones │  CC-2026-####
 │  (rendición de gastos)   │──◄ caja_chica_liq_rows (renglones)
 └────────┬─────────────────┘
          │ firmas.liquidacion_id
          ▼
      ┌────────┐
      │ firmas │  FR-2026-####
      └───┬────┘
          │ firmas.pago_id
          ▲
 ┌────────┴─────────┐
 │      pagos       │  SP-2026-####
 │ (solicitud de    │
 │  pago)           │
 └────────┬─────────┘
          │ pagos.consumo_id
          ▼
 ┌──────────────────┐        ┌─────────────┐
 │   tc_consumos    │───────►│ reintegros  │
 │ (consumo de TC)  │        └─────────────┘
 └────────┬─────────┘
          ├──► consumo_renglones  (desglose)
          └──► vouchers
```

---

## 3 · Vales

**Qué es:** un adelanto de efectivo. Alguien recibe dinero de la caja chica y queda debiendo la rendición.

**Datos que recibe:** fecha, moneda, monto, a quién se entrega (empleado o entidad), concepto, lugar, tipo (`desembolso` | `entidad`), a quién se liquida.

**Correlativo:** `VL-AAAA-####`, generado por el servidor.

**Estados** (enumerado `vale_status`, 13 valores):

```
Creado · Solicitado · Aprobado · Asignado a Liquidación · EnLiquidacion
Pendiente de Liquidar · Liquidado · Pendiente de Reintegro · Reintegrado
Acreditado · Pagado · Anulado · Cancelado
```

⚠️ **Observación para la revisión:** trece estados para una entidad de esta naturaleza es mucho, y varios parecen solaparse (`EnLiquidacion` / `Asignado a Liquidación` / `Pendiente de Liquidar`; `Anulado` / `Cancelado`). Existe además una columna `estado_previo`, lo que sugiere que se revierte de estado en algún punto. **No se verificó** cuáles de los trece se usan en la práctica ni qué transiciones son legales — no hay una máquina de estados declarada en el código ni restricciones `CHECK` que las limiten. Es un buen candidato a revisión funcional con la usuaria.

**Auditoría:** ✅ `caja_chica_vales` tiene trigger de auditoría.

---

## 4 · Liquidaciones

**Qué es:** la rendición. Agrupa uno o varios vales y los contrasta con los gastos realmente efectuados.

**Datos que recibe:** periodo, moneda, monto total, responsable, entidad que paga, forma de pago, producto o servicio, a quién se reintegra, comprobante adjunto.

**Columnas de cuadre:** `total_compras`, `total_vales`, `diff`. La diferencia entre lo adelantado y lo gastado es lo que determina si hay que reintegrar o devolver.

**Correlativo:** `CC-AAAA-####`.

**Relación con los vales:** vía `liquidacion_vales`, una tabla de unión. Un vale entra en una liquidación; una liquidación agrupa varios vales.

**Regla automática verificada:** el trigger `unlink_vales_on_liq_delete` desvincula los vales si se elimina la liquidación. Evita vales apuntando a un registro inexistente.

**Auditoría:** ✅ la liquidación sí. ❌ **`caja_chica_liq_rows` (los renglones) no tiene trigger de auditoría**, ni tampoco `liquidacion_vales`. Se puede modificar el detalle de una rendición sin dejar rastro en `audit_log`.

---

## 5 · Consumos de tarjeta

**Qué es:** un consumo efectuado con una tarjeta corporativa o de presidencia.

**Contexto de negocio que conviene no malinterpretar:** la sección de Consumos TC funciona como **bandeja de avisos de pago de las tarjetas**, no como contabilidad de reintegro. Un revisor que la lea como un libro contable sacará conclusiones equivocadas.

**Datos que recibe:** fecha, tarjeta, proveedor, concepto, monto, moneda, número de voucher, número de autorización, quién lo solicitó, quién lo autorizó, empresa.

**Enlaces de salida:**

| Columna | Apunta a | Significado |
|---|---|---|
| `reintegro_id` | `reintegros` | Camino antiguo de reintegro |
| `origen_tabla` / `origen_id` | tabla de servicio de viaje | El consumo nació de un servicio de viaje |

**La regla de «reintegrado» · un caso documentado de evolución del modelo:**

Un consumo puede saldarse por dos caminos:

1. **Camino antiguo:** se crea un registro en `reintegros` y se enlaza con `reintegro_id`.
2. **Camino actual:** se genera una solicitud de pago (`pagos.consumo_id`) que recorre su circuito hasta «Pagado».

La interfaz marcaba un consumo como vencido mirando sólo el camino 1. Se corrigió para que un consumo cuya solicitud de pago llegó al último paso se muestre como **reintegrado**, nombrando la solicitud que lo saldó. Es un ejemplo útil de cómo las dos generaciones del modelo conviven.

**Auditoría:** ✅ `tc_consumos` sí. ❌ `consumo_renglones` no.

---

## 6 · Reintegros

**Qué es:** la devolución de un consumo a quien lo cubrió.

**Estados** (`reintegro_status`): `generada → firmada → presentada → procesada → reintegrada`

Una máquina de estados lineal y clara, a diferencia de la de vales.

**Estado de uso:** la tabla está **vacía**. El camino vigente es el de solicitud de pago. Un revisor debe tratar esta sección como funcionalidad presente en el código pero **sin uso real**, no como un flujo activo.

**Auditoría:** ✅

---

## 7 · Pagos · solicitudes de desembolso (SP)

El flujo central del módulo.

**Correlativo:** `SP-AAAA-####`.

**Datos que recibe:** fecha, proveedor, concepto, monto, moneda, tipo de pago, NIT, entidad, banco, referencia, cotización, porcentajes de anticipo y pendiente, tipo de cambio, autorizador.

**Tipos de pago** (10): Anticipo sin factura · Anticipo con factura · Pago de contado · TC-Reintegro · Transferencia internacional · Impuestos · Crédito 8/15/30 días · Otros.

### 7.1 · El circuito de seis pasos

```
  0            1                  2         3            4           5
Generado → En Solicitud → Firmado → Presentado → Procesado → Pagado
             de Firma
```

El avance se controla con `pagos.step_idx` (0 a 5) y `pagos.step_dates`, un arreglo que guarda la fecha en que se alcanzó cada paso. La función `advanceStep` incrementa el índice, sella la fecha y **sólo al llegar al paso 5 escribe `status = 'Pagado'`**.

### 7.2 · Tres representaciones del estado en la misma fila

Esto conviene señalarlo con claridad porque es el punto más confuso del modelo:

| Campo | Tipo | Papel |
|---|---|---|
| `step_idx` + `step_dates` | entero + arreglo | **El que manda.** Gobierna la interfaz y los filtros |
| `status` | enumerado `pago_estado` | Etiqueta. Sólo se actualiza al llegar al paso final |
| `status_id` | referencia a `status_solicitud_pago` | Catálogo configurable desde Admin |

**Consecuencia verificada:** entre el paso 1 y el 4, `status` conserva su valor inicial (se observó «Programado» en solicitudes que ya iban por el paso 1) mientras `step_idx` avanza. Los dos campos **no están sincronizados** salvo en el extremo final. Cualquier informe que lea `status` en lugar de `step_idx` dará un resultado distinto del que muestra la aplicación.

### 7.3 · Documentación de respaldo

- `comprobante_storage_path` → archivo en el bucket `documentos`.
- La vista imprimible («Formato Oficial FZ») está disponible junto al botón de ver en las solicitudes que completaron el circuito.
- Los adjuntos se incorporan al PDF generado, no sólo se enlazan.

**Auditoría:** ✅ `pagos` tiene trigger.

---

## 8 · Validaciones verificadas

| Validación | Dónde vive |
|---|---|
| Correlativo único y secuencial | Secuencia en la base (`DEFAULT`) |
| No retroceder de paso | `advanceStep` sale si ya está en el último |
| Un documento de viajero cuelga de persona **o** invitado, no ambos | `CHECK (num_nonnulls(...) = 1)` |
| Vales desvinculados al borrar su liquidación | Trigger |
| Borrado suave en todas las entidades financieras | Columna `deleted_at` + filtros |
| Quien no sea admin/asistente no escribe en Finanzas | RLS |

**Lo que no se encontró:**

- No hay restricciones `CHECK` que limiten las transiciones de estado de los vales.
- No hay restricción que impida que `monto` sea negativo o cero en las tablas financieras revisadas. ⚠️ **No verificado exhaustivamente** en las 12 tablas.
- No hay bloqueo contra la doble liquidación de un mismo vale más allá de la lógica de aplicación.

---

## 9 · Quién interviene

| Acción | Quién puede, según RLS |
|---|---|
| Crear vale, liquidación, consumo, reintegro, pago | `admin` o `asistente` |
| Avanzar una solicitud de pago | `admin` o `asistente` |
| **Firmar** | quien tenga `puede('cea','editor')` |
| Ver Consumos TC Corp y Pagos | también `solo_lectura` |
| Ver renglones de caja chica | **sólo** `admin` o `asistente` |
| Borrar (suave) | según política de cada tabla |

**Punto de atención:** firmar requiere ser editor de **CEA**, no de Finanzas. Una persona con permiso de edición en CEA puede firmar una solicitud de pago aunque no tenga ningún permiso en Finanzas. Es coherente con el diseño —la firma vive en CEA— pero conviene tenerlo presente al repartir accesos.

---

## 10 · Flujo completo · del consumo a la firma de Presidencia

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ORIGEN                                                   │
│    · Consumo con tarjeta corporativa, o                     │
│    · Gasto que requiere desembolso, o                       │
│    · Notificación automática de combustible (Aeronaves)     │
│    Quien lo inicia: la asistente                            │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SOLICITUD DE PAGO            step_idx = 0 · «Generado»   │
│    Requiere: proveedor, concepto, monto, moneda, tipo,      │
│              entidad, autorizador                            │
│    Genera: SP-AAAA-####                                      │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SOLICITUD DE FIRMA           step_idx = 1                │
│    Crea un registro en `firmas` con pago_id                 │
│    Destinatarios: filas en `firma_miembros`                 │
│    Urgencia: urgente | importante | programado              │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. FIRMA                        firmas.status_firma          │
│    en_espera ──► firmado | stand_by | denegada               │
│    Quien firma: usuario con puede('cea','editor')            │
│    Deja: fecha_firma + firmada_por (uuid)                    │
│    ⚠️ Sin registro en audit_log                              │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. step_idx →2  FIRMADO                                     │
│    AUTOMÁTICO desde la fase 43: el trigger                   │
│    `avanzar_pago_al_firmar` mueve la solicitud cuando        │
│    TODAS sus firmas vivas están firmadas                     │
│                                                             │
│    step_idx 3→4   Presentado · Procesado                     │
│    Avance manual. Cada paso sella su fecha                  │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. PAGADO                       step_idx = 5                │
│    status = 'Pagado'                                        │
│    Se habilita: carga de comprobante + Formato Oficial FZ   │
│    Efecto cruzado: si tenía consumo_id, el consumo pasa a   │
│    mostrarse como REINTEGRADO en Consumos TC                │
└─────────────────────────────────────────────────────────────┘
```

**Cómo termina:** la solicitud queda en el paso 5 con su comprobante adjunto y su formato oficial imprimible. No hay cierre contable ni conciliación automática posterior.

---

## 11 · Auditoría y trazabilidad del módulo

| Tabla | Trigger de auditoría |
|---|:---:|
| `pagos` | ✅ |
| `tc_consumos` | ✅ |
| `caja_chica_vales` | ✅ |
| `caja_chica_liquidaciones` | ✅ |
| `reintegros` | ✅ |
| `vouchers` | ✅ |
| `caja_chica_liq_rows` | ✅ *(fase 44)* |
| `liquidacion_vales` | ✅ *(fase 44)* |
| `consumo_renglones` | ✅ *(fase 44)* |
| **`firmas` / `firma_miembros`** | ✅ *(fase 44)* |
| `caja_chica_op_*` (3 tablas) | ❌ |

**El hueco más relevante, ya cerrado:** hasta la fase 44 las cabeceras financieras estaban auditadas pero **el detalle y la firma no** — se podía alterar el desglose de una rendición, o modificar un registro de firma, sin dejar constancia. Las seis tablas marcadas arriba se corrigieron el 5 nov 2026. Queda fuera la operación por periodos (`caja_chica_op_*`), de uso marginal.

Para una firma queda la evidencia en la propia fila (`fecha_firma`, `firmada_por`), pero esa fila es modificable por cualquier editor de CEA y el cambio no se registra. **Si la trazabilidad de la autorización es un requisito del negocio, este es el punto a atender primero.**

**Matiz añadido en la fase 43:** desde que la firma avanza la solicitud, firmar provoca un cambio de estado financiero. Ese cambio **sí** queda en `audit_log`, porque `pagos` está auditada y el trigger corre bajo `auth.uid()` de quien firmó: se sabe quién movió la solicitud y cuándo. Lo que sigue sin registro es la fila de `firmas` en sí.

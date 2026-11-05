# PLAN · Control de Combustible de Vehículos

> **Estado:** propuesta, pendiente de aprobación para aplicar. No se ha tocado código ni base de datos.
> **Fuentes:** `Formato_oficial_de_Solicitud_de_vale_de_Combustible.xlsx` y foto del formato
> `FZ-RG-0185 v04` lleno (Angeles Quezada, 5 nov 2026), más sus respuestas a las seis dudas.
> **Fase propuesta:** 45.

---

## 1 · Objetivo

Llevar en CEA la cadena completa del combustible de vehículos, que hoy vive en papel y
en un Excel: desde que un chofer pide una solicitud de vale hasta que la Solicitud de
Pago firmada llega al Tesorero.

Tres cosas lo distinguen de todo lo que ya existe en el sistema:

1. **Es a crédito.** No es un adelanto de efectivo (caja chica) ni un depósito previo
   (aeronaves). Se consume primero y se paga después, por quincena.
2. **El documento sale del sistema y vuelve.** La solicitud de vale la emite Angeles y
   la ejecuta el Tesorero. Hoy ese viaje es de papel; aquí se vuelve digital.
3. **Tiene dos formatos oficiales que hay que replicar exactos**, no reinterpretar:
   `OL-RG-0175` (solicitud de vale) y `OL-RG-0270` (control de vales).

**Lo que NO es:** administración de flota. Angeles no lleva la información de los
vehículos. Las columnas de kilometraje existen en el formato oficial y se capturan si
hay dato, pero no se construye analítica sobre ellas.

---

## 2 · Lo que se leyó de los documentos

Verificado celda por celda, no interpretado.

### 2.1 · La cadena real

| # | Documento | Quién lo emite | Qué aporta |
|---|---|---|---|
| 1 | **Solicitud de vale** `OL-RG-0175` | **CEA (Angeles)** | Autoriza el consumo |
| 2 | **Vale de la gasolinera** | El proveedor | Número preimpreso. Es lo que el chofer canjea |
| 3 | **Recibo de despacho** | El proveedor | Comprobante #, bomba, manguera, producto, galones, precio/galón, total |
| 4 | **Factura** (FEL) | El proveedor | Serie + número, NIT, monto |
| 5 | **Contraseña de pago** | **La propia empresa** (Agro Atlantic, S.A.) | Número, documento, vencimiento, monto |
| 6 | **Control de vales** `OL-RG-0270` | **CEA (Angeles)** | Consolidado de la quincena. Base de la SP |
| 7 | **Solicitud de Pago** `FZ-RG-0185` | **CEA · PAGOS — ya existe, no se toca** | El circuito de seis pasos de siempre |

**Relación entre despacho y factura** *(confirmado con la usuaria)*: normalmente una
factura por despacho. Cuando hay **dos despachos el mismo día**, el proveedor puede
emitir **una sola factura por los dos**. Nunca una factura por quincena ni por un
periodo más largo.

→ Consecuencia de modelo: los datos de factura viven **en la solicitud**, y se admite
que dos solicitudes compartan el mismo número de factura. El monto que suma el reporte
es el **del despacho**, no el de la factura, justamente para que ese caso no duplique.

**Contraseña de pago** *(confirmado)*: una por factura. **No aparece en el control de
vales** — se captura como parte del expediente y se adjunta en físico, nada más.

### 2.2 · El formato `OL-RG-0175` — Solicitud de vale

Encabezado: logo · «Registro / Autorización de vales para combustibles» ·
Código `OL-RG-0175` · Fecha `Septiembre 2024` · Sub-Proceso `Operaciones` · Versión `02`.

```
Fecha:          ______      No. Vale        ______
Vale a:         ______      No. Placa       ______
Marca:          ______      Tipo vehículo:  ______
Departamento:   ______
┌────────────────── Justificación ──────────────────┐   (banda negra, texto libre)
└───────────────────────────────────────────────────┘
      Autorizado por:              Solicitado por:
          Firma                        Firma
      Lissa Arriaza
Monto del Vale:      ______
Kilometraje actual:  ______
Km. Ultima Llenada:  ______
```

Geometría para la réplica: columnas B=14.33 C=36.33 D=14.0 E=13.55 F=11.55 (A=3.0 de
margen); alturas 4-7 = 13.9/13.9/13.9/14.45, 8 = 8.25, 13 = 5.45, **15 = 49.5** (la caja
de justificación), 21-22 = 15.0. Vertical, márgenes 0.7/0.75.

### 2.3 · El formato `OL-RG-0270` — Control de vales

Horizontal, escala 58 %. Código `OL-RG-0270`, versión 02.

```
Vales de combustible del [1] al [15] de [Septiembre] [2026]        ← en rojo
```

**Seis cuadros**, uno por responsable. La nota al pie de la hoja lo dice expresamente:
*«una hoja debe de llevar 6 cuadros para registrar los vales»*, y el recuadro
**Total por vehículo** lista seis líneas.

> *Nota:* al confirmar, la usuaria escribió «los 5 cuadros son fijos». La hoja tiene
> seis. Como el bloque se modela como **catálogo**, el número deja de importar: se
> administran los que haya. Queda apuntado por si fuera un sexto que ya no se usa.

Se verificó cuál es la información marcada en rojo. Es exactamente ésta:

| En rojo | Ejemplo |
|---|---|
| Fechas del periodo | 1 · 30 · Septiembre · 2026 |
| Marca del vehículo | LEXUS BLANCA |
| Tipo de vehículo | CAMIONETA |
| Puesto del responsable | Gerente Administrativo |
| Nombre del responsable | LISSA ARRIAZA |
| Placa | P-930LTT |

Los cuadros del ejemplo:

| # | Puesto | Responsable | Vehículo | Placa |
|---|---|---|---|---|
| 1 | Gerente Administrativo | Lissa Arriaza | LEXUS BLANCA · camioneta | P-930LTT |
| 2 | Gerente Agrícola | Javier Arriaza | RAM NEGRO · pick up | P-143JWB |
| 3 | Gerente General | Erick González | TOYOTA · camioneta | P-326FKN |
| 4 | Mensajero | José Ruiz | YAMAHA · motocicleta | — |
| 5 | Departamento de Compras | Verónica Pérez | varios | — |
| 6 | Otros (Asistente de Gerencias y Presidencias) | — | varios | — |

**Dos disposiciones de columnas distintas:**

- **Cuadros con vehículo asignado**
  `Fecha · Vale # · Solicitado por · Galones · Monto fact. · Km x Gl (anterior/actual) · Kms recorridos · Km x Gl`
  Cierra con *Totalizado* y *Kilómetros recorridos por galón*.
- **Cuadros de vehículos varios**
  `Fecha · Vale # · Responsable · Galones · Monto · Vehículo · Propietario · Observaciones · Placa`
  Cierra sólo con *Totalizado*.

Pie: `Realizado Por: Angeles Quezada / Asistente de Gerencias` y el recuadro
**Total por vehículo** con los subtotales y el **TOTAL**.

### 2.4 · La Solicitud de Pago resultante `FZ-RG-0185`

De la foto del formato lleno, los valores que el módulo debe proponer al enviar a PAGOS:

| Campo | Valor |
|---|---|
| Entidad que paga | AGROATLANTIC, S.A. |
| Tipo de pago | Crédito 30 días |
| Moneda | Quetzales (GTQ) |
| A favor de | **COMERCIAL DE INVERSIONES SANTANA, SOCIEDAD ANÓNIMA** |
| NIT | 7257252 |
| Monto | el total del control de vales |
| Concepto de compra | `Combustible de vehículos del {ini} al {fin} de {mes} de {año}` |
| Centro productivo | se deja en blanco — hoy se llena a mano |
| Observaciones | `Se adjuntan facturas, vales, órdenes de despacho, contraseñas de pago y control de vales` |

> **Resuelto el 5 nov 2026.** La SP de ejemplo dice «COMERCIALIZADORA DE INVERSIONES
> SANTANA»; la factura FEL, el vale y la contraseña dicen «COMERCIAL». Confirmado con
> la usuaria: la razón social correcta es **COMERCIAL DE INVERSIONES SANTANA, SOCIEDAD
> ANÓNIMA**, NIT 7257252, nombre comercial «Super Servicio Reforma». La SP de ejemplo
> traía el nombre mal escrito.

---

## 3 · Modelo de datos

Cuatro tablas nuevas. Ninguna existente se modifica salvo un `CHECK` aditivo (§8).

### 3.1 · `envios` — el mecanismo que faltaba

**Por qué existe.** La usuaria describió cuatro veces la misma mecánica, con cuatro
documentos distintos y las mismas palabras: *«tal como Lissa recibe las solicitudes de
firma digital»*.

| Documento | De | Para | Al aceptar |
|---|---|---|---|
| Solicitud de vale | Angeles | Victor | registra el No. de vale |
| Solicitud de Pago firmada | Angeles | Victor | cierra la cadena completa |
| Vale de dinero de caja chica | Angeles | Victor | *(fase siguiente)* |
| Liquidación de caja chica | Angeles | Victor | *(fase siguiente)* |

Son el mismo acto: **un documento viaja a un usuario, él lo acepta, y su aceptación
mueve el estado del documento de origen.** Construirlo cuatro veces sería construirlo
mal cuatro veces. Se construye una, aquí, y los demás módulos se enchufan.

> No se reutiliza `firmas` para esto. `firmas` es el circuito de firma de la **junta
> directiva**, y además sigue el recorrido del papel (`recepcion`, `entregado`,
> `quien_recibe`). Victor no es la junta y lo suyo no es una firma: es una recepción.
> Mezclarlos ensuciaría la trazabilidad de lo que sí es una firma.

| Columna | Tipo | Nota |
|---|---|---|
| `id` · `serial` `EN-2026-####` | | |
| `destinatario_id` | uuid → `usuarios` | a quién se le envía |
| `doc_tipo` | text check | `comb_solicitud` · `comb_reporte` · `pago` · `cc_vale` · `cc_liquidacion` |
| `doc_id` | uuid | el documento enviado |
| `estado` | text check | `enviado` · `aceptado` · `rechazado` |
| `enviado_at` `enviado_por` | | |
| `resuelto_at` `resuelto_por` `nota` | | |
| `snapshot` | jsonb | **copia congelada de lo que el destinatario debe ver.** Es lo que hace que no necesite leer la tabla de origen (§5.2) |
| `datos` | jsonb | lo que el destinatario llena al aceptar (ej. `{"vale_num":"094311"}`) |
| estándar + auditoría | | |

**Una sola función** resuelve el acto, `security definer` porque el destinatario no
debe poder escribir las tablas de negocio:

```sql
public.envio_aceptar(p_envio uuid, p_datos jsonb, p_nota text)
```

Marca el envío como aceptado y despacha la cascada que corresponda al `doc_tipo`.
Es el mismo patrón de la fase 43, generalizado.

### 3.2 · `comb_responsables` — catálogo de los cuadros

Vive en **Admin**. Es, literalmente, lo que está en rojo en la hoja de Angeles.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `empleado_id` | uuid → `empleados` null | Nombre y puesto salen de aquí |
| `etiqueta` | text | «OTROS», «DEPARTAMENTO DE COMPRAS» — cuadros sin persona fija |
| `puesto_label` | text | Sobrescribe el puesto del empleado si el formato pide otro texto |
| `vehiculo_id` | uuid → `vehiculos` null | **null = cuadro de «vehículos varios»** |
| `tipo_bloque` | text check | `vehiculo_asignado` · `varios` |
| `orden` | int | define el orden de impresión |
| `activo` | bool | |
| `created_at` `updated_at` `deleted_at` | | borrado suave |

RLS **Pattern C · catálogo**. Trigger de auditoría.

### 3.3 · `comb_solicitudes` — el expediente que viaja

Una fila por solicitud de vale, que **acumula** lo que va llegando. No se parte en
cuatro tablas porque en la realidad no se parte: vale, despacho, factura y contraseña
describen un mismo consumo.

| Grupo | Columnas |
|---|---|
| **Identidad** | `id` · `serial` `SV-2026-####` · `estado` |
| **Solicitud** (Angeles) | `fecha` · `responsable_id` → `comb_responsables` · `vehiculo_id` → `vehiculos` · `vale_a` · `departamento` · `solicitado_por_id` → `empleados` · `justificacion` · `autorizado_por_id` → `personas` · `monto_autorizado` · `kilometraje_actual` · `km_ultima_llenada` |
| **Vale** (**Victor**) | `vale_num` · `vale_fecha` · `vale_emitido_por` |
| **Despacho** (Angeles) | `recibo_num` · `recibo_fecha` · `producto` · `galones` · `precio_galon` · **`monto`** · `bomba` · `manguera` |
| **Factura** | `proveedor_id` → `proveedores` · `factura_serie` · `factura_numero` · `factura_fecha` · `factura_monto` |
| **Contraseña** | `contrasena_num` · `contrasena_fecha` · `contrasena_vencimiento` |
| **Vehículo libre** (cuadros «varios») | `vehiculo_desc` · `propietario` · `placa_libre` · `observaciones` |
| **Cierre** | `reporte_id` → `comb_reportes` null |
| **Estándar** | `created_at` `updated_at` `deleted_at` `created_by` `updated_by` |

`monto` —el del despacho— es el que suma el reporte. `factura_monto` es referencia: si
una factura cubre dos despachos, su monto se repite en las dos filas pero sólo se suman
los despachos. Sin esto, el caso de los dos despachos del mismo día duplicaría el total.

**Estados:**

```
borrador ──► enviada_tesorero ──► vale_emitido ──► despachada ──► documentada ──► en_reporte ──► pagada
    │
    └──► anulada
```

RLS **Pattern A · financiero**, con una excepción acotada para el Tesorero (§5).
Trigger de auditoría.

### 3.4 · `comb_reportes` — el control quincenal `OL-RG-0270`

| Columna | Nota |
|---|---|
| `id` · `serial` `CV-2026-####` | |
| `periodo_ini` `periodo_fin` | quincenal |
| `estado` | `abierto` → `cerrado` → `enviado_a_pagos` → `pagado` |
| `realizado_por_id` → `empleados` | «Angeles Quezada · Asistente de Gerencias» |
| `total` | se recalcula al cerrar y se congela |
| `notificacion_id` → `pagos_notificaciones` · `pago_id` → `pagos` | |
| estándar + auditoría | |

Los cuadros **no se guardan**: se derivan agrupando las solicitudes del periodo por
`responsable_id`, ordenadas por `comb_responsables.orden`. Así el total siempre cuadra
con sus renglones y no hay dos verdades que puedan separarse.

---

## 4 · El flujo completo

```
   ANGELES (admin)           VICTOR · TESORERÍA          LISSA (solo lectura)
   ───────────────           ──────────────────          ────────────────────
 ① Crea SOLICITUD DE VALE
   Imprime OL-RG-0175
   «Enviar al tesorero» ──────► ② Bandeja: por emitir
                                   Entrega el vale físico
                                   Registra No. Vale ──┐
                                                       │
 ③ El chofer abastece  ◄────────────────────────────────┘
   Captura recibo de despacho
 ④ Captura factura y contraseña

   ─────────── cada 15 días ───────────

 ⑤ Cierra el CONTROL DE VALES
   Imprime OL-RG-0270
   «Enviar a PAGOS»
          │
          ▼  pagos_notificaciones · origen_tipo = 'combustible_vehiculos'
          │
 ⑥ FINANZAS · PAGOS
   Crea la SP  ·  adjunta el PDF del expediente
   «Enviar a firma» ───────────────────────────────────► ⑦ Firma
                                                            │
                                      (trigger fase 43      │
                                       avanza el pago) ◄────┘
          │
          ▼
 ⑧ «Enviar al tesorero» ───────► ⑨ Bandeja: SP firmadas
                                    pendientes de pagar
```

Los pasos ⑥ y ⑦ ya existen y no se tocan. Nuevos: ②, ⑧, ⑨ y el adjunto del PDF.

### 4.1 · Las dos aceptaciones de Victor y lo que disparan

Lo pidió expresamente: que al aceptar, **los estados se muevan solos**, hacia adelante
y hacia atrás, sin que ella tenga que ir a actualizar tres pantallas a mano.

**Aceptación 1 · la solicitud de vale**

```
envio_aceptar(doc_tipo='comb_solicitud', datos={"vale_num": "094311"})
   │
   ├─► envios.estado            = 'aceptado'
   └─► comb_solicitudes.estado  = 'vale_emitido'
       comb_solicitudes.vale_num / vale_fecha / vale_emitido_por
```

**Aceptación 2 · la Solicitud de Pago firmada** — ésta es la que cierra la cadena.

Se apoya en los seis pasos que `pagos` ya tiene, sin inventar ninguno:

```
Generado → En Solicitud de Firma → Firmado → Presentado → Procesado → Pagado
   0              1                  2           3            4          5
                                     ▲           ▲            ▲
                              Lissa firma   «Enviar al   Victor acepta
                              (fase 43)      tesorero»
```

```
envio_aceptar(doc_tipo='pago')
   │
   ├─► envios.estado        = 'aceptado'
   ├─► pagos.step_idx       = 4  (Procesado) + fecha en step_dates
   │
   └─► CASCADA HACIA ATRÁS, si el pago vino de un control de vales
       ├─► comb_reportes.estado    = 'en_tesoreria'
       └─► comb_solicitudes.estado = 'en_tesoreria'  (todas las del reporte)
```

Y al marcarse **Pagado** (paso 5), la misma cascada cierra: el reporte y todas sus
solicitudes pasan a `pagada`. Así el vale de un chofer dice «pagada» porque la SP que
lo cubría se pagó, no porque alguien se acordó de marcarlo.

**Confirmado el 5 nov 2026:** *Pagado* lo marca **Victor**. La cola de la vida de la SP
es suya desde que la recibe: él la acepta (paso 4) y él la marca pagada (paso 5).

Son dos actos y no uno, porque el combustible es a **crédito 30 días**: la contraseña
del ejemplo se recibe el 26/10 y vence el 13/11. Entre recibir y pagar hay semanas, y
el sistema debe poder decir en cuál de las dos está.

---

## 5 · El usuario Tesorero · Victor Murillo

`vmurillo@sion.com.gt` — autorizado por la usuaria el 5 nov 2026.

### 5.1 · Lo que recibe no es sólo combustible

La usuaria aclaró que a Victor **también se le envían las liquidaciones de caja chica**.
Eso cambia el encuadre: su pantalla no es una sección del módulo de Combustible, es una
**bandeja de Tesorería** con tres pilas, igual que Lissa tiene su propio tablero de
firmas.

Su bandeja **no consulta cuatro tablas distintas**: lee `envios` filtrando por
`destinatario_id` y `estado = 'enviado'`. Una consulta, una pantalla, y cada documento
nuevo que algún día se le envíe aparece ahí sin tocar su código.

| Pila | `doc_tipo` | Al aceptar | Cuándo |
|---|---|---|---|
| **Vales de combustible por emitir** | `comb_solicitud` | registra el No. de vale | **fase 45** |
| **Solicitudes de pago firmadas** | `pago` | cierra la cadena (§4.1) | **fase 45** |
| **Vales de dinero de caja chica** | `cc_vale` | acusa recibo | fase siguiente |
| **Liquidaciones de caja chica** | `cc_liquidacion` | acusa recibo | fase siguiente |

Modelar su bandeja como Tesorería y no como «una pestaña de Combustible» es lo que
permite que las dos últimas pilas se enchufen después sin rehacer nada.

### 5.2 · Permisos · el sobre cerrado

La usuaria fijó la regla el 5 nov 2026, y es más estricta de lo que este plan asumía:

> *«cada usuario es independiente… yo no tendría porque ver lo que él tenga en su
> usuario ni lo que hace… podremos enviarnos y recibir documentos o avisos, pero cada
> quien en su rol y perfil.»*

**El plan original lo incumplía.** Daba a Victor el rol `solo_lectura`, y se verificó
que ese rol concede lectura de **seis tablas financieras completas**: `pagos`,
`caja_chica_vales`, `caja_chica_liquidaciones`, `tc_consumos`, `vouchers` y
`reintegros`. Su pantalla habría mostrado sólo su bandeja, pero su sesión habría podido
leer todos los pagos y toda la caja chica de Angeles por API. Eso no es independencia;
es una interfaz que esconde lo que la base sí entrega.

**Diseño corregido: el envío es un sobre cerrado.**

`envios` gana una columna `snapshot jsonb` — una copia congelada de lo que el
destinatario necesita ver para decidir: correlativo, fecha, monto, concepto, y los
renglones que lleve el documento. El envío **se basta a sí mismo**.

| | |
|---|---|
| Rol | **ninguno de los que dan lectura financiera** — se añade `tesoreria` al enum `app_rol` |
| Módulos | `tesoreria` nivel `editor` |
| Lo que LEE | `envios` donde `destinatario_id = auth.uid()`, y nada más |
| Lo que ESCRIBE | nada directamente; sólo ejecuta `envio_aceptar(...)` |

Victor **no tiene lectura sobre ninguna tabla de negocio de Angeles.** No es que la
interfaz no se la muestre: es que la política no se la da. Como un correo: recibe el
contenido, no la llave del archivo.

Ventaja secundaria: el `snapshot` es prueba de qué se envió exactamente, inmutable,
independiente de que el documento original cambie después. Es mejor para auditoría que
una referencia viva.

> **Esto es un anticipo de [PLAN-ESPACIOS-SEPARADOS.md](PLAN-ESPACIOS-SEPARADOS.md).**
> `envios` es, literalmente, la «tabla de concesiones» que aquel borrador decía que
> haría falta para compartir sin abrir todo. Construir a Victor así desde el primer día
> significa que cuando lleguen los espacios no hay que deshacerle nada.

### 5.3 · Lo que este diseño todavía NO resuelve

Hay que decirlo con claridad porque la usuaria preguntó justamente por esto.

**Mientras Angeles sea `admin`, verá lo de Victor.** `es_admin()` y `puede()` devuelven
verdadero para el administrador en todas las tablas, por definición. Hoy eso no estorba
—Victor no tiene datos propios— pero **en cuanto exista su módulo de caja chica, sí**.

Esa es la pregunta 4 de `PLAN-ESPACIOS-SEPARADOS.md`, y la usuaria acaba de contestarla:
que tampoco el admin vea. Es una decisión con un costo que conviene tener presente:

| Si el admin NO ve los espacios ajenos | Consecuencia |
|---|---|
| Nadie puede auditar desde dentro de la app | El `audit_log` sigue siendo de admin, así que el rastro queda; el **contenido**, no |
| Angeles no puede ayudar a Victor con su caja | Un error suyo lo arregla él o nadie |
| Recuperar algo borrado requiere la base de datos | Deja de ser una operación de la app |

No bloquea la fase 45. Bloquea la fase 48.

## 6 · Interfaz

**Módulo nuevo: `COMBUSTIBLE`**

| Sección | Contenido |
|---|---|
| **Solicitudes** | Tabla con filtros por estado, responsable y periodo. Acciones: crear · imprimir `OL-RG-0175` · enviar al tesorero · capturar despacho · capturar factura y contraseña · anular |
| **Control de vales** | Un reporte por quincena. Vista previa de los cuadros. Acciones: cerrar · imprimir `OL-RG-0270` · enviar a PAGOS |

**Tablero de Tesorería** — la pantalla de inicio de Victor, con las tres pilas de §5.1.

**Admin** gana **Responsables de combustible**. **Admin → Vehículos** ya existe y está
vacío; se llena con los carros.

**Dos componentes imprimibles nuevos**, réplica exacta, con el patrón ya probado en
`SolicitudPagoPrintable.tsx` (anchos en % del Excel, alturas en puntos, factor `K`):

- `SolicitudValePrintable.tsx` — vertical, `OL-RG-0175`
- `ControlValesPrintable.tsx` — horizontal, `OL-RG-0270`, cuadros + totales

Logo del encabezado: `reference/combustible/logo-ol.png`.

---

## 7 · Adjuntar el expediente a la Solicitud de Pago

Pedido en la misma conversación. **Es separable de Combustible** y sirve a todas las SP,
no sólo a ésta.

**Estado actual verificado:** existe una tabla `documentos` genérica
(`entidad_tipo` + `entidad_id` + `storage_path`) y está **completamente sin uso**: 0
filas. `pagos.comprobante_storage_path` existe y también está en 0 de 6 pagos. La
documentación para la revisión externa ya lo registraba como *«prevista, no
implementada»*.

**Propuesta:** usar `documentos` con `entidad_tipo = 'pago'`, subiendo al bucket
`documentos` que ya existe. Varios archivos por SP, no uno solo. En la ficha del pago,
un panel de adjuntos con subir / descargar / eliminar.

> El bucket `documentos` tiene hoy una política de lectura `auth.uid() IS NOT NULL`:
> **cualquier usuario autenticado lee cualquier archivo**. Está señalado en la
> documentación de la revisión externa (§5.1 de `08-AUDITORIA-Y-SEGURIDAD.md`). Si se
> va a empezar a subir facturas y contraseñas ahí, conviene acotarlo en esta misma
> migración. El patrón correcto ya existe en `avn-documentos`.

---

## 8 · Migración

**Dos archivos**, porque son dos cosas distintas y conviene poder revertir una sin la
otra: el mecanismo de envíos sobrevive a cualquier módulo que lo use.

**`2026110X000001_envios.sql`** — la infraestructura

1. Tabla `envios` —con `snapshot`— + sequence y trigger del serial `EN-`
2. RLS: escribe `admin`/`asistente`; **el destinatario lee sólo los suyos**
   (`destinatario_id = auth.uid()`) y `admin`/`asistente` los ven todos
3. Trigger `audit_trigger()`
4. Función `envio_aceptar(...)` `security definer` con `set search_path to 'public'`,
   con el despacho por `doc_tipo`
5. `'combustible'` y `'tesoreria'` añadidos al `CHECK` de `usuario_modulos.modulo`
   *(aditivo)*
6. `'tesoreria'` añadido al enum `app_rol` *(aditivo)* — un rol que **no** concede
   lectura sobre ninguna tabla financiera, a diferencia de `solo_lectura` (§5.2)

**`2026110X000002_combustible_vehiculos.sql`** — el módulo

1. `comb_responsables` · `comb_solicitudes` · `comb_reportes`
2. Sequences + funciones + triggers de serial (`SV-`, `CV-`)
3. Triggers de `updated_at`
4. `ENABLE ROW LEVEL SECURITY` + políticas (Pattern C en el catálogo, Pattern A en las
   otras dos)
5. Trigger `audit_trigger()` en las tres
6. La cascada de §4.1, enganchada en `envio_aceptar`
7. Catálogo del proveedor y de los responsables, si ella quiere que vaya sembrado
8. Bloque `do $$` de autocomprobación

Las dos cierran con `NOTIFY pgrst, 'reload schema';` y las dos se prueban **en seco
primero** —transacción con `raise exception` al final, que revierte todo— antes de
aplicarse de verdad.

No hacen falta ajustes de lectura para Victor: §5.2 lo verificó contra las políticas
en vivo.

Se probará **en seco primero** —transacción con `raise exception` al final, que revierte
todo— antes de aplicarla de verdad. Procedimiento de siempre contra producción.

El usuario de Victor se crea **aparte y después** de la migración, con autorización
explícita en el momento.

---

## 9 · Lo que este plan deja fuera a propósito

- **Administración de flota.** Mantenimientos, seguros, odómetros.
- **Analítica de rendimiento.** Las columnas `Km x Gl` se imprimen con lo que haya
  capturado; no se construyen gráficas ni alertas.
- **Reutilizar el Vale de caja chica.** Se evaluó y se descartó: el `VL-2026-####` es un
  adelanto de efectivo que luego se liquida; éste es un consumo a crédito contra un
  documento de un tercero. Mismo nombre, cosas distintas.
- **Tocar el circuito de PAGOS.** La SP sigue siendo la que ya existe; sólo gana el
  panel de adjuntos.
- **La contraseña de pago en el control de vales.** Confirmado con la usuaria: no va.

---

## 10 · El panorama completo

Lo que sigue no es parte de la fase 45. Se deja escrito porque la usuaria lo describió
el 5 nov 2026 y **condiciona cómo se construye lo de ahora**: si no se supiera, el
mecanismo de `envios` no existiría y habría que inventarlo cuatro veces.

### 10.1 · Hacia dónde va Tesorería

```
            ┌──────────────────────── ANGELES ────────────────────────┐
            │                                                          │
   Solicitud de vale    Vale de caja chica   Liquidación      SP firmada
   (combustible)        (dinero)             (rendición)      (pago)
            │                   │                 │                │
            └───────────────────┴────── envios ───┴────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │  BANDEJA DE TESORERÍA │
                              │   Victor Murillo      │
                              └───────────┬───────────┘
                                          │ acepta
                                          ▼
                              los estados se mueven solos
                              hacia atrás por toda la cadena
```

### 10.2 · Caja Chica con dos custodios

La usuaria lo aclaró: el módulo de Caja Chica está pensado para **Victor y la Asistente
de Presidencia**, *«ya que ambos manejan una caja chica cada uno, diferentes en su
manejo y administración»*.

**Hoy el modelo no contempla eso.** Se verificó: `caja_chica_vales`,
`caja_chica_liquidaciones` y `caja_chica_op_periodos` **no tienen ninguna columna de
caja ni de custodio**. Todo el módulo asume una sola caja chica.

Hacerlo multi-custodio es una fase propia, y no es trivial:

| Qué hay que hacer | Por qué no es cosmético |
|---|---|
| Catálogo `cajas` con su custodio | No existe nada parecido |
| `caja_id` en vales, liquidaciones y periodos | Hay datos vivos que habría que asignar a una caja |
| RLS por custodio | Hoy cualquier `admin`/`asistente` ve todo; cada custodio debe ver lo suyo |
| Decidir qué pasa con lo ya registrado | 17 liquidaciones y sus vales son de *alguna* caja |

**Recomendación:** no mezclarlo con la fase 45. Primero combustible con su mecanismo de
envíos funcionando de verdad; después caja chica multi-custodio, con los envíos ya
probados. Al revés, se arriesga el módulo que hoy sí se usa.

### 10.3 · Orden sugerido

| Fase | Qué | Estado |
|---|---|---|
| **45** | `envios` + módulo de Combustible + bandeja de Tesorería + usuario de Victor | **esta propuesta** |
| 46 | Adjuntar el expediente en PDF a la SP (§7) | listo para hacerse; independiente |
| 47 | Caja chica: `cc_vale` y `cc_liquidacion` enchufados a `envios` | necesita 45 |
| 48 | Caja chica multi-custodio (§10.2) | la más delicada |
| 49 | Administración de la caja chica de Victor | la pidió «después» |

### 10.4 · Lo que falta saber

Las dos que quedaban se contestaron el 5 nov 2026:

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿*Pagado* lo marca Victor o Angeles? | **Victor**, desde que recibe la SP (§4.1) |
| 2 | ¿Quién es la Asistente de Presidencia? | **Zonia Orellana**. No está en `empleados`; hay que darla de alta antes de la fase 48 |

### 10.5 · La regla que gobierna todo esto

> *«cada usuario es independiente… yo no tendría porque ver lo que él tenga en su
> usuario ni lo que hace… podremos enviarnos y recibir documentos o avisos, pero cada
> quien en su rol y perfil.»* — 5 nov 2026

Es la misma petición de [PLAN-ESPACIOS-SEPARADOS.md](PLAN-ESPACIOS-SEPARADOS.md), y lo
que ahí quedaba por decidir —si el admin ve los espacios ajenos— queda decidido: **no
los ve**. Ese documento recoge la actualización completa, incluidos los costos de esa
decisión.

Para la fase 45 la consecuencia práctica está en §5.2: Victor se construye aislado
desde el primer día, aunque los espacios todavía no existan. No es trabajo adelantado,
es no tener que deshacerlo después.

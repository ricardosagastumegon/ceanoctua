# E · Flujos de trabajo

Este documento contiene el **entregable 3: diagramas de los principales flujos**.

Para cada proceso: quién lo inicia, qué requiere, qué valida, qué genera, qué estados atraviesa, quién interviene, qué lo hace avanzar y cómo termina.

> Los diagramas están en Mermaid, que se renderiza en GitHub, en VS Code y en la mayoría de visores de Markdown. Quien lea en texto plano encontrará el flujo igualmente legible.

---

## Flujo 1 · Solicitud de pago hasta la firma

El proceso central del sistema.

```mermaid
flowchart TD
    A["ORIGEN<br/>consumo TC · gasto · aviso de combustible"] --> B

    B["SOLICITUD DE PAGO<br/>step_idx = 0 · Generado<br/>genera SP-AAAA-####"]
    B --> C{"¿Requiere firma?"}

    C -->|sí| D["EN SOLICITUD DE FIRMA<br/>step_idx = 1<br/>crea registro en firmas"]
    C -->|no| H

    D --> E["BANDEJA DE FIRMAS · CEA<br/>status_firma = en_espera<br/>destinatarios: firma_miembros"]

    E --> F{"Decisión<br/>de quien firma"}
    F -->|firmado| G["FIRMADO<br/>sella fecha_firma + firmada_por"]
    F -->|stand_by| E
    F -->|denegada| X["DENEGADA<br/>fin del proceso"]

    G --> H["step_idx 2 → 3 → 4<br/>Firmado · Presentado · Procesado<br/>avance manual, cada paso sella fecha"]

    H --> I["PAGADO<br/>step_idx = 5 · status = 'Pagado'"]
    I --> J["Habilita comprobante<br/>+ Formato Oficial FZ"]
    I --> K["Si tenía consumo_id:<br/>el consumo pasa a REINTEGRADO"]

    style B fill:#e8f4f4
    style G fill:#e8f4e8
    style I fill:#e8f4e8
    style X fill:#f4e8e8
```

| Aspecto | Detalle |
|---|---|
| **Quién inicia** | La asistente (rol `admin` o `asistente`) |
| **Qué requiere** | Proveedor, concepto, monto, moneda, tipo de pago, entidad, autorizador |
| **Validaciones** | Correlativo generado por el servidor · no se puede retroceder de paso · RLS exige rol operativo |
| **Documentos que genera** | Solicitud SP-AAAA-#### · registro de firma FR-AAAA-#### · Formato Oficial FZ (imprimible) |
| **Estados** | `step_idx` 0→5, con fecha sellada por paso |
| **Quién interviene** | Asistente (crea y avanza) · firmante con `puede('cea','editor')` |
| **Qué dispara el avance** | Acción manual en la interfaz. **No hay automatismo** entre la firma y el avance del paso |
| **Cómo termina** | Paso 5 con comprobante adjunto. No hay cierre contable posterior |

⚠️ **Punto de atención:** firmar el documento y avanzar la solicitud son dos acciones independientes. Que una firma esté en `firmado` no mueve `step_idx` por sí sola; alguien tiene que avanzarla a mano. Es un punto donde el proceso puede quedarse detenido sin que nada lo señale.

---

## Flujo 2 · Vale → liquidación → reintegro

```mermaid
flowchart TD
    A["VALE<br/>adelanto de efectivo<br/>genera VL-AAAA-####"] --> B

    B["El beneficiario gasta<br/>(fuera del sistema)"]
    B --> C["LIQUIDACIÓN<br/>rendición de gastos<br/>genera CC-AAAA-####"]

    C --> D["Se vinculan los vales<br/>vía liquidacion_vales"]
    D --> E["Se capturan los renglones<br/>caja_chica_liq_rows"]
    E --> F["CUADRE<br/>total_vales vs total_compras<br/>diff"]

    F --> G{"¿Cuál es<br/>la diferencia?"}
    G -->|gastó de más| H["Reintegrar al beneficiario"]
    G -->|gastó de menos| I["Devolver a la caja"]
    G -->|cuadra| J["Cerrada"]

    H --> K["FIRMA<br/>firmas.liquidacion_id"]
    I --> K
    K --> L["Solicitud de pago<br/>si procede desembolso"]

    style A fill:#e8f4f4
    style F fill:#f4f0e0
    style K fill:#e8f4e8
```

| Aspecto | Detalle |
|---|---|
| **Quién inicia** | La asistente |
| **Qué requiere** | Beneficiario (empleado o entidad), monto, concepto, periodo |
| **Validaciones** | Correlativo del servidor · al borrar la liquidación, el trigger desvincula los vales |
| **Documentos** | Vale VL- · liquidación CC- · comprobante adjunto · firma FR- |
| **Estados del vale** | 13 valores posibles, **sin máquina de estados declarada** |
| **Quién interviene** | Asistente · firmante |
| **Cómo termina** | Liquidación cuadrada y firmada |

⚠️ **Dos observaciones:**
1. Los trece estados del vale no tienen transiciones restringidas por la base. La columna `estado_previo` sugiere que se revierte de estado, pero no se encontró la regla que lo gobierna.
2. Los renglones (`caja_chica_liq_rows`) y la unión (`liquidacion_vales`) **no están auditados**. El cuadre se puede alterar sin dejar rastro.

---

## Flujo 3 · Consumo de tarjeta hasta su saldo

```mermaid
flowchart TD
    A["CONSUMO CON TARJETA<br/>corporativa o presidencia"] --> B
    B["Captura en tc_consumos<br/>fecha, tarjeta, proveedor,<br/>monto, voucher, autorización"]

    B --> C{"¿Cómo se salda?"}

    C -->|"camino actual"| D["SOLICITUD DE PAGO<br/>pagos.consumo_id"]
    C -->|"camino antiguo<br/>(sin uso hoy)"| E["REINTEGRO<br/>reintegros<br/>tabla vacía"]

    D --> F["Circuito de 6 pasos<br/>(Flujo 1)"]
    F --> G["step_idx = 5"]
    G --> H["El consumo se muestra<br/>REINTEGRADO<br/>nombrando la SP que lo saldó"]

    E --> I["generada → firmada →<br/>presentada → procesada →<br/>reintegrada"]

    style A fill:#e8f4f4
    style H fill:#e8f4e8
    style E fill:#f0f0f0
    style I fill:#f0f0f0
```

**Las dos generaciones del modelo conviven.** El camino de la derecha (reintegros) está implementado y vacío; el de la izquierda es el que se usa. La interfaz tuvo que corregirse para reconocer ambos: antes marcaba como «vencido» un consumo saldado por el camino nuevo, porque sólo miraba el antiguo.

---

## Flujo 4 · Firma de un documento

```mermaid
flowchart TD
    A{"ORIGEN<br/>del documento"}
    A -->|Finanzas| B1["Solicitud de pago<br/>firmas.pago_id"]
    A -->|Finanzas| B2["Liquidación<br/>firmas.liquidacion_id"]
    A -->|CEA| B3["Documento externo<br/>cargado a mano"]

    B1 --> C["REGISTRO DE FIRMA<br/>genera FR-AAAA-####<br/>recepción · tipo · urgencia<br/>justificación"]
    B2 --> C
    B3 --> C

    C --> D["DESTINATARIOS<br/>filas en firma_miembros<br/>→ miembros_board"]

    D --> E["BANDEJA<br/>status_firma = en_espera"]

    E --> F{"Quien firma<br/>decide"}
    F -->|firmar| G["firmado<br/>+ fecha_firma<br/>+ firmada_por"]
    F -->|esperar| H["stand_by"]
    F -->|rechazar| I["denegada"]

    H --> E

    G --> J["ENTREGA FÍSICA<br/>entregado · fecha_entrega<br/>quien_recibe"]
    J --> K["Nota de entrega<br/>cea_notas_entrega"]

    style C fill:#e8f4f4
    style G fill:#e8f4e8
    style I fill:#f4e8e8
```

| Aspecto | Detalle |
|---|---|
| **Quién inicia** | La asistente, o el proceso de Finanzas |
| **Qué requiere** | Tipo, urgencia (`urgente`/`importante`/`programado`), justificación, destinatarios |
| **Validaciones** | Correlativo del servidor · escribir exige `puede('cea','editor')` |
| **Estados** | `en_espera → firmado | stand_by | denegada` |
| **Quién interviene** | Quien crea el documento · quien firma · quien recibe el físico |
| **Qué dispara el siguiente paso** | Acción manual. **No hay notificación por correo** — ver abajo |
| **Cómo termina** | Firmado y entregado, con constancia de entrega |

⚠️ **Funcionalidad NO implementada, declarada como pendiente:** no existe notificación por correo ni al móvil cuando un documento entra a la bandeja de firma. El destinatario se entera entrando a la aplicación o porque alguien se lo dice. Está anotado en la lista de pendientes del proyecto, a la espera de un buzón corporativo.

⚠️ **Sin auditoría:** `firmas` y `firma_miembros` no tienen trigger. La firma deja constancia en la propia fila, pero esa fila es modificable sin registro.

---

## Flujo 5 · Planificación de un viaje

```mermaid
flowchart TD
    A["CREAR VIAJE<br/>título, destino, país,<br/>fechas, propósito"] --> B

    B["PARTICIPANTES<br/>desplegable: Personal JD + Invitados"]
    B --> B1["Trigger sincroniza<br/>att_viajes.acompanantes"]
    B --> B2["Determina quién verá<br/>el viaje en la interfaz"]

    B --> C["AÑADIR SERVICIOS<br/>16 tipos disponibles"]

    C --> D1["✈️ Boleto aéreo"]
    C --> D2["🏨 Hotel"]
    C --> D3["🚗 Renta · 🗺️ Tour<br/>🛳️ Crucero · etc."]

    D1 --> E["TRAER DEL CATÁLOGO<br/>· se elige el pasaporte (nacionalidad)<br/>· se elige la visa<br/>· afiliación según aerolínea"]
    E --> F["Los datos se COPIAN al boleto<br/>no se referencian"]

    D1 --> G["ADJUNTOS<br/>confirmación, pase de abordar<br/>→ bucket tt-documentos"]
    D2 --> G
    D3 --> G

    G --> H["ITINERARIO IMPRIMIBLE<br/>hojas del viaje + adjuntos<br/>unidos en un solo PDF"]

    style A fill:#e8f4f4
    style F fill:#f4f0e0
    style H fill:#e8f4e8
```

| Aspecto | Detalle |
|---|---|
| **Quién inicia** | La asistente |
| **Qué requiere** | Título, fechas, destino; el resto es incremental |
| **Validaciones** | Un participante es persona **o** invitado, nunca ambos (`CHECK`) |
| **Documentos** | Itinerario y hojas por servicio, con adjuntos incorporados al PDF |
| **Quién interviene** | Asistente (construye) · participantes (consultan) |
| **Cómo termina** | No tiene cierre formal. El viaje pasa a la carpeta de finalizados por fecha |

**Decisión de diseño que conviene entender:** al traer un pasaporte del catálogo, los datos **se copian** al boleto. Es deliberado: un boleto emitido es un documento histórico y debe seguir diciendo con qué pasaporte se voló aunque el catálogo cambie después.

---

## Flujo 6 · Combustible de aeronave hacia Finanzas

Es la única integración automatizada entre módulos.

```mermaid
flowchart TD
    A["ESTADO DE CUENTA<br/>del proveedor, en Excel"] --> B
    B["IMPORTACIÓN<br/>avn_fuel_movimientos"]
    B --> C["SALDO DISPONIBLE<br/>calculado: movimientos<br/>posteriores a historico_hasta"]

    C --> D["CONSUMO DE COMBUSTIBLE<br/>registrado contra el saldo"]
    D --> E["NOTIFICACIÓN DE PAGO<br/>pagos_notificaciones<br/>origen_tipo = 'combustible'"]

    E --> F["Política RLS dedicada:<br/>un editor de Aeronaves puede<br/>insertar sin permisos de Finanzas"]

    F --> G["BANDEJA DE FINANZAS"]
    G --> H["SOLICITUD DE PAGO<br/>pagos.origen_notificacion_id"]
    H --> I["Circuito de 6 pasos<br/>(Flujo 1)"]

    style C fill:#f4f0e0
    style F fill:#e8f4f4
    style I fill:#e8f4e8
```

**Verificación incorporada al proceso:** las migraciones que cargan estados de cuenta llevan su propia comprobación — si el saldo resultante no coincide con el declarado por el proveedor, la migración lanza una excepción y no guarda nada. Es una práctica que vale la pena señalar como acierto.

**Excepción documentada al borrado suave:** `pagos_notificaciones` sí se marcan como procesadas de forma definitiva, por ser una bandeja de avisos y no un registro contable.

---

## Flujo 7 · Alta de usuario y asignación de accesos

```mermaid
flowchart TD
    A["Crear cuenta en Supabase Auth<br/>correo + clave"] --> B
    B["Fila en usuarios<br/>rol, nombre, correo"]
    B --> C["Enlazar identidad"]

    C --> C1["persona_id → personas<br/>(de aquí salen sus pendientes)"]
    C --> C2["miembro_id → miembros_board<br/>(de aquí salen sus firmas)"]

    C --> D["ASIGNAR MÓDULOS<br/>Admin → Usuarios y accesos<br/>usuario_modulos"]
    D --> E["Por cada módulo:<br/>observador | editor | super"]

    E --> F["Al entrar:<br/>TabsNav dibuja pestañas<br/>Inicio decide destino"]
    F --> G["RLS decide qué datos salen"]

    style D fill:#e8f4f4
    style G fill:#f4f0e0
```

| Aspecto | Detalle |
|---|---|
| **Quién inicia** | Sólo el administrador |
| **Validaciones** | Un usuario **no puede cambiarse el rol a sí mismo** (política `usuarios_self_update`) |
| **Quién interviene** | Administrador |
| **Cómo termina** | El usuario entra y ve lo que su rol y sus módulos permiten |

⚠️ **Sin auditoría:** la tabla `usuarios` **no tiene trigger de auditoría**. Un cambio de rol no queda registrado en `audit_log`. `usuario_modulos` **sí** lo tiene.

Es una asimetría llamativa: se registra quién recibió permiso sobre un módulo, pero no quién fue promovido a administrador.

# B · Módulos

Ocho módulos visibles en la barra superior. Para cada uno: propósito, secciones, qué información recibe, qué genera y con qué se relaciona.

> **Nota de historia reciente.** Hasta el 4 de noviembre de 2026 había siete pestañas adicionales (MAA, JA, LA, JM, AA, EG, PE), una por miembro de la junta. Se retiraron porque las cinco tablas que resumían nunca se llenaron. Un revisor que vea capturas anteriores encontrará esas pestañas; ya no existen.

---

## Vista de conjunto

| Módulo | Ruta | Propósito en una línea | Gobernado por |
|---|---|---|---|
| Dashboard | `/` | Resumen de lo urgente y lo próximo | `dashboard` |
| Arriaza T&T | `/arriaza` | Viajes y todos sus servicios | `tt` |
| Aeronaves | `/aeronaves` | Flota, combustible, vuelos | `aeronaves` |
| CEA | `/cea` | Pendientes, firmas, entregas, directorio | `cea` |
| Finanzas | `/finanzas` | Consumos de tarjeta, pagos, reintegros | `finanzas` |
| Caja Chica | `/caja-chica` | Operación de periodos de caja chica | `caja_chica` |
| Admin | `/admin` | Catálogos maestros y accesos | rol `admin` |
| Miel SJ | `/miel-sj` | Constancias de donación de miel | `miel_sj` |

---

## 1 · Dashboard (`/`)

**Propósito:** responder «¿qué tengo encima hoy?» sin entrar a cada módulo.

**No tiene secciones.** Tiene tres presentaciones distintas según quién entra:

| Presentación | Para quién | Qué muestra |
|---|---|---|
| `FullView` | `admin`, `asistente` | Tablero de operación completo |
| `GerenteView` | el resto (p. ej. `solo_lectura`) | Vista de supervisión y firma |
| `DashboardPage` (desvíos) | sesión sin perfil | Pantallas de recuperación |

**Qué recibe:** `cea_todos` (pendientes), `att_viajes` (viajes), `firmas`, `pagos`, `reintegros`, `tc_consumos`, `caja_chica_vales`, `caja_chica_liquidaciones`.

**Qué genera:** nada. Es estrictamente de lectura y enlaza a los módulos de origen.

**Relaciones:** consume de seis módulos; no escribe en ninguno. Es el punto de convergencia del sistema.

> La vista de supervisión (`GerenteView`) prioriza al revés que la de operación: primero lo que espera la firma de quien entra, después los viajes próximos. Es una decisión de producto deliberada, no una vista reducida de la otra.

---

## 2 · Arriaza T&T (`/arriaza`)

**Propósito:** planificar y documentar viajes completos. Es el módulo más grande del sistema (164 archivos, 46 tablas).

**Estructura:** una lista de viajes, y cada viaje abre su propia pantalla (`/arriaza/viaje/:id`) con un panel de servicios.

**Los 16 tipos de servicio que puede contener un viaje:**

| | | |
|---|---|---|
| ✈️ Ticket aéreo | 🏨 Hotel | 🍽️ Restaurante |
| 🚗 Renta de vehículo | 🗺️ Tour | 🛩️ Renta de aeronave |
| 🚤 Traslado acuático | ⛴️ Ferry | 🚐 Traslado terrestre |
| 🎭 Actividad / evento | 🛳️ Crucero | 🧾 Consumos varios |
| 🛍️ Tienda | 🤝 Reunión | 📍 Ruta (Google Maps) |
| ⭐ Punto de interés | | |

Además: países y ciudades del viaje, paradas, plan por día (`att_day_plans`), notas por día y participantes.

**Qué recibe:**
- Del catálogo de Admin: personas (Personal JD), invitados, y sus documentos de viaje (pasaportes, visas, licencias, afiliaciones).
- Archivos cargados: confirmaciones, pases de abordar, comprobantes → bucket `tt-documentos`.
- Captura manual: itinerarios, PNR, segmentos de vuelo, habitaciones, comensales.

**Qué genera:**
- Itinerarios y hojas imprimibles por servicio, con los adjuntos incorporados al PDF.
- `att_viaje_participantes`, que determina quién ve el viaje.
- Registros de pago por servicio (`att_*_pay_records`).

**Relaciones:**
- **← Admin:** los pasajeros de un boleto se traen del catálogo de documentos de viaje. Es la integración más reciente y evita que la misma persona quede capturada con grafías distintas.
- **← Aeronaves:** un viaje puede incluir renta de aeronave.
- **→ Dashboard:** los viajes próximos.
- **Regla de visibilidad:** un usuario que no sea admin/asistente ve un viaje **sólo si está registrado como participante**. Detalle en [03](03-ROLES-Y-PERMISOS.md).

**Derivado automático:** `att_viajes.acompanantes` (texto) se mantiene sincronizado por trigger desde `att_viaje_participantes`, y se actualiza también cuando se renombra una persona o un invitado.

---

## 3 · Aeronaves (`/aeronaves`)

**Propósito:** control de la flota propia.

**Estructura:** lista de flota, y cada aeronave abre `/aeronaves/:matricula` (la matrícula va en la dirección porque es única y legible).

**Secciones por aeronave:** `resumen` · `vuelos` · `combustible` · `cuenta`

**Qué recibe:**
- Estados de cuenta de combustible del proveedor, importados desde Excel.
- Documentos de la aeronave (certificados, seguros) → bucket `avn-documentos`.
- Pilotos y tipos de certificado.

**Qué genera:**
- Saldo disponible de combustible, calculado como movimientos acumulados contra un corte declarado (`historico_hasta`).
- Notificaciones de pago hacia Finanzas (`pagos_notificaciones` con `origen_tipo = 'combustible'`).

**Relaciones:**
- **→ Finanzas:** única vía automatizada entre módulos. Existe una política de inserción específica (`pagos_notif_combustible_insert`) que permite a un editor de Aeronaves crear una notificación de pago sin tener permisos de Finanzas.
- **← Arriaza T&T:** renta de aeronave como servicio de un viaje.

**Funcionalidad explícitamente pausada:** mantenimientos y bitácora de vuelo. El código y las tablas existen parcialmente; la captura está detenida porque la información proviene de terceros. **No debe evaluarse como incompleta sin ese contexto.**

---

## 4 · CEA (`/cea`)

**Propósito:** la operación de escritorio de la asistente.

**Secciones:**

| Sección | Qué es | Visible para |
|---|---|---|
| **TO DO** | Lista maestra de pendientes | Todos los que tengan el módulo |
| Firmas | Documentos que esperan firma | Sólo «escritorio» |
| Notas de entrega | Constancias de entrega de documentos físicos | Sólo «escritorio» |
| Lavandería | Control de prendas | Sólo «escritorio» |
| Directorio | Contactos | Sólo «escritorio» |

La marca «escritorio» restringe esas cuatro secciones a quien opera el sistema; un supervisor sólo ve TO DO.

**Qué recibe:** captura manual de pendientes; documentos para firma que pueden originarse en Finanzas.

**Qué genera:**
- `firmas` con correlativo `FR-AAAA-####`, con destinatarios en `firma_miembros`.
- `cea_notas_entrega` con correlativo propio.
- Vistas imprimibles del TO DO y de las notas de entrega.

**Relaciones:**
- **← Finanzas:** una solicitud de pago o una liquidación puede generar una firma (`firmas.pago_id`, `firmas.liquidacion_id`, `firmas.origen`).
- **→ Dashboard:** firmas pendientes y pendientes urgentes.

---

## 5 · Finanzas (`/finanzas`)

Documentado en detalle en [06](06-FINANZAS.md). Resumen:

**Secciones:**

| Sección | Marca «interna» | Contenido |
|---|---|---|
| Vales | sí | Vales de caja chica |
| Liquidaciones | sí | Liquidación de vales |
| Reintegros | sí | Reintegros de consumos |
| Consumos TC Corp | no | Consumos de tarjetas corporativas |
| Consumos TC Pres | sí | Consumos de tarjetas de presidencia |
| Pagos | no | Solicitudes de pago |

«Interna» significa que sólo la ve quien opera (admin/asistente). Un supervisor ve **Consumos TC Corp** y **Pagos**, más Liquidaciones cuando llega a una concreta desde un enlace de firma.

**Relaciones:** es el módulo más conectado. Recibe de Aeronaves y de los catálogos de Admin; emite hacia CEA (firmas) y hacia el Dashboard.

---

## 6 · Caja Chica (`/caja-chica`)

**Propósito:** la operación por periodos de la caja chica — distinta de las secciones de vales y liquidaciones que viven dentro de Finanzas.

**Entidades:** `caja_chica_op_periodos` (con correlativo por trigger), `caja_chica_op_lineas`, `caja_chica_op_vale_facturas`.

**Relación con Finanzas:** las secciones «Vales» y «Liquidaciones» de Finanzas leen `caja_chica_vales` y `caja_chica_liquidaciones`, que son tablas distintas de las de periodos. **Son dos vistas sobre el mismo dominio con tablas separadas.** Es el punto del modelo donde la frontera entre módulos es menos nítida.

⚠️ **No verificado:** el grado de uso real de la operación por periodos. Las tablas de periodos tienen muy pocos registros frente a las de vales y liquidaciones, lo que sugiere que el flujo principal es el de Finanzas, pero no se confirmó con la usuaria.

---

## 7 · Admin (`/admin`)

**Propósito:** los catálogos maestros de los que beben todos los demás módulos, y la gestión de accesos.

**Acceso:** sólo rol `admin`. Es la única pestaña que no se abre por permiso de módulo.

**Secciones (12):**

| Sección | Alimenta a |
|---|---|
| Entidades | Finanzas, Caja Chica |
| **Personal JD** (`personas`) | Finanzas (autorizadores y firmantes), Arriaza T&T |
| Empleados | Finanzas, CEA |
| Invitados | Arriaza T&T |
| **Documentos de viaje** | Arriaza T&T (pasaportes, visas, licencias, afiliaciones) |
| Tipos de pago | Finanzas |
| Proveedores | Finanzas, Arriaza T&T |
| Tarjetas de crédito | Finanzas |
| Vehículos | — |
| Status Solicitud de Pago | Finanzas |
| Certificados aéreos | Aeronaves |
| **Usuarios y accesos** | Todo el sistema |

**Regla de negocio declarada:** `personas` (Personal JD) es la **única** fuente de autorizadores y firmantes. Existió una tabla `autorizadores` que quedó obsoleta tras consolidar en `personas`.

**Qué genera:** nada propio. Es origen de datos, no de procesos.

---

## 8 · Miel SJ (`/miel-sj`)

**Propósito:** emitir constancias de donación de miel.

**Entidad:** `miel_constancias` (sin registros al momento del levantamiento).

**Qué genera:** una constancia imprimible.

Es el módulo más pequeño y el menos conectado: no recibe de ningún otro módulo ni alimenta a ninguno.

---

# F · Interconexión entre módulos

## El mapa de dependencias reales

```
                    ┌─────────────────┐
                    │     ADMIN       │  (catálogos maestros)
                    │  personas       │
                    │  empleados      │
                    │  entidades      │
                    │  proveedores    │
                    │  tarjetas       │
                    │  invitados      │
                    │  docs de viaje  │
                    └────┬───────┬────┘
            ┌────────────┘       └────────────┐
            ▼                                 ▼
    ┌───────────────┐                 ┌───────────────┐
    │  ARRIAZA T&T  │                 │   FINANZAS    │
    │               │                 │               │
    │ viajes        │                 │ vales         │
    │ 16 servicios  │                 │ liquidaciones │
    │ participantes │                 │ reintegros    │
    └───────┬───────┘                 │ consumos TC   │
            │                         │ pagos (SP)    │
            │                         └───┬───────┬───┘
            │                             │       │
            │         ┌───────────────────┘       │
            │         ▼                           │
            │  ┌─────────────┐                    │
            │  │     CEA     │                    │
            │  │   firmas    │◄───────────────────┘
            │  │   TO DO     │   pago_id / liquidacion_id
            │  └──────┬──────┘
            │         │
            │         │        ┌──────────────┐
            │         │        │  AERONAVES   │
            │         │        │  combustible │
            │         │        └──────┬───────┘
            │         │               │ pagos_notificaciones
            │         │               │ (origen_tipo =
            │         │               │  'combustible')
            │         │               ▼
            │         │        ┌──────────────┐
            │         │        │   FINANZAS   │
            │         │        └──────────────┘
            ▼         ▼
       ┌──────────────────┐
       │    DASHBOARD     │  (sólo lee)
       └──────────────────┘
```

## Los seis puntos de integración, uno por uno

### 1 · Admin → todos · catálogos compartidos

El patrón dominante. Los módulos no duplican personas, proveedores ni entidades: guardan una referencia (`persona_id`, `proveedor_id`, `entidad_id`) al catálogo.

**Dónde no se cumple:** varias tablas conservan columnas de texto libre junto a la referencia — `pagos.proveedor` y `pagos.proveedor_id`, `tc_consumos.card_id` (texto) junto a `tarjeta_id`. Es herencia de la migración desde el sistema anterior. El texto libre es el que se muestra en registros antiguos; los nuevos usan la referencia.

### 2 · Finanzas → CEA · el circuito de firma

Una solicitud de pago o una liquidación genera un registro en `firmas`, enlazado por `firmas.pago_id` o `firmas.liquidacion_id`, con `firmas.origen` indicando de dónde viene. El documento aparece entonces en la bandeja de firmas de CEA, dirigido a los miembros listados en `firma_miembros`.

**Vuelta:** desde la bandeja de firmas, un botón «Ver detalles» lleva a Finanzas resaltando la solicitud concreta (parámetros en la dirección). Es la única navegación cruzada entre módulos con contexto.

### 3 · Aeronaves → Finanzas · notificación de combustible

La única integración con una política RLS dedicada. Un editor de Aeronaves puede insertar en `pagos_notificaciones` con `origen_tipo = 'combustible'` sin tener permisos de Finanzas. El pago resultante conserva `pagos.origen_notificacion_id`.

### 4 · Admin → Arriaza T&T · documentos de los viajeros

Los pasaportes, visas, licencias y afiliaciones se capturan una vez en Admin y se traen al boleto desde un desplegable. La elección de **qué pasaporte** (por nacionalidad) y **qué visa** la hace quien emite el boleto, no el sistema: depende de la ruta y el destino.

**Decisión de diseño relevante:** lo traído se copia al boleto, no se referencia. Un boleto emitido es un documento histórico; si mañana cambia el pasaporte, el boleto viejo debe seguir diciendo con cuál se voló.

### 5 · Finanzas interno · consumo → reintegro → pago

Dentro del propio módulo hay tres caminos que convergen. Se detalla en [06](06-FINANZAS.md).

### 6 · Todos → Dashboard · convergencia de lectura

El Dashboard lee de seis módulos y no escribe en ninguno. Es el único punto donde la información de todo el sistema se presenta junta.

---

## Qué procesos generan información que otros consumen

| Proceso origen | Genera | Lo consume |
|---|---|---|
| Captura de consumo de TC | `tc_consumos` | Reintegros, Pagos, Dashboard |
| Solicitud de pago completada | `pagos` con `step_idx` | Firmas (CEA), Consumos (marca «reintegrado»), Dashboard |
| Firma de documento | `firmas.status_firma` | Dashboard, avance de la solicitud de pago |
| Alta de persona en Admin | `personas` | Finanzas (autorizador/firmante), T&T (participante) |
| Alta de participante en viaje | `att_viaje_participantes` | Visibilidad del viaje; texto derivado de acompañantes |
| Importación de estado de cuenta | `avn_fuel_movimientos` | Saldo disponible de combustible |
| Vale liquidado | `liquidacion_vales` | Liquidación, Dashboard |

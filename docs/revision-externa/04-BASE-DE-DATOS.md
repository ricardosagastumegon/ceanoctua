# D · Base de datos

Este documento contiene el **entregable 5: descripción de las relaciones principales**.

---

## 1 · Estructura general

| Métrica | Valor |
|---|---|
| Motor | Postgres 15 (Supabase) |
| Tablas en el esquema `public` | 104 |
| Tablas con RLS habilitado | 104 (100 %) |
| Tablas sin ninguna política | 0 |
| Tablas con trigger de auditoría | 70 (67 %) |
| Migraciones versionadas | 88 archivos, ~9,100 líneas |
| Tipos enumerados | 15 |
| Buckets de almacenamiento | 3, todos privados |

---

## 2 · Convenciones del esquema

Aplicadas de forma consistente en las tablas de negocio:

| Convención | Forma |
|---|---|
| Clave primaria | `id uuid DEFAULT gen_random_uuid()` |
| Correlativo de negocio | Columna `serial`, generada por `DEFAULT` con secuencia |
| Marcas de tiempo | `created_at`, `updated_at` (por trigger), `deleted_at` |
| Autoría | `created_by`, `updated_by` (uuid del usuario) |
| Borrado | **Suave**, vía `deleted_at`. No hay borrado físico en tablas de negocio |
| Herencia del sistema anterior | `legacy_id` en las tablas migradas |

### Correlativos de negocio

Se generan en el servidor mediante `DEFAULT` con secuencia — no por trigger, pero con la misma garantía de unicidad y sin participación del cliente:

| Prefijo | Entidad | Formato |
|---|---|---|
| `SP-` | Solicitudes de pago | `SP-2026-0001` |
| `FR-` | Firmas | `FR-2026-0001` |
| `VL-` | Vales de caja chica | `VL-2026-0001` |
| `CC-` | Liquidaciones | `CC-2026-0001` |

Cuatro tablas más (`avn_vuelos`, `avn_combustible_registros`, `caja_chica_op_periodos`, `cea_notas_entrega`) usan trigger en lugar de `DEFAULT`.

---

## 3 · Las entidades principales

El esquema se organiza en seis familias.

### 3.1 · Identidad y acceso (4 tablas)

```
usuarios ──┬── persona_id  ──► personas        (qué persona de la junta es)
           ├── miembro_id  ──► miembros_board  (qué miembro de junta es)
           └──◄ usuario_modulos                (qué módulos y en qué nivel)

audit_log  (independiente; registra todo lo demás)
```

**`usuarios` no almacena contraseñas.** La autenticación vive en el esquema `auth` de Supabase. `usuarios` guarda rol, nombre, correo, ruta de la firma gráfica, y los dos enlaces de identidad.

**La distinción entre `persona_id` y `miembro_id` es importante:** una cuenta de acceso, una persona de la junta y un miembro del board son tres cosas. El trabajo se asigna a la *persona*; las firmas se dirigen al *miembro*; la sesión pertenece al *usuario*.

### 3.2 · Catálogos maestros (8 tablas)

Son el origen de datos del sistema. Ninguno depende de otro.

| Tabla | Veces referenciada | Papel |
|---|---:|---|
| `personas` | **13** | Personal JD: autorizadores, firmantes, viajeros, responsables |
| `tarjetas_credito` | **15** | Medio de pago de servicios y consumos |
| `entidades` | 7 | Empresas que pagan o reciben |
| `empleados` | 5 | Personal operativo |
| `invitados` | 5 | Viajeros que no son Personal JD |
| `proveedores` | 3 | Quien cobra |
| `tipos_pago`, `status_solicitud_pago`, `vehiculos` | — | Listas de valores |

**`personas` y `tarjetas_credito` son las dos entidades más conectadas del sistema.** Cualquier cambio en ellas repercute en los dos módulos grandes.

### 3.3 · Viajes (46 tablas)

```
att_viajes  ◄── 24 referencias
   │
   ├──◄ att_viaje_participantes ──► personas | invitados   (uno u otro, nunca ambos)
   ├──◄ att_viaje_paises, att_viaje_ciudades, att_viaje_paradas
   ├──◄ att_day_plans ──◄ att_day_plan_rows
   │                 ──◄ att_day_notes
   │
   └──◄ los 16 tipos de servicio, cada uno con su tabla:
         att_tickets ──◄ att_ticket_pax
                     ──◄ att_ticket_pnrs
                     ──◄ att_ticket_segments ──◄ att_segmento_escalas
                     ──◄ att_ticket_pay_records
         att_hoteles ──◄ att_hotel_habitaciones, att_hotel_services, att_hotel_pay_records
         att_restaurantes ──◄ att_restaurant_diners, att_restaurant_services, att_restaurant_pay_records
         att_cruceros ──◄ att_crucero_pax, att_crucero_camarotes, att_crucero_pagos
         att_rentas, att_tours, att_actividades, att_acuaticos, att_ferries,
         att_terrestres, att_tiendas, att_reuniones, att_aeronaves,
         att_consumos_varios, att_rutas, att_pois
```

**Patrón repetido:** cada servicio tiene su tabla principal, sus tablas hijas de detalle, y una tabla `*_pay_records` para los pagos asociados. Es verboso pero uniforme — conocer un servicio es conocer los dieciséis.

**Documentos del viajero** (fuera del viaje, en el catálogo):

```
personas | invitados ──◄ viajero_pasaportes   (varios por persona, uno por nacionalidad)
                     ──◄ viajero_visas
                     ──◄ viajero_licencias
                     ──◄ viajero_afiliaciones (programas de viajero frecuente)
```

Las cuatro usan la misma restricción: `CHECK (num_nonnulls(persona_id, invitado_id) = 1)` — cuelgan de una persona **o** de un invitado, nunca de ambos ni de ninguno.

### 3.4 · Finanzas (12 tablas)

```
tc_consumos  ◄── 4 referencias
   │  (consumo de tarjeta corporativa o de presidencia)
   ├──◄ consumo_renglones   (desglose)
   ├──◄ vouchers
   ├──◄ reintegros
   └──◄ pagos.consumo_id

pagos (solicitud de pago)
   ├──► proveedores, entidades, personas (autorizador), status_solicitud_pago
   ├──► tc_consumos        (si el pago reintegra un consumo)
   ├──► pagos_notificaciones (si nació de una notificación, p. ej. combustible)
   └──◄ firmas.pago_id

caja_chica_vales ──◄ liquidacion_vales ──► caja_chica_liquidaciones
caja_chica_liquidaciones ──◄ caja_chica_liq_rows
                         ──◄ firmas.liquidacion_id
```

**`liquidacion_vales` es una tabla de unión:** un vale puede entrar en una liquidación, y una liquidación agrupa varios vales. Hay un trigger (`unlink_vales_on_liq_delete`) que desvincula los vales si se borra la liquidación — evita vales huérfanos apuntando a algo que ya no existe.

### 3.5 · Aeronaves (12 tablas)

```
avn_aeronaves ──◄ avn_documentos       (certificados, seguros)
              ──◄ avn_vuelos ──◄ avn_vuelo_tramos
              │              ──◄ avn_vuelo_pax
              ──◄ avn_fuel_cuentas ──◄ avn_fuel_movimientos  (377 filas)
              ──◄ avn_combustible_registros ──◄ avn_combustible_lineas

avn_pilotos, avn_tipos_certificado   (catálogos del módulo)
```

El saldo de combustible no se almacena: se **calcula** como la suma de movimientos posteriores a un corte declarado (`historico_hasta`). Es la decisión de modelo más interesante del módulo — evita el problema clásico del saldo denormalizado que se desincroniza.

### 3.6 · CEA y otros (10 tablas)

```
firmas ──► usuarios (firmada_por), pagos, caja_chica_liquidaciones
       ──◄ firma_miembros ──► miembros_board   (a quién va dirigida)

cea_todos ──► personas (persona_id), empleados
cea_notas_entrega, directorio, lavanderia, documentos, miel_constancias
```

---

## 4 · Cómo se evita la duplicación

**El mecanismo principal:** referencias por `uuid` a los catálogos, en lugar de copiar texto.

**Las tres excepciones, todas deliberadas:**

### 4.1 · Columnas duplicadas por herencia de la migración

Varias tablas conservan a la vez el texto antiguo y la referencia nueva:

| Tabla | Texto libre | Referencia |
|---|---|---|
| `pagos` | `proveedor`, `entidad` | `proveedor_id`, `entidad_id` |
| `tc_consumos` | `card_id`, `proveedor` | `tarjeta_id`, `proveedor_id` |
| `caja_chica_vales` | `entidad`, `vale_a` | `entidad_id`, `vale_a_empleado_id` |

Los registros importados del sistema anterior sólo tienen el texto; los nuevos usan la referencia. **Deuda técnica reconocida** — figura en la lista de pendientes del proyecto.

### 4.2 · Datos copiados a propósito en los boletos

Cuando se trae un pasaporte del catálogo a un boleto, los datos **se copian**, no se referencian. Es deliberado y está documentado en el código: un boleto emitido es un documento histórico. Si mañana cambia el pasaporte, el boleto viejo debe seguir diciendo con cuál se voló.

**Es la distinción correcta entre un dato maestro y un dato de transacción**, y está bien aplicada.

### 4.3 · Texto derivado mantenido por trigger

`att_viajes.acompanantes` es un texto legible que se regenera automáticamente desde `att_viaje_participantes` mediante tres triggers (al cambiar participantes, al renombrar una persona, al renombrar un invitado). Es denormalización controlada: el texto nunca se edita a mano.

---

## 5 · Dependencias entre registros · qué pasa al borrar

**No hay borrado físico en tablas de negocio.** Se marca `deleted_at` y las consultas filtran por `IS NULL`.

Las claves foráneas que sí definen cascada:

| Relación | Al borrar el padre |
|---|---|
| `viajero_*` → `personas` / `invitados` | `ON DELETE CASCADE` |
| `caja_chica_liquidaciones` → vales | Trigger que desvincula, no borra |
| El resto | Restricción por omisión: impide el borrado |

**Excepción declarada al borrado suave:** `pagos_notificaciones` sí se marcan como procesadas de forma definitiva, por ser una bandeja de avisos y no un registro contable.

---

## 6 · Identificadores compartidos · el grafo central

```
                      personas  (13 referencias)
                          ▲
       ┌──────────────────┼──────────────────┬──────────────┐
       │                  │                  │              │
  usuarios          att_viaje_        viajero_*         pagos
  .persona_id       participantes     (4 tablas)        .autorizador_id
       │                  │                             tc_consumos
       │                  │                             .solicitado_por_id
       │                  │                             reintegros
       │                  │                             caja_chica_liq.
       │                  ▼
       │            att_viajes  (24 referencias)
       │                  ▲
       │                  └── los 16 servicios
       ▼
  miembros_board  (9 referencias)
       ▲
       └── firma_miembros ──► firmas ──► pagos / liquidaciones
```

**`personas` es el eje del sistema.** Conecta identidad, viajes, finanzas y documentos. Es la tabla que un revisor debe entender primero.

**`tarjetas_credito`** es el segundo eje, con 15 referencias, casi todas desde los servicios de viaje: cada servicio registra con qué tarjeta se pagó.

---

## 7 · Nota sobre tablas vacías

Diez tablas están vacías y sin uso en el código, restos del módulo de tableros por miembro retirado el 4 de noviembre de 2026:

`tareas` · `viajes` · `viaje_checklist` · `perfiles` · `perfil_vehiculos` · `perfil_fechas` · `perfil_familia` · `notas` · `eventos` · `kit_items`

Se conservan deliberadamente: un `DROP TABLE` no se deshace y el código se retiró el mismo día. Están anotadas para revisión en diciembre de 2026.

**Atención a un homónimo que confunde:** la tabla `viajes` (vacía, obsoleta) **no** es la tabla de viajes del sistema. Los viajes reales están en `att_viajes`. Lo mismo con `tareas` (vacía) frente a `cea_todos` (en uso).

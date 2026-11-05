# H · Documentos y firmas

---

## 1 · Documentos que genera el sistema

CEA produce **28 tipos de documento imprimible**. Todos son componentes React que se envían a `window.print`; no hay servicio de generación en servidor.

### Finanzas (6)

| Documento | Qué es |
|---|---|
| **Solicitud de Pago (Formato Oficial FZ)** | El formato oficial de la solicitud. Disponible en las solicitudes que completaron el circuito |
| Pago | Ficha de la solicitud con su línea de tiempo de seis pasos |
| Vale | Comprobante del adelanto de efectivo |
| Liquidación | Rendición con sus renglones y el cuadre |
| Consumo | Ficha de un consumo de tarjeta |
| Estado de cuenta | Consolidado de consumos |
| Voucher | Comprobante de consumo |

### CEA (4)

Firma · Nota de entrega · TO DO · Directorio

### Viajes (13)

Una hoja imprimible por cada tipo de servicio: ticket aéreo, hotel, restaurante, renta de vehículo, tour, renta de aeronave, traslado acuático, ferry, traslado terrestre, actividad, crucero, consumos varios, reunión. Más el itinerario del viaje, que agrupa las hojas.

### Aeronaves (2)

Registro de combustible · Vuelo

### Miel SJ (1)

Constancia de donación

---

## 2 · Documentos que se cargan externamente

Tres buckets privados en Supabase Storage.

| Bucket | Qué guarda | Quién lo LEE | Quién lo ESCRIBE |
|---|---|---|---|
| `tt-documentos` | Pasaportes, visas, licencias, pases de abordar, confirmaciones, comprobantes de servicios de viaje | ⚠️ **cualquier usuario autenticado** | `admin` o `asistente` |
| `documentos` | Comprobantes de pago, adjuntos generales | ⚠️ **cualquier usuario autenticado** | `admin`, `asistente`, `board_member` |
| `avn-documentos` | Certificados y seguros de aeronaves | `puede('aeronaves','observador')` | `puede('aeronaves','editor')` |

**El contraste es la observación importante.** `avn-documentos` está correctamente acotado por módulo. Los otros dos usan `auth.uid() IS NOT NULL`: cualquier sesión válida puede leer cualquier archivo, tenga o no el módulo correspondiente.

Esto afecta a los documentos más sensibles del sistema — escaneos de pasaportes y visas viven en `tt-documentos`. El patrón correcto ya existe en el código; no se aplicó a estos dos buckets.

**Lo que sí está bien:** los tres buckets son **privados**. El acceso se hace con URLs firmadas de vigencia limitada (600 segundos), no con enlaces públicos permanentes.

---

## 3 · Composición de PDF con adjuntos

Hasta hace poco los adjuntos se podían cargar pero no aparecían al imprimir: eran de sólo escritura. Se resolvió con `lib/pdf-hojas.ts`:

```
Hojas del documento (DOM)  ──html2canvas──►  imágenes
                                                 │
Archivos de Storage  ──URL firmada──► PDF/imagen │
                                                 ▼
                                          pdf-lib: unir
                                                 │
                                                 ▼
                                    Un solo PDF descargable
```

Ambas librerías se cargan de forma diferida, para no cargarlas en quien nunca imprime.

---

## 4 · Reglas de asignación de destinatarios

```
firmas  ──◄ firma_miembros ──► miembros_board
```

Un documento de firma se dirige a **miembros de la junta**, no a usuarios. La relación es de muchos a muchos: un documento puede requerir varias firmas.

**La cadena completa para que alguien vea un documento en su bandeja:**

```
usuarios.miembro_id ──► miembros_board.id ──► firma_miembros.miembro_id ──► firmas
```

**Consecuencia a tener presente:** si un usuario no tiene `miembro_id` asignado, no verá ningún documento en su bandeja de firmas, aunque tenga permisos de edición en CEA. Hoy **ningún usuario tiene `miembro_id` asignado** (la columna está vacía en las dos cuentas activas), lo que significa que la bandeja personal de firmas no está en uso real; se trabaja sobre la lista completa.

---

## 5 · Estados y seguimiento

### Estados de la firma (`firma_status`)

```
          ┌──────────────┐
          │  en_espera   │ ◄──────┐
          └──────┬───────┘        │
                 │                │
      ┌──────────┼──────────┐     │
      ▼          ▼          ▼     │
 ┌─────────┐ ┌────────┐ ┌──────────┐
 │ firmado │ │stand_by│ │ denegada │
 └─────────┘ └────┬───┘ └──────────┘
                  └──────────┘
```

`stand_by` es un estado de espera del que se puede volver. `denegada` y `firmado` son terminales.

### Urgencia (`firma_urgencia`)

`urgente` · `importante` · `programado` — clasificación de prioridad, no de estado.

### Seguimiento del documento físico

Además del estado de firma, el registro sigue el recorrido del papel:

| Campo | Significado |
|---|---|
| `recepcion` | Cuándo llegó el documento |
| `solicitado` | Cuándo se pidió la firma |
| `fecha_firma` | Cuándo se firmó |
| `firmada_por` | Quién firmó (uuid de usuario) |
| `entregado` / `fecha_entrega` | Cuándo salió firmado |
| `quien_recibe` | Quién lo recibió |

**Es un sistema de doble seguimiento:** el estado digital y el recorrido físico del papel. Las notas de entrega (`cea_notas_entrega`, con correlativo propio) documentan formalmente la entrega.

---

## 6 · El acto de firmar

```js
// firmasApi.firmar(id)
status_firma: 'firmado'
fecha_firma:  hoy
firmada_por:  uuid del usuario de la sesión
```

**Lo que está bien:** es un botón dedicado, no una casilla dentro del formulario de edición. El comentario del código explica por qué: *«sin eso, "firmado" es una casilla que alguien marcó y no se sabe quién»*. La identidad se toma de la sesión, no de un campo editable.

**Lo que falta:**

- ✅ **Queda registro en `audit_log`** desde la fase 44 (5 nov 2026). Antes no: `firmas` carecía de trigger.
- ❌ **No hay firma criptográfica.** «Firmado» es un estado en una fila, no un documento firmado digitalmente en sentido legal. La columna `usuarios.firma_path` sugiere una firma gráfica (imagen), no criptográfica.
- ❌ **La fila es modificable.** Cualquier editor de CEA puede cambiar `status_firma`, `fecha_firma` o `firmada_por` de un documento ya firmado, sin que quede rastro.

**Para la revisión:** si el valor probatorio de la firma es un requisito del negocio, este es el punto más débil del sistema. Si la firma es sólo un control interno de flujo —que es como está construida— entonces el diseño es adecuado y lo único que falta es la auditoría.

---

## 7 · Relación con otros módulos

```
FINANZAS                          CEA                        
┌──────────────┐                  ┌─────────────┐           
│ pagos        │─ pago_id ───────►│   firmas    │           
│ liquidaciones│─ liquidacion_id ►│             │           
└──────────────┘                  └──────┬──────┘           
       ▲                                 │                   
       │                                 ├──► firma_miembros 
       │  "Ver detalles"                 │    (destinatarios)
       └─────────────────────────────────┤                   
          vuelve a Finanzas              │                   
          resaltando la solicitud        ├──► cea_notas_entrega
                                         │    (entrega física)
                                         │                   
                                         └──► DASHBOARD      
                                              (pendientes)   
```

`firmas.origen` indica de dónde viene el documento, lo que permite distinguir un documento generado por el sistema de uno cargado a mano.

**La navegación de vuelta** («Ver detalles» junto al botón de firmar) lleva a Finanzas resaltando la solicitud concreta mediante parámetros en la dirección. Es la única navegación entre módulos que conserva el contexto, y existe porque quien firma necesita ver el expediente completo antes de decidir.

---

## 8 · Funcionalidad no implementada

Se señala expresamente para no evaluarla como defecto ni como existente:

| Funcionalidad | Estado |
|---|---|
| Notificación por correo al entrar un documento a la bandeja | **No implementada.** Pendiente de buzón corporativo |
| Notificación al móvil | **No implementada** |
| Firma criptográfica / certificado digital | **No implementada.** No está en el alcance del sistema |
| Carga de factura asociada a la solicitud de pago | **No implementada.** Prevista: el botón de documentos la mostraría cuando exista |
| Versionado de documentos cargados | **No implementada.** Una nueva carga reemplaza la anterior (`upsert: true`) |

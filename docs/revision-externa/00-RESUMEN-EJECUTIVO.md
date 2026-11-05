# CEA NOCTUA · Documentación para revisión externa

**Fecha del levantamiento:** 4 de noviembre de 2026
**Estado del sistema:** fase 42
**Método:** lectura del código fuente e introspección de sólo lectura contra la base de datos de producción. **No se modificó nada**: ni código, ni permisos, ni datos, ni migraciones.

---

## Qué es CEA NOCTUA

Un **asistente de junta directiva**: una aplicación web que coordina la operación diaria de una junta — pendientes, finanzas (caja chica, pagos, consumos de tarjetas corporativas), viajes, aeronaves, firmas de documentos y catálogos maestros.

**Lo que no es, y conviene tener claro antes de evaluarlo:** no es un sistema contable ni bancario. No ejecuta transacciones reales, no se conecta a bancos, no mueve dinero. Registra, coordina y deja constancia de decisiones que se ejecutan fuera del sistema. Un «pago» aquí es una *solicitud de pago* que recorre un circuito de autorización y termina marcada como pagada; el desembolso lo hace una persona en un banco.

**Escala real:** 2 usuarios activos, 104 tablas, 88 migraciones, ~4,300 registros de auditoría. Es un sistema pequeño en usuarios y grande en superficie funcional.

---

## Índice de documentos

| # | Documento | Contenido |
|---|---|---|
| 01 | [Arquitectura](01-ARQUITECTURA.md) | Stack, estructura, patrones, cómo se relacionan las partes |
| 02 | [Módulos](02-MODULOS.md) | Los 8 módulos: propósito, secciones, entradas, salidas, relaciones |
| 03 | [Roles y permisos](03-ROLES-Y-PERMISOS.md) | Los dos sistemas de permisos, matriz completa, reglas de visibilidad |
| 04 | [Base de datos](04-BASE-DE-DATOS.md) | Entidades, relaciones, identificadores, dependencias |
| 05 | [Flujos de trabajo](05-FLUJOS.md) | Procesos de principio a fin, con diagramas |
| 06 | [Finanzas](06-FINANZAS.md) | Detalle del módulo financiero: vales, liquidaciones, reintegros, consumos, pagos |
| 07 | [Documentos y firmas](07-DOCUMENTOS-Y-FIRMAS.md) | Generación, carga, destinatarios, circuito de firma |
| 08 | [Auditoría y seguridad](08-AUDITORIA-Y-SEGURIDAD.md) | Qué se registra, qué no, cómo se controla el acceso |
| 09 | [Mapa general](09-MAPA-GENERAL.md) | Esquema visual de módulos, flujos y puntos de intervención |
| 10 | [Entorno de demostración](10-ENTORNO-DEMO.md) | **Propuesta pendiente de autorización** |

---

## Hallazgos que conviene mirar primero

Esto no es una auditoría — es documentación. Pero al levantarla aparecieron cosas que un revisor querrá ver temprano. Se señalan aquí sin dramatizar y con la evidencia correspondiente en cada documento.

### 1 · Conviven dos sistemas de permisos

El sistema migró de un modelo por **rol global** a uno por **módulo y nivel**, y la migración está a medias. Hoy funcionan los dos a la vez:

- **`puede(modulo, nivel)`** — el nuevo. Gobierna 58 tablas (T&T, Aeronaves, CEA parcial).
- **`auth_rol() IN ('admin','asistente')`** — el viejo. Gobierna 22 políticas de escritura.

**Consecuencia concreta:** en las tablas que aún usan el modelo viejo, la distinción `observador / editor / super` **no aplica**. Quien tenga rol `asistente` escribe ahí sin importar qué nivel de módulo se le haya dado. Detalle en [03](03-ROLES-Y-PERMISOS.md).

### 2 · No existe un rol de sólo lectura completo

Es directamente relevante para el usuario de demostración que se pidió. Un usuario con rol `solo_lectura` **no puede leer** 12 tablas: las tres del sub-módulo de **Caja Chica por periodos** (`caja_chica_op_*`) y nueve vacías, restos del módulo retirado. Tampoco `audit_log` ni `usuarios`, que son sólo de admin.

> **Corregido el 5 nov 2026.** Una versión anterior decía 13 tablas e incluía `caja_chica_liq_rows`, concluyendo que «la pantalla de Caja Chica se le vería incompleta». Es incorrecto: esa tabla tiene una política de lectura `PERMISSIVE` con `USING (true)`, separada de la de escritura. El detalle de las liquidaciones sí se ve. Detalle en [03](03-ROLES-Y-PERMISOS.md) §4.

Esto condiciona la propuesta de [10](10-ENTORNO-DEMO.md).

### 3 · ~~33 tablas sin registro de auditoría~~ · en buena parte resuelto

La regla declarada del proyecto es que toda mutación queda en `audit_log` «sin excepciones». El levantamiento encontró 70 de 104 tablas con el trigger, y un patrón claro en las que faltaban: las cabeceras estaban auditadas y el detalle no.

> **Actualizado el 5 nov 2026 (fase 44).** Los seis huecos que de verdad importaban quedaron cerrados: `firmas`, `firma_miembros`, `usuarios`, `caja_chica_liq_rows`, `liquidacion_vales` y `consumo_renglones` ya tienen trigger. La cobertura pasa de 70 a **76 de 104 tablas**. Lo que sigue sin auditoria son catalogos y listas de valores, donde el riesgo es bajo.

Las que se cerraron eran estas:

- **`firmas` y `firma_miembros`** — el circuito de firmas no deja rastro inmutable.
- **`usuarios`** — un cambio de rol no queda registrado.
- **`cea_todos`**, `personas`, `empleados`, `entidades`, `proveedores`, `liquidacion_vales`, `caja_chica_liq_rows`.

Detalle y lista completa en [08](08-AUDITORIA-Y-SEGURIDAD.md).

### 4 · Documentos de viaje legibles por cualquier usuario autenticado

El bucket `tt-documentos` guarda pasaportes, visas, licencias, pases de abordar y confirmaciones. Su política de lectura es `auth.uid() IS NOT NULL`: **cualquier usuario con sesión válida puede leer cualquier archivo del bucket**, tenga o no el módulo de viajes. La escritura sí está restringida. Lo mismo aplica al bucket `documentos`.

En contraste, `avn-documentos` (aeronaves) sí está correctamente acotado por módulo. El patrón correcto existe en el sistema; no se aplicó en los otros dos buckets.

### 5 · Lo que sí está bien resuelto

Para no dar una imagen sesgada:

- **RLS habilitado en las 104 tablas**, todas con al menos una política. No hay tablas expuestas.
- **Las funciones de permiso** (`puede`, `auth_rol`, `es_admin`, `mi_miembro_id`) son `SECURITY DEFINER` con `search_path` fijo — la forma correcta de evitar secuestro de esquema.
- **No se almacenan números completos de tarjeta.** Se verificó: ninguno de los registros de `tarjetas_credito` contiene un PAN.
- **No se almacenan contraseñas.** La tabla `usuarios` no tiene columna de clave; la autenticación la lleva Supabase Auth en un esquema aparte.
- **Un usuario no puede cambiarse el rol a sí mismo**: la política `usuarios_self_update` permite editar la propia fila pero obliga a que `rol` siga siendo el mismo.
- **Los correlativos de negocio se generan en el servidor** mediante secuencias, no en el cliente.
- **Borrado suave** (`deleted_at`) en las tablas de negocio: el historial no se pierde.

---

## Condiciones bajo las que se hizo este levantamiento

- **No se modificó nada.** Las únicas escrituras en disco son los archivos de esta carpeta.
- **No se expone información confidencial.** Los ejemplos usan datos ficticios o estructuras vacías. Donde hubo que verificar algo sensible (si las tarjetas guardan el número completo), se consultó la *forma* del dato, no el dato.
- **Lo no verificable se marca como tal.** Aparece como `⚠️ No verificado` con el motivo.
- **Lo no implementado se distingue de lo implementado.** Hay funcionalidad descrita en el código como diferida; se señala explícitamente.

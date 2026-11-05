# Entorno de demostración · propuesta

> ## ⛔ Nada de esto se ha ejecutado
>
> No se creó ningún usuario, ni ningún proyecto, ni se modificó ningún permiso. Este documento es **una propuesta a decidir**. No hay credenciales que entregar porque no hay nada creado.
>
> Se pidió explícitamente detenerse antes de cualquier acción que afecte a producción. Esto es ese alto.

---

## 1 · Por qué no basta con «crear un usuario de sólo lectura»

Parece una petición sencilla y no lo es, por tres razones que se verificaron contra el sistema real.

### 1.1 · El rol de sólo lectura no ve todo lo que haría falta

Un usuario con rol `solo_lectura` **no puede leer 12 tablas**: las tres del sub-módulo de **Caja Chica por periodos** (`caja_chica_op_*`) y nueve vacías del módulo retirado. También quedan fuera `audit_log` y `usuarios`, que son exclusivas del administrador.

Resultado: la Caja Chica por periodos se vería vacía, Admin → Usuarios vacío, y no habría forma de mostrar el registro de auditoría, que es justamente uno de los apartados que se pidió documentar.

> **Corregido el 5 nov 2026.** Una versión anterior decía 13 tablas e incluía `caja_chica_liq_rows`, concluyendo que el detalle de las liquidaciones no se vería. Es incorrecto: su política de lectura es `PERMISSIVE USING (true)`. Ese detalle sí es visible.

### 1.2 · La lista de viajes le saldría vacía

Verificado en el código: quien tiene el módulo de viajes en nivel **observador** y no tiene `persona_id` asignado ve **cero viajes**.

```js
if (veTodos) return todos;              // veTodos = canEdit (editor)
if (!profile?.persona_id) return [];    // ← aquí cae un observador nuevo
```

Para que viera viajes habría que asignarle una `persona_id` y **darle de alta como participante en viajes reales** — es decir, escribir en producción. La alternativa, darle nivel `editor`, le concedería permiso de escritura. **No existe hoy una combinación que muestre todos los viajes sin conceder escritura.**

### 1.3 · Vería datos reales y confidenciales

Esto choca con una restricción que se puso expresamente en la solicitud. Un usuario de consulta en producción vería, entre otras cosas:

- Pasaportes, visas y licencias escaneadas (el bucket `tt-documentos` es legible por cualquier usuario autenticado).
- Titulares, bancos y límites de las tarjetas de crédito.
- NIT y direcciones del Personal JD; correos y teléfonos de empleados.
- Montos, proveedores y conceptos de todas las operaciones financieras.

No hay forma de enmascarar esto sin modificar las políticas de producción.

---

## 2 · Las tres opciones, comparadas

| | **A · Proyecto aparte con datos ficticios** | **B · Usuario de consulta en producción** | **C · Entorno local para el revisor** |
|---|---|---|---|
| Riesgo para producción | **Ninguno** | Bajo pero real | **Ninguno** |
| Expone datos reales | **No** | **Sí** | No |
| Fidelidad de estructura | Total | Total | Total |
| Fidelidad de datos | Ficticia pero coherente | Real | Ficticia |
| Ve Caja Chica completa | **Sí** | No | Sí |
| Ve viajes | **Sí** | No, salvo que se escriba en producción | Sí |
| Ve auditoría | **Sí** | No | Sí |
| Necesita escribir en producción | **No** | **Sí** (persona + participaciones) | **No** |
| Esfuerzo | 6-10 h | 30 min | 3-5 h + el revisor instala |
| Coste | Un proyecto Supabase adicional | Ninguno | Ninguno |
| Acceso del revisor | URL propia, usuario y clave | URL de producción | Lo levanta en su máquina |

---

## 3 · Recomendación · opción A

**Un segundo proyecto Supabase con el esquema real y datos inventados.** Es lo que se pidió como preferencia y es la respuesta correcta.

El sistema está en buena posición para esto: **88 migraciones idempotentes y versionadas** que reconstruyen el esquema completo desde cero, con un script de aplicación ya hecho. La estructura, las reglas de negocio, los permisos y las relaciones serían **idénticas a producción** — porque saldrían del mismo SQL.

### Qué haría, paso a paso

```
1. Crear un proyecto Supabase nuevo              (tú, desde tu panel)
      └─ me pasas las credenciales del proyecto

2. Aplicar las 88 migraciones en orden            (~20 min, automatizado)
      └─ esquema idéntico a producción: 104 tablas,
         RLS, triggers, funciones, secuencias

3. Sembrar datos ficticios coherentes             (el grueso del trabajo)
      ├─ ~8 catálogos: personas, entidades, empleados,
      │  invitados, proveedores, tarjetas, tipos de pago
      ├─ Finanzas: consumos, vales, liquidaciones y
      │  solicitudes de pago en LOS SEIS PASOS distintos,
      │  para que se vea el circuito completo
      ├─ CEA: pendientes, firmas en los cuatro estados,
      │  notas de entrega
      ├─ Viajes: 3 viajes con servicios variados,
      │  participantes y documentos de viajero
      └─ Aeronaves: una aeronave con movimientos de combustible

4. Crear los usuarios de demostración             (4 cuentas, ver §4)

5. Desplegar una vista previa apuntando a ese proyecto
      └─ URL propia, separada de producción

6. Entregarte las credenciales por un canal aparte
      └─ NO en este repositorio
```

### Datos ficticios, estructura real

Nombres, montos, números de documento y fechas inventados. Personas tipo «Juan Pérez», proveedores tipo «Suministros del Valle, S.A.», pasaportes con numeración obviamente falsa. **Las reglas de negocio, los estados, los correlativos, las relaciones y las políticas serían los auténticos**, porque vienen de las mismas migraciones.

---

## 4 · Los cuatro usuarios que propongo crear

Un solo usuario de consulta no permite evaluar un sistema cuyo punto más interesante **es precisamente la diferencia entre roles**. Propongo cuatro, para que el revisor pueda comparar:

| Usuario | Rol | Módulos | Para qué sirve |
|---|---|---|---|
| `revision.consulta@…` | `solo_lectura` | todos en `observador` | **El principal.** Consulta pura |
| `revision.gerencia@…` | `solo_lectura` | `cea:editor`, resto observador | Ver la bandeja de firmas y el acto de firmar |
| `revision.operacion@…` | `asistente` | todos en `editor` | Ver el sistema como lo opera quien lo usa a diario |
| `revision.admin@…` | `admin` | — | Ver Admin, accesos y el registro de auditoría |

**Sobre las restricciones de seguridad que se pidieron:** en un entorno con datos ficticios dejan de ser un requisito de protección y pasan a ser parte de lo que hay que evaluar. Un revisor que no puede ver el circuito de firma no puede opinar sobre él. Por eso propongo los cuatro — pero si prefieres **sólo el primero**, se crea sólo el primero y se entrega así.

**El usuario principal cumple todas las restricciones pedidas:** sólo lectura, sin crear ni editar ni borrar, sin aprobar ni firmar ni autorizar, sin acceso a claves ni credenciales (el esquema de aplicación no almacena contraseñas), y sin datos reales.

---

## 5 · Si hace falta algo hoy mismo · opción B con sus límites

Si la revisión no puede esperar a que esté lista la opción A, se puede crear **un usuario de consulta en producción** en unos 30 minutos. Debes saber exactamente qué se obtiene y qué no.

**Lo que se haría:**
- Una cuenta nueva en Supabase Auth.
- Una fila en `usuarios` con rol `solo_lectura`.
- Filas en `usuario_modulos`: `observador` en los ocho módulos.

**Lo que escribe en producción:** tres inserciones (cuenta, usuario, permisos). No toca ningún dato existente. `usuario_modulos` queda registrado en `audit_log`; la fila de `usuarios`, no — porque esa tabla no está auditada.

**Lo que el revisor vería:**

| ✅ Vería | ❌ No vería |
|---|---|
| Dashboard de supervisión | Renglones de las liquidaciones |
| Consumos TC Corp y Pagos | Vales, Reintegros, Consumos TC Pres |
| Catálogos (24 tablas) | Registro de auditoría |
| Firmas (lectura) | Admin → Usuarios |
| Aeronaves | **La lista de viajes le saldría vacía** |

**Y el problema de fondo:** vería datos reales — pasaportes, tarjetas, montos, proveedores. **Eso contradice la restricción que tú misma pusiste.** Por eso no la recomiendo salvo como puente temporal, y conviene borrar la cuenta en cuanto esté la opción A.

---

## 6 · Qué necesito de ti para avanzar

**Para la opción A (recomendada):**

1. Autorización para crear el proyecto Supabase, o que lo crees tú y me pases las credenciales.
2. Decisión sobre los usuarios: ¿los cuatro, o sólo el de consulta?
3. Confirmación de que los datos ficticios pueden ser completamente inventados, o si prefieres que imiten el volumen real.

**Para la opción B (puente):**

1. Autorización expresa para crear una cuenta en producción.
2. Un correo para esa cuenta.
3. Si acepto o no que vea datos reales — es tu decisión, no mía.

**En ninguno de los dos casos pondré las credenciales en este repositorio.** Te las entrego por el canal que prefieras.

---

## 7 · Sobre la URL de acceso

No la puedo indicar todavía porque depende de la opción:

| Opción | URL |
|---|---|
| A | Una vista previa nueva apuntando al proyecto de demostración. Se genera al desplegar |
| B | La misma de producción |
| C | Local en la máquina del revisor |

La producción actual **no** debe usarse para la revisión bajo la opción A, y el revisor no debería recibir su dirección si el acuerdo es trabajar sobre datos ficticios.

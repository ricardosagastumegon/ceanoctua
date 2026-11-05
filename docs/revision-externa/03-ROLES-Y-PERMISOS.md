# C · Usuarios, roles y permisos

Este documento contiene el **entregable 4: matriz de roles y permisos**.

---

## 1 · El hecho central: hay dos sistemas de permisos a la vez

CEA empezó con un modelo de **rol global** y está migrando a uno de **módulo + nivel**. La migración no terminó. Hoy conviven:

| | Sistema antiguo | Sistema nuevo |
|---|---|---|
| **Función** | `auth_rol()` | `puede(modulo, nivel)` |
| **Pregunta** | «¿qué rol tiene?» | «¿qué nivel tiene en este módulo?» |
| **Granularidad** | 4 roles globales | 8 módulos × 3 niveles |
| **Dónde manda** | 22 políticas de escritura + 22 de lectura | 58 tablas (T&T, Aeronaves, CEA parcial) |

**La consecuencia práctica, que es lo que importa para una revisión:**

> En las tablas gobernadas por el sistema antiguo, los niveles `observador / editor / super` **no tienen ningún efecto**. Quien tenga rol `asistente` puede escribir en ellas aunque su permiso de módulo sea «observador».

Esto no es un agujero de seguridad explotable por un tercero —sigue haciendo falta un rol `asistente` legítimo— pero sí significa que **el sistema no puede expresar hoy «esta persona ve Finanzas pero no la toca»** en todas las tablas. Es la causa directa de la limitación descrita en [10](10-ENTORNO-DEMO.md).

---

## 2 · Los cuatro roles

Definidos en el tipo `app_rol` de la base de datos.

| Rol | Significado | En uso hoy |
|---|---|---|
| `admin` | Dueño del sistema. Pasa todos los filtros por definición | 1 usuario |
| `asistente` | Opera el sistema. Escribe en Finanzas, Caja Chica y catálogos | 0 usuarios |
| `board_member` | Miembro de la junta | 0 usuarios |
| `solo_lectura` | Consulta | 1 usuario |

**Observación:** el rol `asistente`, que es el que más políticas de escritura habilita, no está asignado a nadie. La persona que opera el sistema lo hace con rol `admin`. Los dos roles intermedios están definidos y cableados en las políticas, pero sin uso real.

### Cómo pasa `admin` todos los filtros

```sql
-- public.puede(modulo, nivel)
select
  coalesce((select rol = 'admin' from usuarios where id = auth.uid()), false)
  or exists ( ... usuario_modulos ... );
```

El admin devuelve `true` antes de consultar `usuario_modulos`. Por eso sus permisos de módulo son irrelevantes: puede tenerlos vacíos y seguir viendo todo.

---

## 3 · Los tres niveles de permiso por módulo

| Nivel | Rango | Qué habilita |
|---|---|---|
| `observador` | 1 | Ver, imprimir, descargar |
| `editor` | 2 | Además crear y editar |
| `super` | 3 | Además borrar |

La comparación es por rango: `puede('tt','observador')` es cierto para quien tenga `editor` o `super`.

**Los ocho módulos asignables:** `dashboard` · `tt` · `aeronaves` · `cea` · `finanzas` · `caja_chica` · `miel_sj` · `admin`

Se asignan en Admin → Usuarios y accesos, que escribe en `usuario_modulos` (una fila por usuario y módulo).

---

## 4 · Matriz de permisos · qué puede LEER cada clase de usuario

Construida por clasificación de las 104 tablas según la expresión de su política de `SELECT`.

| Clase de política | Tablas | Quién lee |
|---|---|---|
| `puede('tt','observador')` | **46** | Quien tenga el módulo de viajes |
| `auth.uid() IS NOT NULL` | **25** | **Cualquier usuario autenticado** |
| `auth_rol() IN ('admin','asistente')` | **12** | Sólo quien opera |
| `puede('aeronaves','observador')` | **12** | Quien tenga el módulo de aeronaves |
| `auth_rol() IN ('admin','asistente','solo_lectura')` | **6** | Los tres roles, sin importar módulos |
| `es_admin()` | **2** | Sólo el administrador |
| Mixta (fila propia o admin) | **1** | `usuario_modulos` |

### Detalle por clase

**Cualquier usuario autenticado (25 tablas) — el grupo que más atención merece:**

```
avn_tipos_certificado   caja_chica_liq_rows  cea_notas_entrega  cea_todos
consumo_renglones       directorio           documentos         empleados
entidades               evento_religioso     firma_miembros     firmas
invitados               kit_items            lavanderia         liquidacion_vales
miel_constancias        miembros_board       pagos_notificaciones personas
proveedores             status_solicitud_pago tarjetas_credito  tipos_pago
vehiculos
```

Cualquier persona con una sesión válida —tenga los módulos que tenga— puede leer estas tablas. Incluye `tarjetas_credito` (titular, banco, límite, NIT), `personas` (NIT, dirección), `empleados` (correo, teléfono), `firmas` y `cea_todos`.

Es el **patrón C · catálogo** declarado en las convenciones del proyecto, aplicado con criterio amplio. Para catálogos como `tipos_pago` es razonable. Para `tarjetas_credito` y `personas` es discutible.

**Sólo admin/asistente (12 tablas):**

```
caja_chica_op_lineas   caja_chica_op_periodos   caja_chica_op_vale_facturas
eventos  notas  perfiles  perfil_familia  perfil_fechas  perfil_vehiculos
tareas   viajes  viaje_checklist
```

Las nueve últimas están vacías (restos del módulo retirado). Las tres primeras son la **Caja Chica por periodos**: un usuario `solo_lectura` no puede verla.

> **Corregido el 5 nov 2026.** Una versión anterior de este documento contaba 13 tablas e incluía `caja_chica_liq_rows` —los renglones de las liquidaciones— entre las que un `solo_lectura` no puede leer. Es incorrecto: esa tabla tiene **dos** políticas, una de escritura restringida a `admin`/`asistente` y una de lectura `PERMISSIVE` con `USING (true)`. El detalle de las liquidaciones **sí es legible** por cualquier usuario autenticado. Lo que queda fuera del alcance de `solo_lectura` en caja chica es únicamente el sub-módulo por periodos (`caja_chica_op_*`).

**Sólo admin (2 tablas):** `audit_log`, `usuarios`.

---

## 5 · Matriz de permisos · qué puede ESCRIBIR

| Expresión de la política | Políticas | Efecto |
|---|---|---|
| `puede('tt','editor')` | 46 | Editor de viajes |
| `auth_rol() IN ('admin','asistente')` | 22 | **Cualquier asistente, sin importar módulos** |
| `puede('aeronaves','editor')` | 12 | Editor de aeronaves |
| `es_admin()` | 10 | Sólo administrador |
| `... OR miembro_id = mi_miembro_id()` | 5 | Tablas del módulo retirado |
| `puede('cea','editor')` | 2 | Editor de CEA — incluye **firmar** |
| `auth_rol() = 'admin'` | 1 | |

**No existe ninguna política de escritura que acepte `auth.uid() IS NOT NULL`.** Un usuario autenticado sin rol ni módulos no puede escribir en ninguna parte. Esto es correcto y es la base sobre la que se apoya la propuesta de usuario de demostración.

### Dos políticas con diseño propio que merecen mención

**`usuarios_self_update`** — un usuario puede editar su propia fila, pero no cambiarse el rol:

```sql
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND rol = (SELECT u.rol FROM usuarios u WHERE u.id = auth.uid()))
```

Correcto: impide la escalada de privilegios por auto-edición.

**`pagos_notif_combustible_insert`** — permite a un editor de Aeronaves crear una notificación de pago sin permisos de Finanzas, pero sólo de ese tipo:

```sql
WITH CHECK (origen_tipo = 'combustible' AND puede('aeronaves','editor'))
```

Correcto: el permiso cruzado está acotado a la forma exacta del dato.

---

## 6 · Matriz resumida por rol

Lo que cada rol puede hacer hoy, asumiendo que tiene los módulos correspondientes al nivel indicado.

| Acción | `admin` | `asistente` | `solo_lectura` + observador | `solo_lectura` sin módulos |
|---|:---:|:---:|:---:|:---:|
| Ver catálogos (24 tablas) | ✅ | ✅ | ✅ | ✅ |
| Ver viajes | ✅ | ✅ | ✅ sólo donde participa¹ | ❌ |
| Ver aeronaves | ✅ | ✅ | ✅ | ❌ |
| Ver pagos / vales / liquidaciones / reintegros / consumos | ✅ | ✅ | ✅ | ✅² |
| Ver renglones de caja chica | ✅ | ✅ | ❌ | ❌ |
| Ver `audit_log` | ✅ | ❌ | ❌ | ❌ |
| Ver `usuarios` | ✅ | ❌ | ❌ | ❌ |
| Crear/editar en viajes | ✅ | ✅³ | ❌ | ❌ |
| Crear/editar en Finanzas | ✅ | ✅ | ❌ | ❌ |
| **Firmar documentos** | ✅ | ✅⁴ | ❌ | ❌ |
| Borrar (suave) | ✅ | según política | ❌ | ❌ |
| Cambiar roles y accesos | ✅ | ❌ | ❌ | ❌ |
| Cambiarse el rol a sí mismo | ❌ | ❌ | ❌ | ❌ |

¹ Regla de participación, §7.
² Por la clase `IN ('admin','asistente','solo_lectura')`: estas seis tablas se leen **por rol, no por módulo**. Un `solo_lectura` sin el módulo de Finanzas puede leerlas vía API aunque la interfaz no le muestre la pestaña.
³ Requiere además `puede('tt','editor')`.
⁴ Requiere `puede('cea','editor')`.

> **El punto ② es el ejemplo más claro de la divergencia entre interfaz y base.** La pestaña de Finanzas se oculta con `puede(profile,'finanzas')`, pero las políticas de esas seis tablas no consultan el módulo. Quien sepa usar la API lee los pagos sin tener el módulo. No es una fuga hacia fuera —hace falta una cuenta válida— pero sí significa que **ocultar una pestaña no es un control de acceso**.

---

## 7 · Reglas de visibilidad por participación

Además del rol y el módulo, hay una tercera dimensión: **estar involucrado en el registro**.

### Viajes

Un usuario que no sea admin/asistente ve un viaje **sólo si figura en `att_viaje_participantes`**. El filtrado se resuelve así: `usuarios.persona_id` → filas de participación → identificadores de viaje.

**Verificado:** este filtro vive **únicamente en el cliente** (`AttPage.tsx`). La política RLS de `att_viajes` es, completa:

```sql
att_viajes_read   FOR SELECT  USING (puede('tt','observador'))
att_viajes_write  FOR ALL     USING (puede('tt','editor'))
```

No hay restricción por participación en la base. **Un usuario con el módulo de viajes en nivel observador puede leer los 10 viajes vía API directa**, aunque la interfaz le muestre sólo aquellos donde participa.

Conviene decir que esto es deliberado y está documentado en el propio código: *«Es qué se le muestra, no un muro»*. La intención era reducir ruido, no aislar información — el resumen del Dashboard, por diseño, sí muestra todos los viajes a todo el mundo. **No es un control de seguridad y no debe evaluarse como tal.** Si el requisito fuera aislamiento real, haría falta llevar la condición a la política.

**Efecto secundario relevante:** quien tenga `tt:observador` y **no** tenga `persona_id` asignado ve la lista de viajes **vacía** (`if (!profile?.persona_id) return []`). Quien tenga `tt:editor` ve todos, porque `veTodos = canEdit`. No existe una combinación que muestre todos los viajes **sin** conceder escritura. Esto condiciona directamente el entorno de demostración ([10](10-ENTORNO-DEMO.md)).

### Pendientes (TO DO)

Un usuario ve los pendientes asignados a su persona. El enlace es `usuarios.persona_id` → `cea_todos.persona_id`. La cuenta con la que se entra y la persona a la que se asigna trabajo son entidades distintas, enlazadas explícitamente.

### Firmas

Un usuario ve en su bandeja los documentos donde figura en `firma_miembros`. La asignación es por miembro de junta (`miembros_board`), no por usuario.

---

## 8 · Cómo se determina qué ve cada persona · resumen del algoritmo

```
1. Supabase Auth valida correo y clave → entrega un JWT con auth.uid()

2. lib/auth.tsx carga el perfil:
   · usuarios          → rol, persona_id, miembro_id
   · usuario_modulos   → { modulo: nivel }

3. La INTERFAZ decide, de forma cosmética:
   · TabsNav  → qué pestañas dibuja     (puede(modulo) o rol)
   · Inicio   → a dónde cae el usuario
   · Páginas  → qué botones ofrece      (puede(modulo, 'editor'))

4. La BASE decide, de forma vinculante:
   · cada consulta pasa por RLS
   · RLS evalúa puede() o auth_rol() según la tabla
   · lo que no pase, no sale — aunque la interfaz lo haya pedido
```

**Para la revisión:** los pasos 3 y 4 pueden discrepar, y discrepan en al menos un caso documentado (§6, nota ②). El paso 3 es experiencia de usuario; el paso 4 es seguridad. Evaluarlos como una sola cosa llevaría a conclusiones equivocadas en ambas direcciones.

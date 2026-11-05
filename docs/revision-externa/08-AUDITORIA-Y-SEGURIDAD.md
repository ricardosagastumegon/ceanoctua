# I · Auditoría y seguridad

---

## 1 · Qué registra el sistema

La auditoría se implementa con un único trigger, `audit_trigger()`, instalado en 70 de las 104 tablas.

```sql
CREATE FUNCTION public.audit_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  -- INSERT: datos_antes = null, datos_despues = fila completa
  -- UPDATE: ambos
  -- DELETE: datos_antes = fila completa, datos_despues = null
  insert into public.audit_log
    (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  values
    (TG_TABLE_NAME, v_id, lower(TG_OP), auth.uid(), v_old, v_new);
  ...
end $$;
```

### Qué conserva cada registro

| Columna | Contenido |
|---|---|
| `tabla` | Nombre de la tabla afectada |
| `registro_id` | `uuid` de la fila |
| `accion` | `insert` · `update` · `delete` |
| `usuario_id` | `auth.uid()` de quien lo hizo |
| `datos_antes` | **Fila completa** en JSON, antes del cambio |
| `datos_despues` | **Fila completa** en JSON, después |
| `created_at` | Momento del cambio |

**Volumen actual:** ~4,300 registros.

**Fortaleza del diseño:** guarda la fila completa, no sólo los campos que cambiaron. Permite reconstruir el estado histórico exacto de cualquier registro auditado.

**Contrapartida:** `audit_log` contiene copias completas de datos sensibles. Cualquier política de confidencialidad que se aplique a las tablas de origen debe aplicarse también aquí. Hoy la tabla es legible **sólo por el administrador**, lo cual es correcto.

---

## 2 · Lo que NO se registra

**33 tablas de negocio carecían del trigger** en el momento del levantamiento. Era la desviación más significativa respecto de la regla declarada del proyecto, que establece que toda mutación queda registrada «sin excepciones».

> **Actualizado el 5 nov 2026 (fase 44).** Los seis huecos que de verdad importaban quedaron cerrados: `firmas`, `firma_miembros`, `usuarios`, `caja_chica_liq_rows`, `liquidacion_vales` y `consumo_renglones` ya tienen trigger. La cobertura pasa de 70 a **76 de 104 tablas**. Lo que sigue sin auditoria son catalogos y listas de valores, donde el riesgo es bajo.


### Las ausencias que importan

| Tabla | Por qué importa |
|---|---|
| **`firmas`** | El acto de autorizar no deja rastro inmutable |
| **`firma_miembros`** | Se puede cambiar a quién iba dirigido un documento |
| **`usuarios`** | **Un cambio de rol no queda registrado** |
| `caja_chica_liq_rows` | El detalle de una rendición es modificable sin rastro |
| `liquidacion_vales` | La vinculación vale↔liquidación es modificable sin rastro |
| `consumo_renglones` | El desglose de un consumo |
| `cea_todos` | Los pendientes |
| `personas`, `empleados`, `entidades`, `proveedores` | Catálogos maestros de los que dependen las finanzas |
| `documentos`, `directorio`, `lavanderia`, `miel_constancias` | Operación de escritorio |
| `caja_chica_op_*` (3) | Operación por periodos |
| `status_solicitud_pago`, `tipos_pago` | Listas de valores |
| 10 tablas vacías del módulo retirado | Sin impacto |

### La asimetría más llamativa

`usuario_modulos` **sí** está auditada; `usuarios` **no**.

Queda constancia de quién recibió permiso sobre un módulo, pero no de quién fue promovido a administrador. Dado que un `admin` pasa todos los controles por definición, **la promoción a administrador es el cambio de privilegio más consecuente del sistema, y es el único que no se registra.**

### El patrón de la ausencia

Las cabeceras están auditadas; el detalle, no. `caja_chica_liquidaciones` sí, sus renglones no. `tc_consumos` sí, sus renglones no. `pagos` sí, pero la firma que lo autoriza no.

Es consistente con una implementación incremental en la que el trigger se fue añadiendo tabla por tabla a las entidades principales. **No parece una decisión de diseño, sino cobertura incompleta.**

---

## 3 · Cómo se controla el acceso

### Tres capas, sólo una vinculante

```
┌─────────────────────────────────────────────┐
│ 1. AUTENTICACIÓN · Supabase Auth            │
│    correo + clave → JWT                     │
│    Sin JWT válido: nada                     │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 2. INTERFAZ · cosmética                     │
│    TabsNav, Inicio, botones                 │
│    ⚠️ NO es un control de seguridad         │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 3. RLS · vinculante                         │
│    Cada consulta, cada escritura            │
│    puede() | auth_rol() | es_admin()        │
│    Esto es lo único que de verdad protege   │
└─────────────────────────────────────────────┘
```

La capa 2 puede divergir de la capa 3, y diverge en al menos dos casos documentados ([03](03-ROLES-Y-PERMISOS.md) §6-7): la visibilidad de viajes por participación y la lectura de seis tablas financieras por rol.

**Implicación para la revisión:** probar el sistema sólo desde la interfaz no permite evaluar su seguridad. Hay que probar contra la API con la clave anónima.

### Las funciones de permiso

Las cuatro son `STABLE SECURITY DEFINER` con `SET search_path TO 'public'`:

| Función | Devuelve |
|---|---|
| `auth_rol()` | El rol del usuario de la sesión |
| `es_admin()` | ¿Es administrador? |
| `mi_miembro_id()` | Su miembro de junta |
| `puede(modulo, nivel)` | ¿Tiene ese nivel en ese módulo? (admin siempre sí) |

**`SET search_path` es la parte importante.** Sin él, una función `SECURITY DEFINER` es vulnerable a secuestro de esquema: un usuario podría crear una tabla `usuarios` en un esquema propio y hacer que la función la consulte con privilegios elevados. Está correctamente aplicado en las cuatro.

---

## 4 · Qué impide que un usuario ejecute acciones no autorizadas

| Mecanismo | Qué impide | Estado |
|---|---|---|
| RLS en las 104 tablas | Leer o escribir fuera de lo permitido | ✅ Completo |
| Ninguna política de escritura acepta «autenticado a secas» | Que una cuenta sin rol escriba | ✅ Verificado |
| `usuarios_self_update` con `WITH CHECK` sobre `rol` | Escalada por auto-edición | ✅ Correcto |
| `audit_log` sin política de inserción | Falsificar el registro desde la aplicación | ✅ Sólo el trigger escribe |
| `audit_log` legible sólo por admin | Lectura del historial completo | ✅ |
| Correlativos generados en el servidor | Colisión o manipulación de numeración | ✅ |
| Borrado suave | Pérdida de historial | ✅ En tablas de negocio |
| `CHECK (num_nonnulls(...) = 1)` | Documentos huérfanos o duplicados | ✅ |
| Buckets privados + URLs firmadas de 600 s | Enlaces permanentes a documentos | ✅ |
| Restricciones de transición de estado | Saltos ilegales entre estados | ❌ **No existen** |

---

## 5 · Hallazgos de seguridad, ordenados por relevancia

Se presentan como observaciones para la revisión, no como vulnerabilidades explotables desde fuera. **Todas requieren una cuenta válida del sistema.**

### 5.1 · Documentos de viaje legibles por cualquier usuario autenticado

```sql
-- bucket tt-documentos
USING (bucket_id = 'tt-documentos' AND auth.uid() IS NOT NULL)
```

Pasaportes, visas y licencias escaneadas. Cualquier sesión válida los lee, tenga o no el módulo de viajes. Lo mismo en `documentos`.

**El patrón correcto existe** en `avn-documentos`, que sí acota por módulo. Es una corrección de una línea por política.

### 5.2 · ~~33 tablas sin auditoría, incluidas `firmas` y `usuarios`~~ · resuelto en lo esencial

Desarrollado en §2. El impacto depende de si la trazabilidad de la autorización es un requisito del negocio.

### 5.3 · El patrón «catálogo abierto» · parcialmente cerrado

`tarjetas_credito` (titular, banco, límite, NIT), `personas` (NIT, dirección) y `empleados` (correo, teléfono) usaban `auth.uid() IS NOT NULL`.

**Mitigante verificado:** `tarjetas_credito` **no almacena el número completo de tarjeta**. Se comprobó la forma del dato: ninguno de los registros coincide con un patrón de PAN de 13-19 dígitos.

> **Actualizado el 5 nov 2026 (fase 45).** Al crear el tercer usuario del sistema —el Tesorero, con un rol nuevo que no concede lectura financiera— se probó su aislamiento **con su sesión real y el rol `authenticated`**, no desde la interfaz. `firmas` y `tarjetas_credito` quedaron acotadas por módulo. Las demás siguen abiertas.

### 5.3.1 · Lo que el barrido completo encontró

Se consultaron **las 104 tablas** con la sesión del usuario más restringido del sistema, que sólo tiene el módulo `tesoreria`. Ve **19 tablas con datos, 249 filas**. Clasificadas:

**Listas de valores — es su propósito, no es un hallazgo:**
`tipos_pago` · `status_solicitud_pago` · `entidades` · `proveedores` · `miembros_board` · `avn_tipos_certificado`. Y `usuarios` / `usuario_modulos`, donde ve **sólo su propia fila**: la política es correcta.

**Datos de personas — discutible:**
`empleados` (35: nombre, puesto, correo, teléfono) · `personas` (10: NIT, dirección) · `invitados` (12) · `directorio` (5).

**Contenido operativo ajeno — esto sí es el hallazgo:**

| Tabla | Filas | Qué expone |
|---|---|---|
| `caja_chica_liq_rows` | 53 | **El detalle de los gastos de las liquidaciones** |
| `cea_todos` | 40 | La lista de pendientes de la asistente |
| `pagos_notificaciones` | 18 | Avisos de pago, **con monto y concepto** |
| `liquidacion_vales` | 13 | Qué vale entra en qué liquidación |
| `firma_miembros` | 5 | A quién iba dirigido cada documento de firma |
| `cea_notas_entrega` | 2 | Entregas físicas |

**La asimetría es el patrón, y es el mismo que el de la auditoría:** *la cabecera está protegida y el detalle no*. `caja_chica_liquidaciones` quedó acotada y sus 53 renglones no. `firmas` quedó acotada y `firma_miembros` no. `tc_consumos` está acotada y `consumo_renglones` sólo está vacía — el día que tenga datos, serán visibles.

No parece una decisión de diseño. Parece que las políticas se escribieron tabla por tabla y las de detalle heredaron la regla permisiva por omisión.

### 5.4 · Dos sistemas de permisos conviviendo

22 políticas de escritura ignoran el nivel de módulo y miran sólo el rol. Consecuencia: **el sistema no puede expresar hoy «ve Finanzas pero no la toca»** en todas sus tablas.

### 5.5 · Filtros de aplicación que parecen controles de acceso

La visibilidad de viajes por participación vive sólo en el cliente. Está documentado en el propio código como decisión consciente (*«Es qué se le muestra, no un muro»*), pero un revisor que lo descubra sin ese contexto podría interpretarlo como un fallo.

### 5.6 · Sin restricciones de transición de estado

Ni los vales (13 estados), ni los pagos (6 pasos), ni las firmas (4 estados) tienen restricciones en la base que impidan saltos ilegales. La lógica vive en la aplicación; una escritura directa por API puede poner cualquier estado.

---

## 6 · Lo que está bien resuelto

Para que el balance sea justo:

- **RLS universal.** 104 de 104 tablas, todas con política. No hay tablas olvidadas.
- **Funciones de permiso correctamente endurecidas** con `search_path` fijo.
- **Sin contraseñas en el esquema de aplicación.** La autenticación vive en Supabase Auth.
- **Sin números de tarjeta completos.**
- **Imposible auto-promoverse** de rol.
- **`audit_log` inmutable desde la aplicación:** sin política de inserción, sólo escribe el trigger con privilegios elevados.
- **Buckets privados con URLs firmadas** de vigencia corta, no enlaces públicos.
- **Correlativos en el servidor.**
- **Borrado suave** en las tablas de negocio.
- **Migraciones con verificación propia:** las que cargan datos financieros comprueban el resultado y revierten si no cuadra.
- **Claves foráneas con nombre explícito** y restricciones `CHECK` semánticas donde el modelo lo exige.

---

## 7 · Lo que no se pudo verificar

Se declara expresamente, conforme a lo solicitado:

| Aspecto | Motivo |
|---|---|
| Configuración de Supabase Auth (política de claves, caducidad de sesión, 2FA) | Vive en el panel del proveedor, fuera del código y del esquema |
| Retención y restauración de respaldos | Gestionado por el proveedor; no hay configuración en el repositorio |
| Cabeceras HTTP de seguridad en producción | Definidas en la configuración de despliegue; no se inspeccionó el sitio en vivo |
| Si la clave anónima está correctamente limitada en el panel | Fuera del alcance de la introspección de base de datos |
| Rotación de credenciales | Sin evidencia en el repositorio |
| Exhaustividad de restricciones `CHECK` sobre montos | Se revisaron las tablas principales, no las 104 |
| Qué estados de vale se usan realmente | Requiere confirmación con la usuaria |
| Uso real del módulo de Caja Chica por periodos | Requiere confirmación con la usuaria |

---

## 8 · Prioridades sugeridas

No es parte de lo solicitado —se pidió documentar, no recomendar— pero el orden ayuda a enfocar la revisión:

1. **Acotar `tt-documentos` y `documentos` por módulo.** Una línea por política; el patrón correcto ya existe en el sistema.
2. **Añadir el trigger de auditoría a `firmas`, `firma_miembros` y `usuarios`.** Tres sentencias.
3. **Decidir qué pasa con los dos sistemas de permisos.** No es urgente, pero mientras convivan no se puede ofrecer un acceso de sólo lectura completo — lo que bloquea, entre otras cosas, el entorno de demostración solicitado.
4. **Revisar el patrón «catálogo abierto»** en `tarjetas_credito`, `personas` y `empleados`.

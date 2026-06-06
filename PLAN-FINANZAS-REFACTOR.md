# Plan — Refactor del Módulo Finanzas

## De qué se trata este plan

Este documento traduce el Excel `MO_DULO_DE_FINANZAS__1_.xlsx` (con sus 37
mockups) en instrucciones ejecutables para Claude Code. Es el **spec
autoritativo** del módulo de Finanzas, y **supersede** lo que estaba pendiente
de la corrección de Caja Chica (porque CC Board se disuelve dentro de Finanzas).

Por la cantidad de cambios, está partido en **6 fases**. Cada una es una sesión
de Claude Code, con su propio bloque de instrucciones para pegar.

---

## Preparación previa — obligatorio antes de empezar

1. **Descomprimir `finanzas-mockups.zip` en `reference/finanzas-mockups/`** y
   commitearlo al repo. Son 29 imágenes (mockups del diseño objetivo). Cada
   fase referencia imágenes específicas por número.
2. Aplicar la decisión de **Personal JD** si aún no se hizo (ver
   `PLAN-PERSONAL-JD.md`). Este refactor usa Empleados + Board como fuentes de
   dropdowns; Personal JD no es bloqueante pero ordena el modelo de personas.
3. Asegurar que la regla "NUNCA leer el HTML completo, solo `grep` por función"
   esté en `CLAUDE.md` (problema de la sesión saturada de antes).

---

## Cambios estructurales (afectan a todo el módulo)

Estos cambios son transversales y se hacen en la Fase F-0:

- **Eliminar la pestaña `CC Board`** del nav principal. Sus contenidos (Vales y
  Liquidaciones) se mueven a Finanzas.
- **Eliminar la sección `VOUCHERS`** de Finanzas. El concepto se reemplaza por
  la Solicitud de Pago (SP) que ahora absorbe esa funcionalidad.
- **Estructura final de Finanzas (5 secciones):** Vales · Liquidaciones ·
  Reintegros · Consumos TC Corp · Pagos.
- **Nuevo catálogo en Admin: `Status Solicitud de Pago`** — alimenta el
  dropdown de estado en SP. 6 valores: `Generado, En Solicitud de Firma,
  Firmado, Presentado, Procesado, Pagado`.

---

## Lenguaje de diseño (mantener en TODAS las fases)

Visto en los mockups, mantener consistencia:

- **Vista imprimible por entidad** con header en degradado: **teal** para
  vales, liquidaciones y SP; **púrpura-azul** para consumos de TC corporativa.
- **Series con año embebido:** `VL-YYYY-####` (vales), `CC-YYYY-####`
  (liquidaciones), `SP-YYYY-####` (SP), `{CODE}-YYYY-####` (consumos TC,
  donde CODE es el código de la empresa, ej. `AGRO-2026-0001`).
- **Status como píldoras** (badges).
- **KPIs en tarjetas** en la cabecera del listado.
- **Botones de acción consistentes** en los listados: ver (ojo), editar
  (lápiz), borrar (×).
- Generación de PDF con botón **`Imprimir`** en cada vista.

---

# FASE F-0 — Reorganización estructural

## Alcance

- Disolver pestaña CC Board; mover Vales y Liquidaciones al módulo Finanzas.
- Eliminar sección Vouchers del UI (la tabla `vouchers` puede quedarse o
  marcarse deprecada — no se borra todavía, sí se quita del nav y de los hooks).
- Agregar 5ª sub-sección de Finanzas: Vales · Liquidaciones · Reintegros ·
  Consumos TC Corp · Pagos.
- Crear catálogo Admin `Status Solicitud de Pago`.

## Instrucciones para Claude Code (copia este bloque)

> Estás en la **Fase F-0** del refactor de Finanzas. Referencias:
> `PLAN-FINANZAS-REFACTOR.md` (este plan) y `reference/finanzas-mockups/`.
>
> 1. **TabsNav:** elimina la pestaña `CC Board`. Asegura que el módulo Finanzas
>    es visible para `admin` y `asistente` (sin cambios en la condición de rol).
> 2. **`FinanzasPage`:** redefine la sub-navegación a 5 secciones en este
>    orden: Vales, Liquidaciones, Reintegros, Consumos TC Corp, Pagos. Elimina
>    la sub-sección de Vouchers del UI; **no borres todavía la tabla `vouchers`
>    en la base** (queda como deprecada).
> 3. **Admin — nuevo catálogo:** crea la sub-sección "Status Solicitud de Pago"
>    en el módulo Admin, siguiendo el patrón de Fase 5 (CatalogPage, `api.ts`,
>    `hooks.ts`). Crea la tabla `status_solicitud_pago` (campos: `id uuid`,
>    `nombre text unique not null`, `orden int`, columnas de auditoría). Siembra
>    los 6 valores en orden: Generado, En Solicitud de Firma, Firmado,
>    Presentado, Procesado, Pagado.
> 4. Las rutas viejas de `cc-board/*` se redirigen a la sub-sección
>    correspondiente dentro de Finanzas (para no romper bookmarks).
>
> No toques aún los formularios ni los modelos de Vales/Liquidaciones/Consumos/
> Pagos — eso viene en las fases siguientes. Al terminar, confirma `build` y
> `lint` limpios y que la sub-nav de Finanzas tiene las 5 secciones.

## Criterios de aceptación

- [ ] Sin pestaña CC Board en el TabsNav.
- [ ] Finanzas muestra 5 sub-secciones en el orden indicado.
- [ ] Sub-sección Vouchers ya no aparece en el UI.
- [ ] Catálogo "Status Solicitud de Pago" funcional en Admin con los 6 valores.

---

# FASE F-1 — Vales (rebuild)

## Alcance

Reconstruir el módulo de Vales con su nuevo formato y agregar el concepto de
"Vale a Entidad". Mockups de referencia: **image3.png** (vista de vale CREADO),
**image34.png** (vista con status ASIGNADO A LIQUIDACIÓN).

## Modelo de datos

```sql
-- enum del tipo de vale
create type vale_tipo as enum ('desembolso','entidad');

-- ajustes a caja_chica_vales (o renombrar a 'vales' a discreción de Claude Code)
alter table caja_chica_vales
  add column tipo vale_tipo not null default 'desembolso',
  add column vale_a_persona_id uuid references personas(id),   -- si Personal JD ya existe
  add column vale_a_empleado_id uuid references empleados(id),
  add column liquidar_a_entidad_id uuid references entidades(id),
  add column liquidar_a_empleado_id uuid references empleados(id);

-- nuevo formato de serial
alter table caja_chica_vales
  alter column serial set default null,
  add constraint vale_serial_format check (serial ~ '^VL-\d{4}-\d{4}$');

-- secuencia anual para vales
-- (Claude Code define la función que genera VL-YYYY-####)
```

**Reglas según el tipo:**

- `desembolso` (Vale normal): `vale_a` = un empleado (`vale_a_empleado_id`);
  `liquidar_a` = una entidad (`liquidar_a_entidad_id`).
- `entidad` (Vale a Entidad): **invertido** — `vale_a` = una entidad
  (no `vale_a_empleado_id` sino una referencia a entidades); `liquidar_a` = un
  empleado. Esto refleja "un empleado financia a la entidad."

> Decisión de modelo recomendada: usar dos pares de columnas nullables
> (`vale_a_empleado_id` / `vale_a_entidad_id`, `liquidar_a_empleado_id` /
> `liquidar_a_entidad_id`) con un `check` que valida la coherencia según `tipo`.

## Cambios al formulario

Del Excel, hoja VALES:

- **Eliminar** la casilla "Asignar a Liquidación" del form de creación.
- **`Vale a:`** dropdown — para tipo `desembolso`, de Empleados; para tipo
  `entidad`, de Entidades.
- **Renombrar `Entidad` → `Liquidar a`** — dropdown — para tipo `desembolso`,
  de Entidades; para tipo `entidad`, de Empleados.
- **Botones del listado:** `+ Nuevo Vale` y `+ Vale a Entidad`.
- En cada vale del listado: **botón `+ Liquidar`** que abre la creación de
  liquidación pre-enlazada a ese vale.

## Statuses (workflow)

1. `Creado` — automático al crear.
2. `Asignado a Liquidación` — automático cuando se crea una liquidación que lo
   referencia.
3. `Liquidado` — manual, cuando se cierra la liquidación.
4. `Asignado a Pagos` — automático cuando la liquidación se envía a Pagos.

(El enum `vale_status` actual tiene 8 valores; los 4 anteriores son los del
flujo activo. Conservar los otros como compatibilidad o reducirlos — decisión
de Claude Code, no afecta UI.)

## Instrucciones para Claude Code (copia este bloque)

> Estás en la **Fase F-1** del refactor de Finanzas: rebuild de Vales.
> Referencias: `PLAN-FINANZAS-REFACTOR.md`, mockups
> `reference/finanzas-mockups/image3.png` y `image34.png`.
>
> **Esquema:**
> 1. Migración nueva con el enum `vale_tipo`, los nullable FKs según el plan, y
>    el `check` que valida coherencia tipo↔columnas.
> 2. Cambia el formato de `serial` a `VL-YYYY-####` con secuencia/función
>    server-side (similar al patrón de Miel y Voucher). Vales viejos: si la
>    base está vacía no hay que migrar; si hay datos, conservar.
>
> **Frontend:**
> 3. Mueve el módulo de Vales a `modules/finanzas/vales/` (ya no a CC Board).
> 4. Formulario "+ Nuevo Vale": campos según el plan; **sin la casilla "Asignar
>    a Liquidación"**. "Vale a" = dropdown Empleados; "Liquidar a" = dropdown
>    Entidades.
> 5. Formulario "+ Vale a Entidad": **mismo formulario, dropdowns invertidos**.
>    "Vale a" = Entidades; "Liquidar a" = Empleados. Lleva `tipo='entidad'`.
> 6. Listado: dos botones en cabecera (`+ Nuevo Vale`, `+ Vale a Entidad`).
>    Cada fila muestra serial, status pill, monto, "Vale a", concepto, fecha,
>    y un **botón `+ Liquidar`**.
> 7. Vista imprimible del vale (mockup image3 / image34): header degradado
>    teal, nombre grande del beneficiario, monto en grande, badges de serial y
>    status, los campos en tarjetas, líneas de firma al pie, botón Imprimir.
> 8. Status workflow de 4 pasos según el plan.
>
> **Verificación visual obligatoria:** compara cada pantalla resultado contra
> los mockups (image3, image34). Si difiere significativamente, ajusta. "Build
> limpio" NO basta; el formato debe coincidir.
>
> Al terminar, dame el resumen y confirma fidelidad visual contra mockups.

## Criterios de aceptación

- [ ] `build` y `lint` limpios.
- [ ] Dos botones de creación: Vale normal y Vale a Entidad.
- [ ] Form invertido para Vale a Entidad (dropdowns intercambiados).
- [ ] Serial `VL-YYYY-####` generado en servidor.
- [ ] Vista imprimible del vale visualmente fiel a `image3.png` / `image34.png`.
- [ ] Status workflow: Creado → Asignado a Liquidación → Liquidado → Asignado a Pagos.
- [ ] Botón `+ Liquidar` en cada fila del listado.

---

# FASE F-2 — Liquidaciones (rebuild con muchos vales + renglones)

## Alcance

Reconstruir el módulo de Liquidaciones con el modelo CORRECTO:
**muchos-a-muchos con vales** y **renglones de compras propios**. Mockups:
**image35.png** (vista de liquidación) y **image6.png** (listado con KPIs).

## Modelo de datos — el cambio más grande

```sql
-- Renglones de compra de la liquidación (lo que faltaba)
create table liquidacion_renglones (
  id              uuid primary key default gen_random_uuid(),
  liquidacion_id  uuid not null references caja_chica_liquidaciones(id) on delete cascade,
  orden           int not null,
  fecha           date,
  factura         text,
  proveedor       text,                         -- considera FK a proveedores
  concepto        text not null,
  cantidad        numeric(14,2) not null default 1,
  precio_unit     numeric(14,2) not null,
  subtotal        numeric(14,2) generated always as (cantidad * precio_unit) stored,
  created_at      timestamptz default now()
);

-- Vales-liquidación: muchos a muchos
create table liquidacion_vales (
  liquidacion_id  uuid references caja_chica_liquidaciones(id) on delete cascade,
  vale_id         uuid references caja_chica_vales(id) on delete restrict,
  primary key (liquidacion_id, vale_id)
);

-- IMPORTANTE: eliminar la FK errónea vale.liquidacion_id que se metió en Fase 9
alter table caja_chica_vales drop column liquidacion_id;

-- Ajustes a la liquidación
alter table caja_chica_liquidaciones
  drop column if exists periodo,                -- eliminar campo PERIODO (Excel)
  add column producto_servicio text,
  add column forma_pago text,                   -- "Caja Chica", "Solicitud de Pago", etc.
  add column reintegrar_a text,                 -- a quién se le devuelve la diferencia (nombre o FK)
  add column reintegrar_a_persona_id uuid references personas(id),
  add column motivo text,
  add column solicitado_por text,               -- puede ser combinado: "LISSA ARRIAZA/ KATTY"
  add column total_compras numeric(14,2),       -- calculado o redundante
  add column total_vales numeric(14,2),         -- calculado o redundante
  add column diferencia numeric(14,2);          -- = total_compras - total_vales

-- Serial nuevo formato
alter table caja_chica_liquidaciones
  add constraint liq_serial_format check (serial ~ '^CC-\d{4}-\d{4}$');
```

**Regla clave del Excel:** "Toda liquidación creada a partir de un vale,
automáticamente tendrá la misma Serie y No. del Vale que le dio origen." Es
decir, si un vale es `VL-2026-0001`, la liquidación es `CC-2026-0001` (mismo
número, prefijo distinto). Si la liquidación cubre varios vales, queda con el
número del **primer** vale (o del vale principal); Claude Code escoge una regla
y la documenta.

## Form de la nueva liquidación (mockup image35)

Campos en cabecera:
- Fecha, Entidad (dropdown), Forma de Pago (Caja Chica / Solicitud de Pago / Transferencia)
- Moneda
- Solicitado por (Empleados + Board), Reintegrar a (Empleados + Board / Personal JD)
- Producto / Servicio, Vale Vinculado (selector múltiple de vales abiertos)
- Motivo (concepto del header)

Tabla "Detalle de Compras" — editable, agregar/quitar filas:
- `# | Fecha | Factura | Proveedor | Concepto | Cant | P. Unit | Total`

Pie:
- 3 cajas KPI: **Total Compras**, **Vale Recibido** (suma de montos de los
  vales vinculados), **Diferencia** (resaltada en cyan si es positiva).
- Comentarios (textarea).
- Firmas: Elaborado por / Autorizado por.
- Botones: Imprimir, **PAGOS** (cuando forma_pago = "Solicitud de Pago", este
  botón envía la liquidación a Pagos > Notificaciones).

## Listado de liquidaciones (mockup image6)

KPIs arriba:
- Total Liquidaciones (#  + monto)
- Hold To Pay (#)
- Pagadas (#  + % completadas)
- Reintegradas (#  + monto)

Tabla: Serie · Fecha · Solicitado Por · Motivo · Entidad · Forma de Pago (pill) ·
Total · Estado (dropdown editable + pill). Acciones por fila: ver, editar, borrar.

## Instrucciones para Claude Code (copia este bloque)

> Estás en la **Fase F-2** del refactor de Finanzas: rebuild completo de
> Liquidaciones. Es la fase más sensible — corrige el error de modelo de la
> Fase 9 (donde quedaron como "agrupa vales" sin renglones). Mockups:
> `reference/finanzas-mockups/image35.png` (vista) e `image6.png` (listado).
>
> **Esquema (migración nueva):**
> 1. Crea `liquidacion_renglones` y `liquidacion_vales` según el plan.
> 2. **Elimina la columna `liquidacion_id` de `caja_chica_vales`** (era la FK
>    al revés).
> 3. Ajusta `caja_chica_liquidaciones` según el plan: elimina `periodo`,
>    agrega campos del header, los 3 totales y el `check` del serial.
> 4. Función/secuencia para que la liquidación herede el correlativo del vale
>    principal (`CC-YYYY-####` con el mismo #### del vale, año de creación).
> 5. Aplica los triggers de `updated_at` y mantén `audit_log` activo.
>
> **Frontend:**
> 6. Form de nueva liquidación según mockup `image35`: cabecera, **selector
>    múltiple de vales abiertos**, tabla editable de renglones (agregar/quitar
>    filas), 3 KPIs en vivo (total compras, vale recibido, diferencia), firmas.
> 7. Vista imprimible idéntica al mockup `image35` (header teal, los KPIs en
>    color destacado, pie con firmas y "Board Assistant - Finanzas - ...").
> 8. Listado según `image6`: 4 KPI cards arriba, tabla con columnas indicadas,
>    pills de forma de pago y estado, búsqueda + 2 filtros + export Excel.
> 9. Botón **PAGOS** activo solo cuando `forma_pago = "Solicitud de Pago"`. Al
>    clickearlo, crea una entrada en Notificaciones de Pagos (ver Fase F-5).
>    No hace falta que F-5 esté terminada; pero el endpoint/insert ya debe
>    funcionar (la tabla destino se llama `pagos_notificaciones` o similar —
>    decídelo y se reusa en F-5).
> 10. Cuando un vale se vincula a una liquidación, su status cambia a
>     `Asignado a Liquidación` automáticamente (trigger o lógica del frontend
>     dentro de una transacción).
>
> **Verificación visual obligatoria** contra `image35` e `image6`. No declares
> terminado hasta que coincida.

## Criterios de aceptación

- [ ] `build` y `lint` limpios.
- [ ] La liquidación tiene renglones editables; cantidad × precio_unit calcula
      el subtotal automáticamente.
- [ ] Selector múltiple de vales funciona; sumar el monto de vales muestra
      "Vale Recibido" correcto.
- [ ] "Diferencia" se calcula en vivo (total compras − vales).
- [ ] Liquidación creada desde un vale hereda el correlativo (mismo #### del
      vale, prefijo CC).
- [ ] La columna `vale.liquidacion_id` ya no existe.
- [ ] Listado coincide visualmente con `image6.png` (KPIs, columnas, pills).
- [ ] Vista imprimible coincide con `image35.png`.
- [ ] Al vincular un vale, su status pasa a "Asignado a Liquidación".

---

# FASE F-3 — Reintegros (vista de Dashboard, sin CRUD)

## Alcance

La sección Reintegros es **solo lectura** según el Excel: visualiza el
financiamiento de empleados a entidades vía "Vales a Entidad". Sin tabla nueva.

## Datos que consume

- Vales con `tipo='entidad'` (los "Vales a Entidad" de la Fase F-1).
- Agrupación: por empleado (el `liquidar_a_empleado_id`) y dentro de cada uno,
  por entidad (el `vale_a_entidad_id`).
- Sumatoria: total financiado por ese empleado a esa entidad; total general
  del empleado.

## UI

- **Dashboard por empleado:** una tarjeta por empleado con vales a entidad
  activos. Muestra cuánto ha financiado y a qué entidades.
- **Listado consolidado:** todos los empleados, suma global.
- Botones:
  - **`Reporte`** (en cada empleado): genera reporte PDF de sus vales y montos.
  - **`Ver`** (en cada vale): vista previa del vale, opción imprimir PDF
    (reusa la vista imprimible del Vale de Fase F-1).
  - **`Reporte Consolidado`** (en la lista global): PDF con todos.

## Auto-creación

Cuando se crea un "Vale a Entidad" en F-1, **automáticamente debe aparecer en
esta vista del empleado** correspondiente. No requiere acción adicional — es
solo una `query` filtrada.

## Instrucciones para Claude Code (copia este bloque)

> Estás en la **Fase F-3**: Reintegros — vista solo lectura. Referencias:
> `PLAN-FINANZAS-REFACTOR.md`, hoja "REINTEGROS" del Excel.
>
> 1. Crea `modules/finanzas/reintegros/` con vista de dashboard. **No crees
>    tablas nuevas, no crees CRUD.** Solo `hooks.ts` con queries que leen
>    vales con `tipo='entidad'`.
> 2. Vista principal: tarjetas por empleado, cada una mostrando vales a
>    entidad agrupados, sumatoria por entidad y total general.
> 3. Sección abajo: lista consolidada de todos los empleados con total global.
> 4. Botones: `Reporte` por empleado, `Ver` por vale (reusa la vista
>    imprimible de F-1), `Reporte Consolidado` para todo.
> 5. Diseño visualmente atractivo: KPIs grandes, números legibles,
>    consistencia con el resto del módulo (paleta teal/sand del proyecto).
>
> No toques otros módulos. Al terminar, confirma que un Vale a Entidad creado
> en F-1 aparece automáticamente aquí sin intervención.

## Criterios de aceptación

- [ ] `build` y `lint` limpios.
- [ ] Sin tablas nuevas; sin CRUD.
- [ ] Crear un "Vale a Entidad" hace que aparezca en el dashboard del empleado.
- [ ] Totales por empleado y consolidado correctos.
- [ ] Botones de reporte funcionan (PDF descargable).

---

# FASE F-4 — Consumos TC Corp (rediseño con dashboard de tarjetas)

## Alcance

Rediseñar el dashboard como **galería de tarjetas** (una imagen por TC
corporativa, fuente: catálogo `tarjetas_credito` tipo `corporativa`). Agregar
campos al consumo, line items, serial por empresa. Mockups: **image37.png** e
**image23.png** (vista de consumo).

## Cambios al modelo

```sql
-- Renombrar la sección no requiere cambio de tabla; sí campos:
alter table tc_consumos
  add column solicitado_por text,        -- puede ser persona/empleado/board
  add column solicitado_por_id uuid,     -- FK opcional a Empleados o personas
  add column no_autorizacion text,
  add column pagado_por text,
  add column empresa_codigo text;        -- para el prefijo del serial (AGRO, BANANERA...)

-- Renglones del consumo (igual idea que liquidacion_renglones)
create table consumo_renglones (
  id           uuid primary key default gen_random_uuid(),
  consumo_id   uuid not null references tc_consumos(id) on delete cascade,
  orden        int not null,
  descripcion  text not null,
  cantidad     numeric(14,2) not null default 1,
  precio_unit  numeric(14,2) not null,
  subtotal     numeric(14,2) generated always as (cantidad * precio_unit) stored
);

-- Serial por empresa: {CODE}-YYYY-####
-- Claude Code define la función que toma el codigo de la TC y el año
alter table tc_consumos
  add constraint consumo_serial_format check (voucher_num ~ '^[A-Z]+-\d{4}-\d{4}$');

-- Para el ícono de tarjeta personalizable
alter table tarjetas_credito
  add column color text;                 -- color del ícono del dashboard
```

## Dashboard de Consumos TC

Mockup implícito en el Excel (descripción + image37 muestra estilo).

- **Galería de tarjetas TC corporativas:** una "imagen" por cada registro de
  `tarjetas_credito` con `tipo='corporativa'`. La imagen muestra empresa,
  terminación, color custom.
- **Debajo de cada tarjeta**, dos botones:
  - `+ Nuevo Consumo` (abre form pre-llenado con esa TC).
  - `Estado de Cuenta` (genera reporte de consumos de esa TC; vista previa +
    descarga Excel).
- **Botón `+ TC CORP`** general arriba — abre form para crear una nueva
  tarjeta corporativa con selección de color.

## Form de consumo (mockup image23 / image37)

Campos:
- Fecha, Proveedor (dropdown), Tipo (TC Corporativa / TC-Reintegro / etc.),
  Autorizado Por (dropdown — ver nota Personal JD), **Solicitado Por**
  (Empleados + Board), **No. de Autorización** (texto), **Pagado Por** (texto).
- Tabla de renglones: Descripción, Cant., Precio Unit, Subtotal.
- Total.

## Vista imprimible (mockup image37 e image23)

- Header **púrpura-azul** (no teal — distintivo de TC corporativas).
- Empresa en grande, sub-línea con la TC y terminación.
- Serial: `AGRO-2026-0002` (en el ejemplo).
- Footer: `CEA · TC CORPORATIVAS · {SERIAL}`.
- Botón `Imprimir`.

## Instrucciones para Claude Code (copia este bloque)

> Estás en la **Fase F-4**: rediseño de Consumos TC Corp. Referencias:
> `PLAN-FINANZAS-REFACTOR.md`, mockups `image37.png` e `image23.png`.
>
> **Esquema:**
> 1. Migración nueva con los campos agregados a `tc_consumos`, la tabla
>    `consumo_renglones`, el `color` en `tarjetas_credito`, y el constraint
>    del nuevo formato de serial.
> 2. Función SQL que genera el serial `{CODE}-YYYY-####` usando el `empresa_codigo`
>    de la TC (los códigos: AGRO, BANANERA, VCC, SUREÑA — abreviar a 4-7 letras).
>
> **Frontend:**
> 3. Rediseño del dashboard de Consumos TC: galería de tarjetas (una por TC
>    corporativa del catálogo), con el color custom de la TC, los botones
>    `+ Nuevo Consumo` y `Estado de Cuenta` debajo de cada una.
> 4. Botón `+ TC CORP` arriba del dashboard que abre form para crear nueva
>    tarjeta corporativa con selección de color (color picker simple).
> 5. Form de consumo según mockup: cabecera con los 7 campos nuevos
>    (Solicitado Por, No. de Autorización, Pagado Por entre ellos), tabla
>    editable de renglones, total calculado.
> 6. Vista imprimible púrpura-azul según `image37.png` / `image23.png`.
> 7. `Estado de Cuenta`: reporte de los consumos de una TC, vista previa +
>    descarga Excel.
> 8. Botón **PAGOS** en cada consumo del listado: envía a Pagos > Notificaciones.
>
> **Verificación visual obligatoria** contra los mockups antes de declarar
> terminado.

## Criterios de aceptación

- [ ] `build` y `lint` limpios.
- [ ] Dashboard muestra una tarjeta por cada TC corporativa.
- [ ] Cada tarjeta tiene los dos botones funcionales.
- [ ] `+ TC CORP` crea tarjetas con color custom.
- [ ] Consumo tiene renglones editables y los 3 campos nuevos.
- [ ] Serial `{CODE}-YYYY-####` generado en servidor.
- [ ] Vista imprimible púrpura-azul, fiel a `image37.png`.
- [ ] Botón `PAGOS` crea entrada en notificaciones de Pagos.

---

# FASE F-5 — Pagos (rediseño con Notificaciones)

## Alcance

Rediseñar Pagos para que tenga un **panel de Notificaciones lateral** que
recibe automáticamente liquidaciones (con forma_pago = Solicitud de Pago) y
consumos TC enviados con el botón PAGOS. Mockups: **image24.png** (dashboard
con notificaciones), **image36.png** y **image29.png** (vista de SP con
timeline).

## Modelo

```sql
-- Tabla de notificaciones-bandeja para Pagos
create table pagos_notificaciones (
  id            uuid primary key default gen_random_uuid(),
  origen_tipo   text not null check (origen_tipo in ('liquidacion','consumo_tc')),
  origen_id     uuid not null,                 -- id de la liquidacion o consumo
  monto         numeric(14,2),
  resumen       text,                          -- texto corto para el panel
  procesado     boolean not null default false,
  pago_id       uuid references pagos(id),     -- cuando se convierte a SP
  created_at    timestamptz default now(),
  procesado_at  timestamptz
);

-- Ajustes a pagos
alter table pagos
  rename column estado to status;              -- Excel: "Cambiar nombre a la casilla de ESTADO a STATUS"
alter table pagos
  add column status_id uuid references status_solicitud_pago(id),
  add column origen_notificacion_id uuid references pagos_notificaciones(id);

alter table pagos
  add constraint sp_serial_format check (serial ~ '^SP-\d{4}-\d{4}$');
```

## Dashboard de Pagos (mockup image24)

Tres áreas:

1. **Panel `NOTIFICACIONES` (izquierda)** — lista compacta de:
   - Liquidaciones con forma_pago = Solicitud de Pago, no procesadas.
   - Consumos TC enviados con botón PAGOS, no procesados.
   Cada notificación muestra un thumbnail (mini-card del documento origen) y
   un botón `+ Nueva solicitud`.

2. **KPIs (arriba centro)** — conteo por status: Generado · En Solicitud de
   Firma · Firmado · Presentado · Procesado · Pagado.

3. **Listado de SP (abajo)** — cada SP con su **timeline visual** de 6 pasos
   (los completados en teal, los pendientes en gris). Botones por SP: ver,
   Firma, Pagado, Comprobante, editar, borrar.

## Form de nueva SP

Mockup: image36/image29.

- Status (dropdown del catálogo `status_solicitud_pago` creado en F-0).
- Tipo de Pago (dropdown ADMIN > Tipos de Pago).
- Entidad (dropdown ADMIN > Entidades).
- Proveedor (dropdown ADMIN > Proveedores).
- NIT (auto-llenado del proveedor seleccionado).
- Monto (manual).
- Asignar Consumo TC (dropdown opcional de consumos).
- Tipo de Cambio, % Anticipo (cuando aplica).

**Cuando la SP se crea desde una notificación**, se autorellena con los datos
del origen (liquidación o consumo) y guarda referencia a `origen_notificacion_id`.

## Vista imprimible (mockup image36, image29)

- Header teal con nombre del proveedor en grande, serial `SP-YYYY-####`,
  badges (Anticipo Con Factura, status).
- Monto en grande.
- Bloque de datos: Fecha, Entidad, NIT, Concepto, Referencia, Banco, Tipo de
  Cambio, % Anticipo.
- **FLUJO DEL PAGO**: timeline horizontal con 6 círculos, los completados en
  teal con fecha debajo, los pendientes en gris.
- Líneas de firma: Solicitado / Autorizado.
- Footer: "Board Assistant - Finanzas - Pago - {fecha} {hora}".

## Regla clave: PDF embebe origen

> "Cuando una +Nueva Solicitud se cree a partir de una Liquidación o Consumo de
> TC ubicada en NOTIFICACIONES, esta deberá de agregar la imagen del proceso
> que le dio origen a su PDF Final."

Implementación: cuando la SP tiene `origen_notificacion_id`, su PDF anexa la
vista imprimible del documento origen como segunda página/imagen embebida.

## Instrucciones para Claude Code (copia este bloque)

> Estás en la **Fase F-5**: Pagos con panel de Notificaciones. Es la última
> fase del refactor. Referencias: `PLAN-FINANZAS-REFACTOR.md`, mockups
> `reference/finanzas-mockups/image24.png`, `image36.png`, `image29.png`.
>
> **Esquema:**
> 1. Crea `pagos_notificaciones` según el plan.
> 2. En `pagos`: rename `estado → status`, agrega `status_id` (FK a
>    `status_solicitud_pago` creado en F-0), agrega `origen_notificacion_id`,
>    `tipo_cambio`, `pct_anticipo` si no existen, y el `check` del serial.
> 3. Verifica los triggers de `audit_log` siguen activos sobre `pagos`.
>
> **Frontend:**
> 4. Dashboard de Pagos según `image24`: panel `NOTIFICACIONES` lateral
>    izquierdo (con thumbnails + botón `+ Nueva solicitud` por entrada), KPIs
>    arriba (conteos por status), lista de SP abajo cada una con timeline.
> 5. Asegura que el botón PAGOS de Liquidaciones (F-2) y de Consumos TC (F-4)
>    inserta correctamente en `pagos_notificaciones`.
> 6. Form de nueva SP con todos los dropdowns indicados. Cuando se abre desde
>    una notificación, autorellena con los datos del origen y marca la
>    notificación como procesada al guardar.
> 7. Vista imprimible según `image36` / `image29`: timeline horizontal de 6
>    pasos, header teal, monto destacado.
> 8. PDF de SP creada desde notificación: anexa la vista imprimible del
>    documento origen como segunda página.
>
> **Verificación visual obligatoria** contra los 3 mockups.

## Criterios de aceptación

- [ ] `build` y `lint` limpios.
- [ ] Panel `NOTIFICACIONES` muestra liquidaciones (forma_pago=SP) y consumos
      enviados.
- [ ] `+ Nueva solicitud` en una notificación abre form autorellenado.
- [ ] Al guardar la SP, la notificación origen queda marcada como procesada.
- [ ] Vista imprimible de SP fiel a `image36` con el timeline visual.
- [ ] PDF de SP creada desde notificación lleva la imagen del origen anexa.
- [ ] Rename `estado → status` aplicado en base y UI.
- [ ] Serial `SP-YYYY-####`.

---

# Resumen de orden de ejecución

| Fase | Qué hace | Bloquea a |
|---|---|---|
| F-0 | Reestructurar tabs, nuevo catálogo Status SP | Todas |
| F-1 | Vales (+ Vale a Entidad) | F-2, F-3 |
| F-2 | Liquidaciones (renglones + muchos vales) | F-5 |
| F-3 | Reintegros (vista) | — |
| F-4 | Consumos TC con dashboard de tarjetas | F-5 |
| F-5 | Pagos con notificaciones (recibe de F-2 y F-4) | — |

Recomendación: ejecutar en orden numérico. F-3 puede hacerse después de F-1
en paralelo a F-2/F-4 si se quiere acelerar.

---

# Sobre el seed-catalogos.sql pendiente

Sigue válido para entidades, empleados, tipos de pago y tarjetas. La sección
de **autorizadores** queda anulada (se reemplaza por Personal JD si se aplica
ese plan). Cargar **antes** de la Fase F-4 (consumos TC necesitan las tarjetas
sembradas para el dashboard de cards).

# Sobre el Personal JD plan

No es bloqueante de este refactor — los dropdowns del Excel se refieren a
"Empleados + Board" como tablas separadas. Pero unificar bajo `personas` deja
"Autorizado por", "Solicitado por", "Reintegrar a" más limpios. Recomendación:
aplicar Personal JD **antes de F-2** para que los nuevos campos
(`solicitado_por_id`, `reintegrar_a_persona_id`) usen la FK correcta desde el
arranque.

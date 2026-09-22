# PLAN · T&T Dashboard inicial (Fase 21)

**Fuente:** `TT_Dashboard_inicial.docx` (2026-09-22) + las 6 imágenes de referencia que lo acompañan.
**Estado:** pendiente de aprobación del usuario. No se toca código hasta el GO.

---

## 1 · Objetivo

Dejar el dashboard de Arriaza T&T como lo describe el documento: un listado de viajes
visualmente atractivo desde el que se entra a **cada viaje en su propia pantalla** para
seguir construyéndolo como un carrito de compras, con calendario, mapa y carpeta de
viajes realizados a la vista.

**Lo que NO cubre esta fase:** los formularios internos de los 11 servicios (ya existen
y funcionan), el Itinerario Final, ni los impresos. Esta fase es el dashboard, la
pantalla del viaje y el formulario de creación/edición del viaje.

### Contexto que conviene no perder

El módulo ya está construido (Fase 19: 29 tablas `att_*`, ~10,300 líneas). Esta fase
**no lo reescribe**: cambia la navegación, amplía el modelo del viaje y rehace la capa
visual del dashboard. Los `api.ts`/`hooks.ts` de los 11 servicios se conservan.

---

## 2 · Decisiones ya tomadas por el usuario

| # | Decisión |
|---|---|
| 1 | **11 servicios**, no 14. Salen del menú Tiendas, Ruta en Google Maps y Puntos de Interés. Sus tablas **no se borran** — quedan por si vuelven. |
| 2 | **El mapa se queda como está** (Leaflet + CartoDB). Nada de Google Maps de pago. |
| 3 | Al hacer clic en un viaje, **se abre en pantalla nueva** con botón Regresar. |
| 4 | El calendario muestra además los **eventos de Presidencia** (miembro `MAA`). |
| 5 | País destino admite **varios países**; ciudades destino admiten **varias**. |
| 6 | Hay **paradas** (sub-destinos) con su propia fecha de inicio y fin. |
| 7 | **Bandera** del país junto al nombre del viaje. |

---

## 3 · Modelo de datos

### 3.1 · Lo que YA existe y solo hay que exponer en el formulario

Estas columnas están en `att_viajes` desde antes y nunca se mostraron:

| Columna | Uso en el documento |
|---|---|
| `paidby` | "Pagado por: espacio para escribir" |
| `notas` | "Notas del viaje: espacio amplio" |
| `other_reason` | El "Otros" del motivo del viaje |
| `proposito` | Motivo del viaje (pasa a ser Placer / Trabajo / Otros) |
| `trip_no` | Correlativo `TT-YYYY-####`, ya automático por trigger |
| `manual_status` | Solicitado / En planeación / En curso / Finalizado |
| `acompanantes` | Participantes |

**Ninguna requiere migración.** Es trabajo de formulario.

### 3.2 · Tablas nuevas

Las tres siguen el patrón del proyecto: PK uuid, FK a `att_viajes` con cascade,
`AuditCols`, `deleted_at`, RLS **Pattern A**, triggers `audit_trigger` +
`set_updated_at_with_by`, y se suman al soft-delete en cascada de `viajes/api.ts`.

**`att_viaje_paises`** — un viaje puede ir a varios países.
```
id uuid pk · viaje_id uuid fk · codigo text (ISO-2, ej 'GT') · nombre text · orden int
```
El de `orden = 0` es el **destino principal**: es su bandera la que sale junto al
nombre del viaje y su centroide el que marca el pin del mapa.

**`att_viaje_ciudades`** — ciudades destino, con botón "agregar".
```
id uuid pk · viaje_id uuid fk · nombre text · pais_codigo text null · orden int
```

**`att_viaje_paradas`** — sub-destinos con ventana de fechas propia.
```
id uuid pk · viaje_id uuid fk · nombre text · pais_codigo text null
fecha_ini date · fecha_fin date · orden int
CHECK (fecha_fin is null or fecha_ini is null or fecha_fin >= fecha_ini)
```

> **Por qué ciudades y paradas son tablas distintas:** el documento las pide como dos
> campos separados y solo las paradas llevan fechas. Si con el uso resulta que toda
> ciudad termina teniendo fechas, se fusionan en una sola tabla y se borra la otra.

### 3.3 · Qué pasa con `pais`, `ciudad` y `destino`

Se quedan en `att_viajes` como están, pero dejan de ser la fuente de verdad. La
migración copia su contenido a las tablas nuevas (`orden = 0`) para que los 2 viajes
que existen hoy no pierdan nada. Se marcan como **deprecadas** con un comentario SQL
y se eliminan en una fase posterior, cuando se confirme que nada las lee.

---

## 4 · Pantallas

### 4.1 · Dashboard (`/arriaza`)

Se conserva la estructura de la imagen 1, que ya es la que existe:

- **Hero** con el logo de Arriaza y los tres KPIs (viajes, en curso, próximos).
- **Toolbar**: buscador, filtro por estado, orden, compartir dashboard, respaldo.
- **Columna de viajes**: la tarjeta pasa a ser un **enlace a la pantalla del viaje**.
  Ya no despliega servicios en línea.
- **Aside**: calendario y mapa.
- **Carpeta Viajes Realizados** al pie (imagen 2), sin cambios.

**La tarjeta del viaje** muestra: bandera + correlativo + título, destino, rango de
fechas, participantes, motivo, costo total, estado editable y barra de progreso. Los
botones se reducen a Ver, Editar, Eliminar e Itinerario Final — el resto de acciones
vive dentro de la pantalla del viaje.

### 4.2 · Pantalla del viaje (`/arriaza/viaje/:id`)

Nueva. Es donde el viaje se construye.

- Encabezado con **botón Regresar**, bandera, correlativo, título y estado.
- Resumen del viaje: fechas, países, ciudades, paradas, participantes, motivo,
  pagado por, notas.
- **`+ Agregar Servicios`** con el desplegable de los 11 (imagen 4).
- Lista de servicios agregados, agrupados y colapsables (imagen 6), cada uno con su
  monto, estado de pago y acciones Ver / Editar / Eliminar.
- Costo total y progreso de planificación.

> **Por qué `:id` (uuid) y no `TT-2026-0009`:** el correlativo es más bonito en la URL
> pero puede venir nulo en viajes viejos y cambiar de formato. El uuid nunca falla. Si
> luego se quiere la URL legible, se agrega como alias sin romper la existente.

### 4.3 · Formulario de viaje (imagen 3)

Campos, en orden:

1. **Título del viaje** (requerido)
2. **No. de viaje** — solo lectura, muestra el correlativo que se va a asignar
3. **Fecha inicio / Fecha fin** (requeridas, fin ≥ inicio)
4. **Países de destino** — buscador con selección múltiple; se pintan como chips con
   bandera y se pueden reordenar. El primero es el principal
5. **Ciudades destino** — input + botón Agregar, se listan como chips
6. **Paradas** — filas con lugar, país opcional y sus dos fechas, con Agregar y Quitar
7. **Participantes**
8. **Motivo del viaje** — Placer / Trabajo / Otros; al elegir Otros aparece el texto libre
9. **Pagado por**
10. **Notas del viaje** — área amplia
11. **Guardar viaje / Cancelar**

### 4.4 · Calendario

Además de las fechas de viaje, carga los **eventos del miembro MAA (Presidencia)** de
la tabla `eventos`, en solo lectura y con color distinto. Sirve para no programar un
viaje encima de un compromiso de Presidencia.

---

## 5 · Migración

Un solo archivo: `supabase/migrations/20260922000004_fase21_viaje_destinos.sql`

1. `create table if not exists` de las 3 tablas.
2. Índices por `viaje_id` y por `deleted_at`.
3. RLS habilitado + Pattern A en las 3.
4. Triggers `audit_trigger` y `set_updated_at_with_by` en las 3.
5. Backfill desde `att_viajes.pais` / `.ciudad` a las tablas nuevas con `orden = 0`.
6. `comment on column` marcando `pais`, `ciudad` y `destino` como deprecadas.
7. `NOTIFY pgrst, 'reload schema';`

Se aplica con `node scripts/apply-sql.mjs`, que ya exporta el PAT del `.env`.

---

## 6 · Orden de trabajo

| Paso | Qué | Entregable |
|---|---|---|
| **F21-1** | Migración + types + api/hooks de las 3 tablas nuevas | Migración aplicada y verificada |
| **F21-2** | Formulario de viaje completo (§4.3) | Crear y editar un viaje con todos los campos |
| **F21-3** | Pantalla propia del viaje + ruta + Regresar (§4.2) | Navegación nueva funcionando |
| **F21-4** | Dashboard: bandera, tarjeta enlazada, menú de 11, calendario con MAA (§4.1) | Dashboard como la imagen 1 |

Cada paso termina con `tsc` y `vite build` verdes y su commit. Se sube a producción
solo cuando el usuario lo autorice.

---

## 7 · Banderas — RESUELTO: no van

Las banderas emoji no existen en las fuentes de Windows: donde debería salir 🇺🇸 el
sistema pinta las letras "US". Por eso las imágenes de referencia muestran un chip con
el código de dos letras — el HTML pide bandera, pero Windows la degrada.

La alternativa era traer imágenes de un CDN (`flagcdn.com`), lo que agrega una
dependencia externa. **El usuario decidió el 2026-09-22 dejarlo en el chip de dos
letras**: no es determinante para el trabajo.

El código ISO sí se guarda en `att_viaje_paises.codigo` y se deriva de la bandera del
catálogo con `isoFromFlag()`, así que si algún día se quieren banderas de verdad, el
dato ya está.

---

## 8 · Riesgos

| Riesgo | Mitigación |
|---|---|
| La pantalla nueva del viaje duplica lógica que hoy vive en `TripCard.tsx` | Se mueve, no se copia. `TripCard` queda solo como tarjeta del listado. |
| Los 2 viajes existentes pierden país/ciudad al cambiar el modelo | El backfill del paso 5 los copia antes de que nada deje de leer las columnas viejas. |
| Quitar 3 servicios del menú deja registros inalcanzables | Hoy no hay ninguno. Las tablas se conservan intactas por si vuelven. |
| El chunk de `/arriaza` crece y golpea el bundle | Ya es lazy. Se mide con `vite build` en cada paso; el tope es 145 KB gzip del inicial. |

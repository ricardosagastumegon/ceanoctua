# Plan · Módulo Aeronaves

Administración y control operativo de las aeronaves: documentación legal y permisos, horas de
vuelo, historial de mantenimientos, y los pagos que todo eso genera.

---

## 1 · El alcance, en claro

El rol aquí es **administrativo**, no técnico de mantenimiento. Eso define qué se construye y
qué no.

**Sí entra:**

- Documentación legal, permisos de aviación y sus vencimientos
- Horas de vuelo, que es lo que gobierna los pagos
- Historial de mantenimientos, para que exista registro de qué se hizo y cuándo
- Pagos y gastos de la aeronave
- Renta, si eventualmente se hace

**No entra, por decisión:**

- **Ciclos.** El control por ciclos no llega hasta este puesto. Todo se mide en **horas**.
- El cálculo de aeronavegabilidad componente por componente: vidas límite, TBO por motor,
  sección caliente. Eso lo lleva el taller.

Esto importa porque **simplifica el modelo a la mitad**. Sin ciclos y sin control de
componentes, el mantenimiento es un **historial** —qué se hizo, cuándo, a cuántas horas, cuánto
costó— y no un motor de cumplimiento. Es una decisión, no una carencia.

Si más adelante hiciera falta, agregar ciclos es una columna más en las lecturas y en el
registro de mantenimiento. No obliga a rehacer nada, siempre que el modelo no asuma que las
horas son lo único que existe.

## 2 · La flota y el plan piloto

| Matrícula | Aeronave | Cuándo |
|---|---|---|
| **TG-OBI** | Cirrus SR22T | **Primero.** Es el plan piloto |
| **TG-FLY** | King Air 300 | Después, según cómo funcione con el Cirrus |
| — | Helicóptero | Más adelante |

Se construye para varias aeronaves desde el primer día, pero se prueba con una. Si el sistema
resuelve bien los temas del Cirrus, se suma el King Air sin tocar el modelo.

## 3 · La navegación en capas

```
CAPA 1 · Dashboard general del módulo
         Resumen de toda la flota. Se construye AL FINAL, cuando ya
         haya con qué llenarlo.
             │
             ▼
CAPA 2 · La flota
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │   TG-OBI     │  │   TG-FLY     │  │  + Registrar │
         │ Cirrus SR22T │  │ King Air 300 │  │   aeronave   │
         └──────────────┘  └──────────────┘  └──────────────┘
             │
             ▼
CAPA 3 · La aeronave
         Ficha · Documentos · Horas de vuelo · Mantenimientos · Pagos
```

La información de cada aeronave queda **independiente pero en el mismo lugar**: se entra por su
botón y de ahí en adelante todo lo que se ve pertenece solo a ella. Nada se mezcla entre
aeronaves salvo en la capa 1, que es justamente la que compara.

**Rutas:**

```
/aeronaves              capa 1 · dashboard (mientras no exista, lleva a la flota)
/aeronaves/flota        capa 2 · los botones
/aeronaves/TG-OBI       capa 3 · la aeronave
```

La matrícula va en la dirección en vez de un identificador interno: es única, no cambia, y se
lee. `/aeronaves/TG-OBI` dice qué se está viendo.

## 4 · Orden de construcción

| Fase | Qué | Por qué ahí |
|---|---|---|
| **1** | Ficha, capa 2 y **documentos con vencimientos** | Es el riesgo más alto —un documento vencido deja la aeronave en tierra— y no depende de ningún otro dato |
| **2** | **Horas de vuelo** | Gobierna los pagos y le da contexto al mantenimiento |
| **3** | **Mantenimientos** | Ya se sabe a cuántas horas ocurrió cada trabajo |
| **4** | **Pagos y gastos** | Se enlaza con las tarjetas, igual que T&T |
| **5** | Renta | Necesita separar los vuelos por naturaleza |
| **6** | **Dashboard** (capa 1) y reportes | Al final, con todo el contenido ya existiendo |

## 5 · Fase 1 · Ficha y control de vencimientos

### `avn_aeronaves`

| Columna | Notas |
|---|---|
| `id` | uuid |
| `matricula` | único, no nulo. `TG-OBI` |
| `marca`, `modelo`, `serie`, `anio` | serie = número de fabricación |
| `categoria` | `avion` · `helicoptero` |
| `motorizacion` | `piston` · `turbohelice` · `turbina` |
| `motores` | cuántos |
| `base` | aeropuerto base |
| `propietario`, `operador` | |
| `asientos` | |
| `estado` | `operativa` · `en mantenimiento` · `fuera de servicio` |
| `color` | para distinguirlas de un vistazo, como los servicios de T&T |
| `foto_path`, `notas` | |
| `orden` | el orden de los botones en la capa 2 |
| timestamps + `deleted_at` | soft delete |

### `avn_tipos_documento` · el catálogo

Que sea catálogo y no texto libre permite dos cosas que a mano no se logran: que cada tipo diga
**con cuánta anticipación avisar** —un seguro no se avisa igual que una revisión bianual— y que
el sistema distinga **«está vencido»** de **«falta»**, que operativamente no es lo mismo.

| Columna | Notas |
|---|---|
| `nombre` | «Certificado de Aeronavegabilidad» |
| `codigo` | `COFA` |
| `vence` | hay documentos que no vencen |
| `dias_alerta` | cuántos días antes empieza a avisar. Por defecto 60 |
| `obligatorio` | si su ausencia es una falta y no solo un dato pendiente |
| `orden` | |

La semilla se define con el Excel. Lo que normalmente se controla: certificado de
aeronavegabilidad, certificado de matrícula, licencia de estación de radio, póliza de seguro,
peso y balance, certificado de ruido, registro de ELT, revisión pitot-estática y transponder, y
las suscripciones de bases de datos de navegación.

### `avn_documentos`

| Columna | Notas |
|---|---|
| `aeronave_id`, `tipo_id` | |
| `numero` | |
| `emision`, `vence` | `vence` nulo cuando el tipo no vence |
| `autoridad` | DGAC, aseguradora, taller… |
| `archivo_path` | PDF o imagen en Supabase Storage |
| `reemplaza_a` | apunta al documento anterior: deja el historial de renovaciones en vez de sobrescribirlo |
| `notas`, timestamps, `deleted_at` | |

### El estado se calcula, no se guarda

Un estado guardado se queda viejo solo con que pase el tiempo: el documento no cambió, cambió
la fecha.

```
vencido       vence < hoy
por vencer    vence <= hoy + dias_alerta
vigente       vence > hoy + dias_alerta
sin vigencia  el tipo no vence
faltante      el tipo es obligatorio y la aeronave no lo tiene
```

### RLS

Módulo nuevo `aeronaves` dentro del sistema de permisos de la fase 23:

```sql
create policy avn_aeronaves_read for select using (public.puede('aeronaves','observador'));
create policy avn_aeronaves_write for all
  using (public.puede('aeronaves','editor'))
  with check (public.puede('aeronaves','editor'));
```

Hay que agregar `aeronaves` al tipo `Modulo`, a `UsuariosCatalog` y a `TabsNav`.

### UI de la fase 1

- **Capa 2** · los botones grandes por aeronave, cada uno con su color, matrícula, modelo,
  estado y un aviso si tiene documentos vencidos o por vencer. Más el botón de registrar.
- **Capa 3** · la ficha de la aeronave y su tabla de documentos: estado, vencimiento, días
  restantes y el archivo adjunto. Alta, renovación y reemplazo de documentos.
- **Reporte imprimible** del estado de documentación, con la misma calidad que los documentos
  de T&T.

### Migración

`supabase/migrations/2026XXXXXXXXXX_aeronaves_fase1.sql` — las tres tablas con sus índices, RLS
con el patrón de arriba, triggers de `updated_at` y de `audit_log`, semilla del catálogo y
`NOTIFY pgrst, 'reload schema';` al final.

## 6 · Las horas y el costo de hora de vuelo

El OBI es el que más vuela: lo usa el board para trabajar. Pero **cuando alguien lo usa de
forma personal** —un miembro del board o alguien de la familia— se le saca un **costo de hora
de vuelo** y se le cobra.

O sea que esto no es control técnico de horas: es **recuperación de costo**. El vuelo tiene una
naturaleza, y solo la personal genera un cobro.

```
vuelo → naturaleza → si es personal → a quién se le cobra
                                    → horas × tarifa = lo que se le cobra
```

`avn_vuelos`: fecha, piloto, ruta, horas, horómetro inicial y final, **naturaleza**
(`board` · `personal` · `posicionamiento` · `mantenimiento` · `entrenamiento`), y cuando es
personal, **a quién se le cobra** y **cuánto**.

### La tarifa se guarda en el vuelo, no solo en la aeronave

Esta es la decisión que hay que tomar bien desde el principio.

Si la tarifa por hora vive únicamente en la ficha de la aeronave, el día que suba —y va a
subir, porque el combustible sube— **todos los vuelos pasados se recalculan solos** y lo que ya
se le cobró a alguien deja de cuadrar con lo que el sistema dice hoy.

Así que la tarifa se **captura en el vuelo**: la ficha de la aeronave propone la vigente, y el
vuelo se queda con la que se le aplicó. Es exactamente la misma lección del nombre de la
tarjeta en la liquidación de T&T, donde renombrar una tarjeta reescribía en silencio los
reportes de meses anteriores.

## 7 · Mantenimientos y pagos

**Mantenimientos** (`avn_mantenimientos`): a propósito **básico**. Fecha, horas de la aeronave
al momento, taller, tipo de trabajo, descripción, costo y factura adjunta. El formulario exacto
lo define el usuario cuando lleguemos a esa sección. Sirve como historial, no como control de
aeronavegabilidad.

**Pagos y gastos** (`avn_gastos`): combustible, mantenimiento, **remodelaciones**, **pintura**,
hangaraje, seguro, handling. Con la tarjeta con que se pagó, enlazado a `tarjetas_credito` igual
que T&T, para que el consumo de la aeronave caiga en los mismos reportes por tarjeta.

## 8 · Método

Igual que los servicios de T&T: **una sección a la vez**. Se construye, se revisa en pantalla,
se corrige, se cierra, y hasta entonces se pasa a la siguiente. El usuario entrega el formulario
o el documento de referencia de cada sección cuando toca.

## 9 · Pendiente de confirmar

1. **A quién se le puede cobrar** un vuelo personal. Los del board están en `personas`, pero la
   familia no. Hay que decidir si se amplía esa lista o si el vuelo lleva el nombre libre.
2. **Unidades.** Propongo horas en decimal (1.5 y no 1:30) y galones. Cambiarlo después es
   caro.
3. Los **tipos de documento** reales y sus días de aviso. El catálogo es editable desde la
   aplicación, así que se puede sembrar con lo estándar y corregir en pantalla.
4. Matrícula y modelo del helicóptero, cuando toque.

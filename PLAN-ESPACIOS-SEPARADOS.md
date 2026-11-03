# Plan · Espacios separados por usuario

> Estado: **borrador para decidir**. No se ha escrito una línea de código.

## Qué se pidió

Que CEA funcione «como cualquier app»: la Secretaria de Presidencia entra con su
propio usuario, ve **todos los módulos construidos pero en blanco**, y lo que ella
cargue **no lo ve nadie más** salvo que lo comparta explícitamente a través de la
app — por ejemplo, *enviar a firma de X persona*.

Pedido de la usuaria el 2026-11-03, con el ejemplo de Airbnb: la misma aplicación,
cada quien con su información.

## Por qué esto no es una función más

CEA está construido como **una organización con varios módulos**: los datos son de
la empresa y los permisos deciden quién entra a qué. Lo pedido es **varios espacios
independientes**, que es otra arquitectura.

El tamaño medido el 2026-11-03:

| | |
|---|---|
| Tablas en `public` | **98** |
| Políticas RLS | **191** |
| Secuencias de correlativos | **14** |

Cada tabla de movimiento tendría que saber de qué espacio es, cada política filtrar
por eso, y cada correlativo volverse una serie por espacio. No es una capa encima:
es el cimiento.

## Lo que ya está decidido

**Los catálogos se comparten.** Entidades (9), Personal JD (10), proveedores (10),
tarjetas (12) y empleados (34) son de la empresa, no de la persona. Si cada espacio
tuviera los suyos habría que recrear AGROATLANTIC y las tarjetas en cada uno, y dos
catálogos de lo mismo se desincronizan — que es el problema que acabamos de cerrar
con las tarjetas y con «quién paga» en las liquidaciones.

Lo privado son los **movimientos**: vales, liquidaciones, solicitudes de pago,
consumos, viajes, to-dos, firmas.

## Lo que falta decidir

### 1 · Los correlativos

`CC-2026-####`, `SP-2026-####`, `VL-2026-####`, `VCH-####` son series globales hoy.
Si dos espacios emiten contra la misma serie, los números se entreveran y ninguno de
los dos libros es continuo. Opciones:

- **Una serie por espacio** — cada quien tiene su CC-2026-0001. Correlativos limpios,
  pero dos documentos distintos comparten número y hay que decir de qué espacio es
  cada uno al leerlo.
- **Prefijo por espacio** — `CC-PR-2026-0001` para Presidencia. Inconfundible, pero
  cambia el formato que ya está impreso en documentos emitidos.

### 2 · Qué viaja cuando se comparte

«Enviar a firma de X» cruza un objeto de un espacio a otro. Hay que definir si viaja
solo la firma, o también la solicitud que la origina —para que quien firma vea qué
está firmando— y si quien recibe puede ver los documentos de respaldo.

Hoy la firma ya trae su justificación y su monto desde la solicitud. En un modelo de
espacios eso deja de ser automático y hay que concederlo.

### 3 · De quién es lo que ya existe

Los 17 CC, las 11 solicitudes, los viajes, los 40 consumos, los vales: todo pasaría
al espacio de Angeles. Es una migración de un solo golpe y sin ambigüedad, pero hay
que decirlo explícitamente.

### 4 · Qué pasa con el admin

¿El admin ve todos los espacios o también está encerrado en el suyo? Si ve todo,
«privado» quiere decir *privado entre pares*, no privado a secas. Es una decisión de
confianza, no técnica, y conviene dejarla escrita.

## Forma probable del modelo

- Tabla `espacios` y `espacio_id` en las tablas de **movimiento** (no en los
  catálogos).
- Una función `espacio_actual()` y políticas `espacio_id = espacio_actual()`, del
  mismo estilo que `puede(modulo, nivel)`.
- Una tabla de **concesiones** para lo compartido: qué objeto, de qué espacio, a
  quién, con qué permiso. Es lo que hace posible «enviar a firma» sin abrir todo.
- Correlativos por espacio.

## Riesgo principal

Un error en una política no se ve: simplemente alguien ve algo que no debía. Por eso
este cambio necesita, además del código, una **prueba por tabla** que verifique que
un usuario de otro espacio no lee ni escribe. Con 98 tablas, esa prueba es parte del
trabajo, no un extra.

## Lo que NO depende de esto

El caso de la **Gerente Administrativa** no necesita espacios: ella no carga
información propia, consume y firma. Se resolvió el 2026-11-03 con los permisos por
módulo que ya existían más la bandeja de firmas del Dashboard.

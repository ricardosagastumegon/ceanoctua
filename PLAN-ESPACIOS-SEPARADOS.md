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

---

## Actualización · 5 de noviembre de 2026

La usuaria volvió sobre el tema al diseñar el módulo de Combustible y el usuario del
Tesorero. Sus palabras:

> *«cada usuario es independiente, como ya te he dicho, yo no tendría porque ver lo que
> él tenga en su usuario ni lo que hace, lo mismo con el usuario de la Secretaria de
> Presidencia… podremos enviarnos y recibir documentos o avisos, pero cada quien en su
> rol y perfil.»*

### Lo que esto decide

**Pregunta 4 · «¿Qué pasa con el admin?» — contestada.** El administrador tampoco ve
los espacios ajenos. «Privado» es privado a secas, no privado entre pares.

Consecuencias que conviene tener escritas antes de implementarlo:

| | |
|---|---|
| El `audit_log` sigue siendo del admin | Queda el **rastro** de que algo pasó; no el contenido del espacio ajeno |
| Angeles no podrá ayudar a Victor con su caja chica | Un error suyo lo arregla él o nadie |
| Recuperar algo borrado sale de la app | Pasa a ser una operación contra la base de datos |

**Pregunta 2 · «¿Qué viaja cuando se comparte?» — hay respuesta concreta.** La tabla
`envios` que propone [PLAN-COMBUSTIBLE.md](PLAN-COMBUSTIBLE.md) §3.1 **es** la «tabla
de concesiones» que este borrador decía que haría falta, y resuelve el *qué viaja* de
la forma más simple posible: el envío lleva un `snapshot jsonb` con una copia congelada
de lo que el destinatario necesita ver. No se concede acceso al original.

Es mejor que conceder permiso sobre el objeto vivo, por dos razones: el destinatario
nunca toca la tabla ajena, y queda constancia inmutable de qué se le enseñó exactamente.

### Habitantes conocidos de los espacios

| Espacio | Persona | Estado |
|---|---|---|
| Angeles Quezada | Asistente de Gerencias | existe (es todo lo que hay hoy) |
| **Victor Murillo** | Tesorero General | se crea en la fase 45, ya aislado |
| **Zonia Orellana** | Asistente de Presidencia | pendiente; tendrá su propia caja chica |

### Hallazgo que esto destapó

Al verificar los permisos del Tesorero se comprobó que el rol `solo_lectura` concede
lectura sobre **seis tablas financieras completas**: `pagos`, `caja_chica_vales`,
`caja_chica_liquidaciones`, `tc_consumos`, `vouchers` y `reintegros`.

**Lissa Arriaza tiene hoy ese rol.** Su pantalla muestra sólo su bandeja de firmas,
pero su sesión puede leer por API todos los pagos, toda la caja chica y todos los
consumos de tarjeta. No es un fallo de implementación —es coherente con el modelo de
«una organización, permisos por módulo»— pero **sí contradice el modelo de espacios
independientes** que se quiere.

Por eso el usuario de Victor **no** se crea con `solo_lectura`. Se crea con un rol
nuevo que no concede nada de eso, y su bandeja se alimenta sólo de `envios`. Es el
primer usuario construido bajo el modelo nuevo.

Queda pendiente decidir qué se hace con el rol de Lissa cuando lleguen los espacios.

### El encuadre, en palabras de la usuaria · 5 nov 2026

Al autorizar la fase 45 dejó clara la intención, que es lo que de verdad resuelve la
pregunta 4:

> *«por privacidad NO me interesa ver lo que ellos ingresarían en tema de información…
> este sistema es para mí, y estoy dando acceso a las personas con las cuales tengo
> comunicación más frecuente para agilizar los procedimientos. En el camino les ayudo
> creándoles módulos para que ellos se faciliten el trabajo, pero no es algo que me
> concierna ni que deba de ver. Solo les estoy dando la herramienta.»*

Esto cambia la naturaleza del producto y conviene tenerlo presente al diseñar:

**CEA no es el sistema de una organización con varios usuarios. Es la herramienta de
una persona, que presta espacios a otras.** La dueña no es la administradora de los
datos ajenos; es la anfitriona.

Consecuencias de diseño que se siguen de ahí, y que ya no son discutibles:

1. **El aislamiento es el comportamiento correcto, no una restricción.** No hay que
   justificar por qué Angeles no ve la caja chica de Victor: es el propósito.
2. **Los costos listados arriba** —no poder auditar contenido ajeno, no poder arreglarle
   un error, tener que ir a la base de datos para recuperar algo— **son aceptados a
   cambio de la privacidad.** No son deuda a resolver después.
3. **Cada módulo nuevo que se construya «para alguien»** nace con dueño, no se le añade
   después.
4. **Lo único que cruza espacios es lo que alguien envía a propósito.** La tabla
   `envios` no es una comodidad: es la frontera.

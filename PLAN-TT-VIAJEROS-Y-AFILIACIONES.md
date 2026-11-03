# Plan · Viajeros y afiliaciones (T&T)

## Objetivo

Sacar de Excel la hoja «Afiliaciones y programas de aerolíneas» —números de viajero
frecuente, Porsche ID, correos de cada cuenta— y meterla donde se usa: el módulo de
Arriaza T&T.

Pero el Excel es el síntoma, no el problema. Hoy cada pasajero se escribe a mano en
cada ticket, y por eso la misma persona está cuatro veces con cuatro grafías:

| En los tickets | Veces | Números distintos |
|---|---|---|
| Miguel Angel Arriaza | 5 | **3 FFN distintos** |
| Miguel Arriaza | 3 | — (2 pasaportes) |
| Miguel Angel Arriaza Migoya | 1 | 1 |
| Patricia Esquivel / Patricia Maria Esquivel / Patricia María Esquivel / … Font | 7 | 3 distintos |

`att_ticket_pax.programa` está vacío en **todas** las filas, y en dos casos el
programa quedó metido dentro del número: `9008112501 DELTA`. El Excel y los tickets
son dos copias de la misma información, separándose una de otra.

Así que esto no es una tabla-copia del Excel: es el catálogo que los tickets
deberían haber tenido siempre.

## Modelo

### `att_viajeros` — la persona

El nombre como va en el pasaporte, el pasaporte con su vencimiento, la visa, las
nacionalidades, el correo y el teléfono. Es lo que hoy se reteclea en cada ticket.

### `att_programas` — el catálogo de programas

Nombre («American Airlines · AAdvantage», «Porsche MX»), `tipo`
—aerolínea / hotel / auto / otro, porque la hoja mezcla Porsche con American— y
`aerolinea_alias text[]`.

Ese arreglo de alias es la pieza que hace funcionar el enlace: `att_tickets.aerolinea`
es texto libre y dice «DELTA- KLM», «American Airlines» o «CONDOR AIRLINES». Con los
alias, el ticket encuentra su programa sin obligar a nadie a escribir igual.

### `att_afiliaciones` — una fila por viajero y programa

`numero` (el No. AAdvantage o el Porsche ID), `categoria` (el tier, si lo hay),
`email_cuenta`, `usuario` cuando el login no es el correo, y notas.
`unique (viajero_id, programa_id)`: una persona tiene un número por programa.

### Lo que NO se guarda

**Las contraseñas.** Decisión de la usuaria el 2026-10-29. Guardarlas en claro las
deja legibles para cualquiera que entre a la app, y además el trigger de auditoría
las copiaría a `audit_log` en cada edición: el secreto terminaría en más lugares que
en el Excel. Si algún día hacen falta dentro del sistema, van cifradas en el
navegador con una frase que nunca viaja al servidor, y eso es una fase propia.

### RLS y auditoría

Las tres tablas con el patrón de T&T: lectura `puede('tt','observador')`, escritura
`puede('tt','editor')`, triggers de `updated_at` y `audit_log`, borrado suave.

## UI

### La pantalla

Botón **«Viajeros»** en la barra del módulo T&T. Abre el catálogo con dos vistas:

- **Por persona** — cada viajero con su pasaporte y sus afiliaciones debajo. Es como
  se consulta cuando se está emitiendo un boleto.
- **Por programa** — agrupado como la hoja de Excel, para cuando se busca «quién
  tiene AAdvantage».

### El enlace con el ticket

En el formulario del ticket, el bloque de pasajeros gana **«Traer de Viajeros»**: se
elige la persona y se rellenan nombre, pasaporte, vencimiento y nacionalidades, más
el número de viajero frecuente **del programa que corresponde a la aerolínea de ese
ticket**, con su programa escrito en su propia columna en vez de dentro del número.

Lo capturado sigue siendo del ticket: una vez traído, se puede corregir sin tocar el
catálogo. Los tickets viejos no se tocan.

## Migración y orden de trabajo

1. `2026…_tt_viajeros.sql` — las tres tablas, índices, RLS, triggers, `NOTIFY`.
2. `src/types/database.ts`.
3. Módulo `src/modules/arriaza/viajeros/` con el layout del repo.
4. Carga del Excel: programas, viajeros y afiliaciones.
5. El enlace en el formulario del ticket.

Se puede parar después del 4 y seguir capturando pasajeros a mano: el catálogo ya
sirve de consulta y reemplaza el Excel. El 5 es el que deja de obligar a copiar.

## Fuera de alcance

- **Las contraseñas**, por lo dicho arriba.
- **Unificar los pasajeros ya capturados.** Las cuatro grafías de Miguel y las tres
  de Patricia se quedan como están: son lo que decía cada boleto el día que se
  emitió. El catálogo evita que sigan apareciendo nuevas.
- **Las imágenes del Excel.** La hoja trae logos pegados en algunas celdas; se
  ignoran al importar.

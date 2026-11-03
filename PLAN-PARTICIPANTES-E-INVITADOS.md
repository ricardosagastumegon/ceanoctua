# Plan · Participantes del viaje, catálogo de Invitados y lo que ve Lissa

## Objetivo

Tres cosas que vienen juntas porque dependen una de otra:

1. **Admin → Invitados.** Catálogo alimentable de quien viaja sin ser Personal JD:
   familia, socios, acompañantes.
2. **Participantes del viaje = lista desplegable** de Personal JD + Invitados, en
   vez de texto libre.
3. **Arriaza T&T de Lissa** muestra solo los viajes donde ella está como
   participante. En CEA solo ve TO DO.

El 3 depende del 2: hoy no hay forma de saber si Lissa va en un viaje, porque los
participantes son una cadena de texto.

## El problema, con los datos reales

Los 6 viajes guardan sus participantes en una sola columna de texto,
`att_viajes.acompanantes`, separados por coma. Lo que hay hoy:

| Viaje | Participantes |
|---|---|
| CRUCERO FAMILIAR | Miguel Angel Arriaza, Patricia Esquivel, Max Arriaza Safié, Javier Arriaza, Cristina Safié, Leah Arriaza, Mia Arriaza, Alejandro Arriaza, Lucía Martínez, Sofía Arriaza, Daniel Arriaza, **José Miguel Arriaza**, Paula Mohr Ihlen, Elisa Arriaza |
| PORSCHE Driving Experience MX | **Miguel Arriaza**, Patricia Esquivel, Rafael Mejicano, Carmen Beatriz de Mejicano |
| TOSCANA ITALIANA | Miguel Angel Arriaza, Patricia Esquivel |
| WACO TEXAS | **Miguel Angel Arriaza & Joseph Cohen** |
| MÉXICO Cumpleaños Amigos | Miguel Angel Arriaza, Patricia Esquivel |
| NEW YORK BODA | **Miguel Angel Arriaz**, Patricia Esquivel |

El presidente aparece escrito de cuatro formas distintas —*Miguel Angel Arriaza*,
*Miguel Arriaza*, *Miguel Angel Arriaz*, y pegado a otro con `&`—. Mientras los
participantes sean texto, ningún filtro por persona puede funcionar: es el mismo
problema que ya arreglamos en el libro de firmas.

## Modelo

### `invitados` — catálogo nuevo

Quien viaja sin ser Personal JD. Mismo patrón que `empleados` y `personas`:
borrado físico protegido por FK, `activo` para retirar sin perder historial.

```
id · nombre · relacion · empresa · telefono · email · notas · activo
```

`relacion` es texto libre —«Familia», «Socio», «Piloto»— y sirve para agrupar la
lista cuando crezca.

RLS **Patrón C · Catálogo**: lee cualquiera autenticado, escribe admin o
asistente. Igual que `personas`.

### `att_viaje_participantes` — quién va en qué viaje

```
id · viaje_id → att_viajes · persona_id → personas · invitado_id → invitados · orden
check: exactamente uno de persona_id / invitado_id
unique: (viaje_id, persona_id) y (viaje_id, invitado_id)
```

**No guarda el nombre.** Lo toma del catálogo al leer. Es a propósito y es lo
contrario de lo que hicimos con las tarjetas: un cargo a tarjeta es un recibo
cerrado y su etiqueta no se puede reescribir, pero la lista de quién va en un
viaje es un dato vivo —corregir «Arriaz» a «Arriaza» en el catálogo debe
corregirlo en los seis viajes, no dejar el error congelado.

### `acompanantes` se queda, como copia

Ocho pantallas leen `att_viajes.acompanantes` —la tarjeta del viaje, el
itinerario, la liquidación, lo que se comparte, el PDF, el dashboard—. En vez de
tocar las ocho, un trigger mantiene esa columna al día desde la tabla nueva.
Se vuelve un campo derivado: nadie lo escribe a mano.

Tres triggers lo sostienen:
- al agregar, quitar o mover un participante → recalcula ese viaje;
- al renombrar una persona de Personal JD → recalcula sus viajes;
- al renombrar un invitado → igual.

### Migración de lo que ya existe

Cada nombre de los 6 viajes se parte por coma **y por `&`** —WACO son dos
personas, no una—, se normaliza sin tildes ni mayúsculas, y se busca en Personal
JD. Los tres nombres mal escritos se mapean a mano al correcto. Lo que no
aparezca en Personal JD se da de alta en Invitados y queda ligado.

Resultado esperado: 4 personas de JD y ~17 invitados nuevos, sin perder ningún
nombre.

## UI

### Admin → Invitados
Pestaña nueva con el `CatalogPage` de siempre. Columnas: nombre, relación,
empresa, contacto.

### Viaje → Participantes
El campo de escribir libre pasa a ser un desplegable con dos grupos —**Personal
JD** e **Invitados**— más los chips de quienes ya van. Si alguien no está en
ninguno de los dos catálogos, se agrega como invitado desde ahí mismo, sin salir
del formulario: si hay que ir a Admin a media captura, nadie lo va a usar.

### Arriaza T&T
Para quien no es admin, la lista de viajes muestra solo aquellos donde su persona
de Personal JD está como participante. El dashboard **no** cambia: el resumen de
próximos viajes se queda viendo todos, como está hoy.

Esto es qué se le muestra, no un muro: los viajes siguen siendo legibles para
quien tenga el módulo, porque el mismo dato alimenta el resumen del dashboard.

### CEA
- La pestaña se llama **TO DO**, no «To-dos».
- Firmas, Notas de entrega, Lavandería y Directorio son el escritorio de la
  asistente: solo las ve admin o asistente. Lissa entra directo a TO DO.
- De paso, quien puede editar en CEA sale de `usuario_modulos` y no del rol
  base. Lissa tiene `cea:editor`, así que puede trabajar sus pendientes; hoy la
  pantalla se lo impedía aunque la base se lo permitía.

## Migración

`supabase/migrations/20261103000008_viaje_participantes.sql`

1. `public.sin_tildes(text)` — helper inmutable, también sostiene el índice único
   de invitados.
2. `invitados` + RLS + triggers de auditoría.
3. `att_viaje_participantes` + RLS + triggers de auditoría.
4. `att_sync_acompanantes(viaje)` + los tres triggers.
5. Backfill de los 6 viajes.
6. `NOTIFY pgrst, 'reload schema';`

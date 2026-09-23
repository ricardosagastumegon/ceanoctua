# PLAN · Accesos por módulo y CEA en el móvil

Pedido del usuario, 2026-09-23:

> Quiero poder dar acceso a CEA a mis jefes, pero seleccionar a qué módulo tienen acceso. Por ejemplo: MAA (Presidente) quiero que pueda ingresar desde su celular y ver T&T e ingresar a los viajes para ver todo, pero sólo eso.

Dos cosas: **permisos por usuario y módulo**, y **CEA usable desde el teléfono**.

---

## Lo que ya existe a favor

- El enum `app_rol` ya tiene cuatro roles: `admin`, `asistente`, **`board_member`** y **`solo_lectura`**. Los dos últimos están creados pero casi sin usar.
- `TabsNav` ya filtra pestañas por rol, y un `board_member` solo ve la pestaña de su propio miembro.
- `usuarios` ya enlaza con `miembro_id`, así que se sabe qué persona del board es cada quien.
- El `<meta viewport>` ya está puesto.

## Lo que hay que saber antes de decidir

**Hoy hay un solo usuario en toda la aplicación:** Angeles Quezada, como `admin`. No hay cuenta separada para el dueño.

**Esconder una pestaña no es seguridad.** La llave `anon` de Supabase viaja en el navegador y es pública por diseño; lo que de verdad protege los datos son las políticas RLS. Si a MAA solo se le oculta el menú de Finanzas, cualquiera con su sesión podría consultar esas tablas igual. Por eso los permisos por módulo **tienen que vivir en las políticas**, no solo en el menú.

El tamaño de eso: **77 tablas con RLS y 145 políticas**, de las cuales **97 mencionan `asistente`**. El módulo T&T son 35 tablas.

**La app no puede crear usuarios de login por sí sola.** Crear una cuenta en Supabase Auth requiere la llave `service_role`, que no puede vivir en el navegador. Hoy el proyecto no tiene backend propio (es una decisión del stack, en `CLAUDE.md`). Hay dos caminos y el usuario debe escoger — ver preguntas abajo.

---

## 1 · Permisos por usuario y módulo

### El modelo

Una tabla nueva, `usuario_modulos`:

| Columna | |
|---|---|
| `usuario_id` | → `usuarios.id` |
| `modulo` | `tt`, `finanzas`, `caja_chica`, `cea`, `miel_sj`, `admin`, y cada miembro del board |
| `permiso` | `observador` · `editor` · `super` |

Y una función `public.puede(modulo, permiso_minimo)` que las políticas consultan, igual que hoy consultan `auth_rol()`.

Los tres niveles:

- **Observador** — ve, imprime y descarga. No crea, no edita, no borra.
- **Editor** — todo lo anterior, más crear y editar. Es lo que hoy hace la asistente.
- **Super** — además puede borrar y administrar catálogos.

`admin` sigue por encima de todo: quien es admin no necesita fila en `usuario_modulos`.

### El trabajo real

Reescribir las políticas de los módulos que se abran, para que consulten `puede(...)` en vez de la lista fija de roles. **No hace falta tocar las 145 de una vez:** se empieza por las 35 tablas de T&T, que es lo que MAA necesita, y los demás módulos siguen como están hasta que se abran.

### La pantalla

En Admin, una sección **Usuarios**: la lista, el rol, y para cada uno las casillas de módulo con su nivel. Crear la cuenta de acceso es lo que depende de la pregunta de abajo.

---

## 2 · CEA en el móvil

Hoy la aplicación **no está preparada para el teléfono**. No es que falte un "modo móvil": es que el diseño asume pantalla ancha.

- La barra de pestañas es una sola fila de 14 pestañas. En un teléfono no cabe.
- La pantalla del viaje usa rejillas de dos y tres columnas.
- Las tablas de servicios y la liquidación son anchas por naturaleza.

### Qué se necesita

1. **Navegación adaptable** — en pantalla angosta, las pestañas pasan a un menú desplegable.
2. **Paso responsivo por las pantallas que MAA va a usar** — el listado de viajes, la pantalla del viaje, el itinerario. Las tablas anchas pasan a tarjetas apiladas.
3. **Instalable como app** — `manifest.webmanifest` con el ícono y el nombre, para que quede en la pantalla de inicio del teléfono y abra sin barra de navegador. Esto es lo que hace que se sienta una app y no una página.

Un *service worker* para uso sin conexión **no** entra por ahora: la app vive de datos en vivo y guardarlos en el teléfono de un directivo abre una conversación distinta sobre información sensible.

---

## Orden propuesto

1. `usuario_modulos` + la función `puede()` + políticas de T&T. Sin esto, lo demás es cosmético.
2. Pantalla de Usuarios en Admin.
3. Navegación adaptable + manifest.
4. Paso responsivo por las pantallas de T&T.

Cada paso se puede probar y subir por separado.

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

---

## Cómo entra el presidente · decidido el 2026-09-23

El usuario lo planteó así: *"no quiero que requiera autenticación directa con correo"*.

**La aclaración que resolvió la pregunta:** en Supabase el correo es el **nombre de usuario**, no un buzón. La cuenta se crea con una dirección interna que ni existe —`maa@noctuapo.local`— marcada como confirmada, y él nunca recibe ni abre nada.

**Lo elegido:** sesión permanente en sus dispositivos. Se le deja iniciada una vez en el teléfono y una vez en la tablet, se agrega a la pantalla de inicio, y de ahí en adelante abre el ícono y entra. Nunca ve un login.

- `persistSession` y `autoRefreshToken` quedaron explícitos en el cliente, aunque sean el valor por defecto: de eso depende que esto funcione y no se debe tocar sin saberlo.
- `Inicio` lo manda directo a T&T. El Dashboard le mostraría tarjetas vacías y errores de permiso, porque consulta tablas que no puede leer.
- **El riesgo real no es la contraseña sino el aparato.** Contra eso: solo ve T&T, solo lectura, y el acceso se revoca desde Admin en un clic o borrando el usuario.

**Registro abierto cerrado.** El proyecto tenía `disable_signup: false`, o sea que cualquiera con la llave pública podía crearse una cuenta. No era grave —un usuario nuevo nace sin módulos y no ve nada— pero no había razón para dejarlo abierto si las cuentas las crea el administrador.

### Qué pasa cuando todo se mueva a Azure

El usuario confirmó que **se mueve todo, incluida la base de datos**, a una VM interna de la empresa.

Eso cambia la autenticación de raíz: cuando Postgres deje de ser Supabase, `auth.uid()` y las políticas que lo usan necesitan otra fuente de identidad. La respuesta natural en ese escenario es **Entra ID (Azure AD)**: el presidente entra con la cuenta de la empresa, que en un teléfono corporativo suele estar ya iniciada, y es el área de sistemas quien da y quita el acceso.

**Lo que se hace hoy es deliberadamente temporal y reversible.** No se está construyendo un sistema de autenticación propio que después haya que desmontar: es una cuenta para una persona, con sesión guardada. Lo que **sí** sobrevive a la mudanza es el modelo de permisos —`usuario_modulos`, la función `puede()` y las políticas que la consultan—, porque no depende de cómo se autentique la gente sino de quién es. Al migrar solo cambia de dónde sale la identidad.

---

## El teléfono es personal, y es iPhone · 2026-09-23

Dos correcciones a lo escrito arriba, las dos del propio usuario.

**No es un teléfono corporativo, es personal.** Eso invalida el argumento de que con Entra ID «la cuenta suele estar ya iniciada»: en un aparato personal no lo está, y muchas empresas fuerzan re-autenticación periódica en dispositivos que no administran, que es justo lo que rompería el «nunca ve un login». Hay que confirmarlo con sistemas antes de dar ese camino por hecho.

**La aplicación se va a publicar hacia afuera** desde la VM de Azure, así que el teléfono personal sí podrá alcanzarla. Cuando llegue el momento: que se publique solo la aplicación, nunca el Postgres, y con certificado válido.

### El IMEI no se puede leer

El usuario propuso verificar el IMEI de sus aparatos. **Ningún navegador lo expone**, por privacidad, y hasta las apps nativas lo tienen bloqueado desde iOS 7. No hay forma.

Lo que sí cubre la intención: la sesión guardada **ya es** una credencial de ese dispositivo -- existe solo ahí, y nadie más puede crearse una cuenta desde que se cerró el registro. Lo que no puede es *reconocer* el aparato si alguien copiara esa sesión a otro.

### La tranca: Face ID

Se agregó WebAuthn con el autenticador de la plataforma. Al abrir, mira la pantalla y entra; no escribe nada. Se activa por dispositivo desde el candado de la barra superior.

**Lo que es y lo que no es.** Es una tranca local: protege contra quien levanta el teléfono desbloqueado, no contra quien lo conecta a una computadora y lee el almacenamiento del navegador, porque la sesión de Supabase sigue viviendo ahí. La defensa de fondo sigue siendo que ese usuario solo ve T&T en solo lectura y que el acceso se revoca desde Admin.

Si Face ID falla -- teléfono nuevo, sensor roto -- la pantalla ofrece cerrar sesión y entrar con contraseña, que la tiene el administrador. Nadie queda encerrado afuera.

### Instalar en iOS · el orden importa

En iOS, una aplicación agregada a la pantalla de inicio **no comparte el almacenamiento con Safari**. Iniciar sesión en Safari y luego agregar el ícono NO funciona: el ícono abre sin sesión.

El orden correcto es:

1. Abrir `cea.noctuapo.com` en **Safari**.
2. Compartir → **Agregar a pantalla de inicio**.
3. Abrir **el ícono nuevo**, no Safari, e iniciar sesión ahí.
4. Activar el candado de Face ID dentro de la aplicación.
5. Repetir lo mismo en el iPad: son dos almacenamientos distintos.

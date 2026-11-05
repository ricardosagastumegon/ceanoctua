# A · Arquitectura general

## 1 · Forma de la aplicación

CEA es una **SPA (single-page application) que habla directamente con Postgres a través de PostgREST**. No hay servidor propio, ni capa intermedia de API, ni lógica de negocio en un backend.

```
┌─────────────────────────────────────────────────────────┐
│  NAVEGADOR                                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ React 18 + Vite 5 + TypeScript (modo estricto)    │  │
│  │                                                   │  │
│  │  Router ──► Páginas (carga diferida)              │  │
│  │              └─► Secciones ──► Formularios        │  │
│  │                      │                            │  │
│  │              React Query (caché + estado servidor)│  │
│  │                      │                            │  │
│  │              cliente supabase-js                  │  │
│  └──────────────────────┼────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTPS · clave anónima + JWT
                          ▼
┌─────────────────────────────────────────────────────────┐
│  SUPABASE                                               │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Auth       │  │ PostgREST    │  │ Storage         │  │
│  │ (correo +  │  │ (REST sobre  │  │ (3 buckets      │  │
│  │  clave)    │  │  el esquema) │  │  privados)      │  │
│  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│        │                │                   │           │
│        ▼                ▼                   ▼           │
│  ┌───────────────────────────────────────────────────┐  │
│  │ POSTGRES 15                                       │  │
│  │  · 104 tablas, todas con Row-Level Security       │  │
│  │  · funciones de permiso SECURITY DEFINER          │  │
│  │  · triggers: auditoría, updated_at, derivados     │  │
│  │  · secuencias para correlativos de negocio        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**La consecuencia arquitectónica más importante de este diseño:** como no hay backend propio, **toda la seguridad real vive en la base de datos**. El código de React decide qué botones dibuja; quien decide qué datos salen y qué escrituras se aceptan es Postgres, mediante RLS. Un atacante con la clave anónima y un cliente HTTP puede saltarse por completo la interfaz, y eso está contemplado: la clave anónima es pública por diseño y lo único que la contiene son las políticas.

Para una revisión de seguridad esto significa que **auditar el frontend no sirve de nada por sí solo**. Lo que hay que auditar son las políticas RLS ([documento 08](08-AUDITORIA-Y-SEGURIDAD.md)).

---

## 2 · Tecnologías

Verificadas en `package.json` y en el código.

| Capa | Tecnología | Notas |
|---|---|---|
| Interfaz | React 18 | Sólo componentes de función; no hay componentes de clase |
| Empaquetado | Vite 5 | Build a estáticos; división de código por ruta |
| Lenguaje | TypeScript `strict` | Sin `any` por convención |
| Estilos | Tailwind CSS | Paleta propia: teal / sand / rust / gold / purple |
| Enrutado | React Router 6 | Carga diferida por página |
| Estado de servidor | React Query v5 | Única vía para datos asíncronos; no hay `useEffect` + `fetch` |
| Estado local | `useState` | No hay Redux, Zustand ni MobX |
| Backend | Supabase (Postgres 15) | PostgREST + Auth + Storage |
| PDFs | Componentes React + `window.print`, más `pdf-lib` y `html2canvas` | Sin servidor de PDFs; ambas librerías se cargan de forma diferida |
| Importación | SheetJS (`xlsx`) para binarios; analizador propio para CSV/TSV | |
| Despliegue | Vercel, dominio propio | Despliegue automático desde la rama principal |

**Deliberadamente ausentes** (declarado en las convenciones del proyecto y confirmado en el código): Next.js, Server Components, tRPC, Prisma, cualquier backend en Node/Deno/Python, acceso directo a Postgres desde el cliente, y las bibliotecas de componentes habituales (Radix, shadcn, MUI, Chakra).

---

## 3 · Organización del código

```
src/
├── app/                    # Armazón: router, layout, barra de navegación, login
│   ├── router.tsx          # 16 rutas, todas diferidas salvo el inicio
│   ├── Layout.tsx          # Marco común
│   ├── TabsNav.tsx         # Barra superior; decide qué módulos se ven
│   ├── Topbar.tsx          # Identidad y sesión
│   ├── Inicio.tsx          # Decide a dónde cae cada usuario al entrar
│   ├── Login.tsx
│   └── cargar.ts           # Envuelve los imports diferidos (ver §5)
│
├── components/ui/          # Componentes base reutilizables
│                           # DataTable, Modal, PrintableModal, TextInput,
│                           # Select, CsvImporter, ConfirmacionBoton…
│
├── lib/                    # Utilidades transversales
│   ├── supabase.ts         # Cliente único
│   ├── auth.tsx            # Sesión, perfil, función puede()
│   ├── createCrudHooks.ts  # Fábrica genérica de hooks CRUD
│   ├── dates.ts            # Fechas, días hábiles, vencimientos
│   ├── money.ts            # Formato monetario
│   ├── adjuntos.ts         # URLs firmadas de Storage
│   └── pdf-hojas.ts        # Composición de PDFs con adjuntos
│
├── modules/                # Un directorio por dominio funcional
│   ├── admin/              # Catálogos maestros + usuarios
│   ├── aeronaves/          # Flota, combustible, vuelos
│   ├── arriaza/            # Viajes (Arriaza T&T) — el módulo más grande
│   ├── caja-chica/         # Operación de caja chica
│   ├── cc-board/           # Vales y liquidaciones (consumido por Finanzas)
│   ├── cea/                # TO DO, firmas, notas de entrega, directorio
│   ├── dashboard/          # Tableros
│   ├── finanzas/           # Consumos TC, pagos, reintegros
│   └── miel/               # Miel SJ (módulo menor)
│
├── types/
│   ├── database.ts         # Tipos del esquema, mantenidos a mano
│   └── index.ts            # Tipos de aplicación: roles, módulos, permisos
└── main.tsx
```

**Tamaño relativo de los módulos** (número de archivos TypeScript):

| Módulo | Archivos |
|---|---|
| arriaza (viajes) | 164 |
| aeronaves | 29 |
| cea | 29 |
| finanzas | 27 |
| admin | 21 |
| cc-board | 12 |
| dashboard | 7 |
| caja-chica | 6 |
| miel | 5 |

El módulo de viajes concentra el 45 % del código de módulos. Es el dominio más rico: un viaje agrupa más de veinte tipos de servicio (vuelos, hoteles, restaurantes, tours, rentas, cruceros, actividades acuáticas, ferris, traslados terrestres, tiendas, reuniones…), cada uno con su propia tabla, formulario y vista imprimible.

---

## 4 · Patrón de módulo

Todo dominio bajo `src/modules/` sigue la misma estructura. Conocer una entidad es conocerlas todas:

```
modules/<dominio>/<entidad>/
├── api.ts          # Envoltorios de supabase.from(...): list, create, update, remove
├── hooks.ts        # useX / useCreateX / useUpdateX / useDeleteX (React Query)
├── XForm.tsx       # Formulario controlado; traduce entre estado de UI y fila de BD
├── XPrintable.tsx  # Vista imprimible (opcional, pero es el patrón preferido)
└── XSection.tsx    # Tabla + filtros + acciones + modales
```

La capa `hooks.ts` suele construirse con `createCrudHooks(tabla, api)`, una fábrica genérica que produce los cuatro hooks estándar y gestiona la invalidación de caché. Donde el comportamiento se sale del CRUD (por ejemplo, firmar un documento o alternar un pendiente) se escribe un hook a mano junto a los generados.

**Separación de responsabilidades observada:**

- `api.ts` no sabe de React.
- `hooks.ts` no sabe de presentación.
- `XSection.tsx` no habla con Supabase directamente.

Es consistente en todo el código revisado.

---

## 5 · Dos decisiones de arquitectura que conviene entender

### 5.1 · `cargar.ts` — el problema del despliegue sobre una pestaña abierta

Las 16 rutas se cargan de forma diferida. Al desplegar una versión nueva, los archivos con el nombre viejo dejan de existir; una pestaña abierta desde antes falla al navegar con *«Failed to fetch dynamically imported module»*.

`src/app/cargar.ts` envuelve cada import diferido: si falla, recarga la página una vez, con una marca en `sessionStorage` para no entrar en bucle. Es un parche deliberado y documentado, no un descuido.

### 5.2 · Los PDFs se arman en el navegador

No hay servicio de generación de documentos. Las vistas imprimibles son componentes React que se envían a `window.print`. Cuando hay que anexar comprobantes cargados por el usuario, `lib/pdf-hojas.ts` captura las hojas del DOM con `html2canvas` y las une con `pdf-lib` a los archivos traídos de Storage.

**Implicación para la revisión:** la fidelidad del documento depende del navegador del usuario. No hay una representación canónica generada en servidor.

---

## 6 · Cómo se relacionan las partes

```
            ┌──────────────┐
            │ Supabase Auth│
            └──────┬───────┘
                   │ sesión
                   ▼
            ┌──────────────┐     lee usuarios + usuario_modulos
            │ lib/auth.tsx │◄────────────────────────────────┐
            └──────┬───────┘                                 │
                   │ UserProfile { rol, modulos, persona_id }│
         ┌─────────┼─────────┐                               │
         ▼         ▼         ▼                               │
    ┌────────┐ ┌───────┐ ┌────────┐                          │
    │TabsNav │ │Inicio │ │Páginas │                          │
    │(qué    │ │(a     │ │(qué    │                          │
    │ pesta- │ │ dónde │ │ botones│                          │
    │ ñas)   │ │ cae)  │ │ dibuja)│                          │
    └────────┘ └───────┘ └───┬────┘                          │
                             │                               │
                             ▼                               │
                       ┌───────────┐                         │
                       │React Query│                         │
                       └─────┬─────┘                         │
                             ▼                               │
                       ┌───────────┐                         │
                       │ PostgREST │                         │
                       └─────┬─────┘                         │
                             ▼                               │
                       ┌───────────────────────┐             │
                       │ RLS: puede() /        │─────────────┘
                       │      auth_rol()       │
                       └───────────────────────┘
```

El perfil del usuario se carga una vez al iniciar sesión y alimenta tres decisiones independientes: qué pestañas se dibujan, a dónde cae el usuario al entrar, y qué acciones ofrece cada pantalla. **Las tres son cosméticas.** La decisión vinculante la toma RLS en cada consulta.

---

## 7 · Despliegue y entornos

| Aspecto | Estado |
|---|---|
| Producción | Dominio propio, despliegue automático desde la rama principal |
| Vista previa | URL temporal por cada despliegue |
| **Entornos separados** | **No existen.** Hay un único proyecto Supabase, que es producción |
| Migraciones | 88 archivos SQL versionados, aplicados con un script propio |
| Variables requeridas | URL del proyecto Supabase y clave anónima |
| Respaldos | Los automáticos de Supabase. No hay estrategia adicional |

**No hay entorno de pruebas.** Es el hecho más relevante para la petición de un entorno de demostración, y se desarrolla en [10](10-ENTORNO-DEMO.md).

Las migraciones son idempotentes (`if not exists`, `drop policy if exists`) y terminan en `NOTIFY pgrst, 'reload schema'` para invalidar la caché del esquema de PostgREST. El script de aplicación lo añade automáticamente, dos veces, como red de seguridad.

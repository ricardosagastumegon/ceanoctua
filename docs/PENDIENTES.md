# Pendientes · CEA NOCTUA

Lista viva de items **por hacer** que no bloquean la operación diaria pero merecen atención. Se actualiza al cierre de cada fase y al aplicar cualquier fix parcial.

Formato: cada item con **origen** (dónde se detectó), **impacto**, **estimado**, **estado**. Cuando se cierra, mover a la sección "✅ Cerrados" con la fecha y el commit.

---

## 🔴 Bloqueadores de producción (fix inmediato)

_(vacío al 2026-07-12 · el C-1 se resolvió en commit `895ad26`)_

---

## 🟡 Deuda técnica (agenda dentro de las próximas 2 fases)

> **Nota de numeración:** la sección «Deferred a polish futuro» del final usa su propia serie DT-5 a DT-8, de la Fase 19 y ya cerrada. Los items vivos de aquí siguen desde DT-10 para no chocar con ella.

### DT-28 · Los demás imprimibles siguen con la captura que tacha el texto

**Origen:** fase 59, al arreglar la solicitud de pago.

**Qué pasa:** html2canvas dibuja el texto más abajo de lo que le toca dentro
de su celda, así que **en toda celda con texto y `border-bottom` la raya le
pasa por encima**. Se probaron seis variantes de CSS —`vertical-align` middle,
bottom y baseline, `line-height` fijo, alto de fila fijo— y las seis salieron
tachadas: no hay arreglo por CSS.

La captura `fiel` (`<foreignObject>`, que rasteriza el navegador) lo resuelve y
**ya la usan las dos hojas de formato oficial**: solicitud de pago y control de
vales. Las demás —liquidación de T&T, crucero, vuelo, ticket, hotel…— siguen
con la clásica.

**Por qué no se cambiaron todas:** `foreignObject` no descarga recursos
externos, y Nunito y Montserrat vienen de Google Fonts. Las hojas oficiales
declaran Calibri/Arial en línea y no les afecta; las que visten con las clases
de la app **cambiarían de letra sin avisar**. Entre arreglar una cosa y romper
otra en silencio, se eligió documento por documento.

**Lo que lo cerraría:** incrustar las dos tipografías como `@font-face` con el
woff2 en base64 dentro del SVG. Entonces `fiel` podría ser el valor por
omisión para todo. Estimado ~1h, más una vuelta de verificación visual por
cada imprimible.

**Impacto:** cualquier imprimible con campos subrayados sale con los datos
atravesados al bajarlo con adjuntos. Solo afecta al PDF descargado, no a
`window.print()`.

---

### DT-27 · El chip «Ver SP» de combustible de aeronaves lee un solo enlace

**Origen:** fase 59, mirando `src/modules/aeronaves/combustible/api.ts` al
rastrear por qué `CB-2026-0005` seguía mostrando una SP borrada.

**Qué pasa:** la consulta resuelve la solicitud por
`pagos.origen_notificacion_id` únicamente — el lado «uno». Es exactamente el
mismo hueco que la fase 58 cerró en `pago_del_documento`. Hoy no se nota
porque cada registro de combustible manda su propio aviso y ninguna SP agrupa
dos. **El día que alguien agrupe dos registros en una SP, uno de los dos
pierde su chip** — sin error y sin aviso.

**Lo que lo arregla:** leer también por `pagos_notificaciones.pago_id`, igual
que `useLiquidacionesEnPagos`. Unas 5 líneas.

**Impacto:** cosmético hoy, degradación silenciosa mañana. Estimado 15 min.

---

### DT-26 · Borrar una SP no pregunta en qué paso iba

**Origen:** fase 59, al escribir `pago_borrar`.

**Qué pasa:** `pago_borrar` es tan permisivo como el update suelto que
reemplazó — borra una SP esté donde esté, incluso ya firmada, recibida por
tesorería o pagada. Se dejó así a propósito: la fase cerraba un hueco de
limpieza y **no era el momento de meter un candado nuevo** que ella no pidió y
que podría trabarla a mitad de una limpieza.

**Lo que habría que decidir con ella:** desde qué paso dejar de borrar y
empezar a *anular* — que es un acto distinto, con su nota y su rastro. Caja
chica ya tiene esa distinción; Pagos no.

**Impacto:** ninguno hoy (solo admin y asistente llegan al botón). Es una
decisión de producto pendiente, no un bug.

---

### DT-25 · El vale de caja chica no llega a «Solicitado» ni «Acreditado»

**Origen:** fase 55, al montar el ciclo del vale. La usuaria lo describió
entero y cuatro de los siete saltos quedaron automáticos; dos no.

**Lo que falta:** la pantalla para **mandarle un vale de dinero a Victor**. Sin
ella no hay acto que dispare `Solicitado` (al enviárselo) ni `Acreditado`
(cuando él confirma que entregó el dinero, en efectivo o transferencia).

**Lo que ya está listo y no hay que volver a tocar:** `envios` admite el
`doc_tipo = 'cc_vale'`, y `envio_despacho_cc_vale` está escrita y cerrada a
todo el mundo. `envio_aceptar` busca `envio_despacho_{doc_tipo}` y la llama si
la encuentra, así que **el salto a «Acreditado» se activa solo** el día que la
pantalla exista. Lo único que hay que construir es el envío.

**Cuándo:** ella lo encuadró así — «cuando terminemos el perfil de Victor ya
podremos finalizar eso». Va con su caja chica.

---

### DT-24 · Travel & Tours se ve entero, o no se ve

**Origen:** fase 51, al crear el usuario de Javier. La usuaria preguntó cómo se
había resuelto para Lissa, y la respuesta era que no se había resuelto: a Lissa
le aparece el viaje en el que participa **porque le aparecen los siete**.

**Dónde:** las **42 tablas** `att_*` tienen la misma regla de lectura —
`puede('tt','observador')`. No hay nada por fila. El tablero filtra los
próximos viajes **por fecha**, no por participación; coincide que el que sale
arriba es el suyo.

**Lo que ella quiere:** «solo poder ver completo un viaje con todos sus
servicios cuando él participe de estos viajes». Y para el tablero, a
propósito, lo contrario: que vea **todos** los próximos con nombre, fechas,
destino y participantes, «solo para estar enterada».

**Las piezas ya existen:** `att_viaje_participantes` (27 filas, 7 viajes) con
`persona_id`, y `usuarios.persona_id` ya enlaza —Javier y Lissa están ligados.
El patrón por persona ya se usa en los pendientes del tablero.

**Por qué no se hizo ya:** son 42 políticas, y antes hay que terminar «los
participantes de viaje seleccionando del catálogo con su información de viaje
agregada». Ella lo dijo explícito: **no urge**.

**Mientras tanto:** Javier NO tiene el módulo `tt`. Dárselo hoy sería darle los
siete viajes.

---

### DT-1 · Setup de vitest + primeros tests unitarios

- **Origen:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding M-2
- **Impacto:** Regresiones detectadas solo en manual QA. En una app con 30 migraciones y ~25 módulos, es riesgoso. El bug del bootstrap (C-1) hubiera sido detectado en un test.
- **Estimado:** 30 min para setup + 1 test del AuthProvider (garantiza que el timeout dispara + `loading=false` siempre). Luego, ir agregando tests por módulo conforme se toque.
- **Alcance mínimo aceptable:**
  - `vitest` + `@testing-library/react` como devDeps
  - `src/lib/auth.test.tsx` con 3 casos: (a) bootstrap OK, (b) bootstrap con timeout, (c) `loadProfile` throws
  - Script `npm test` en `package.json`
  - CI opcional (fuera de alcance mínimo)
- **Estado:** Pendiente. Agendar **antes de F19-1**.

### DT-2 · 27 de 30 migraciones históricas sin `NOTIFY pgrst`

- **Origen:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding M-1
- **Impacto:** Ninguno práctico (ya están aplicadas hace tiempo, el cache está fresh). Solo relevante si se re-aplican por rollback + apply de una migración vieja sin usar `scripts/apply-sql.mjs`.
- **Estimado:** 0 min (no vale la pena tocar). La regla ya está codificada en `scripts/apply-sql.mjs` que auto-appende `NOTIFY`. Toda migración nueva escrita a partir de fase 18 termina con `NOTIFY pgrst, 'reload schema';`.
- **Estado:** Aceptado como deuda documentada. No hacer.

### DT-3 · `att_pins` deprecada pero aún viva

- **Origen:** [`docs/REPORTE-ESTADO-TT-ACTUAL.md`](REPORTE-ESTADO-TT-ACTUAL.md) §3.5 · comentario de fase 8
- **Impacto:** Ninguno funcional (nadie la usa, no está en types). Cosmético: 1 tabla + 1 índice + 1 policy RLS + 1 audit_trigger (post F19-0) consumiendo un slot en `pg_tables`.
- **Estimado:** 15 min · migración `drop table if exists public.att_pins`.
- **Estado:** Aceptar por ahora. Dropear cuando estemos ciertos de que nadie tiene planes de usarla (F19-5 · itinerario final decidirá si el mapa necesita pines por-servicio en vez de por-viaje).

### DT-23 · Cinco tablas vacías del módulo board, y `kit_items`

- **Origen:** fase 42, al retirar los tableros por miembro.
- **Qué son:** `tareas`, `viajes`, `viaje_checklist`, `perfiles`,
  `perfil_vehiculos`, `perfil_fechas`, `perfil_familia`, `notas`, `eventos`
  — todas con **cero filas** — más `kit_items`, que además no la toca ni una
  línea de código.
- **Impacto:** ninguno operativo. Sí suman superficie: diez tablas con RLS
  que mantener y diez entradas en `src/types/database.ts`.
- **Por qué no se borraron ya:** un `drop table` no se deshace, y el código
  se retiró el mismo día. Conviene dejar pasar un tiempo con el sistema en
  uso antes de quitarlas.
- **Ojo:** `miembros_board` **no** entra aquí. Tiene siete filas vivas y de
  ella cuelgan `firma_miembros` (firmas digitales) y `usuarios.miembro_id`.
- **Estimado:** una migración de 15 min, más regenerar los types.
- **Estado:** Pendiente. Revisar a partir de **diciembre 2026**.

### DT-22 · Aeronaves · lo que depende de terceros queda en pausa

- **Origen:** 2026-11-03 · decisión de la asistente al cerrar el estado de
  cuenta de Aeroclub.
- **Qué se pausa:** **Mantenimientos** (fase 3 del plan) y seguir alimentando
  la **bitácora de vuelo** (fase 36, ya construida pero con un solo vuelo
  capturado).
- **Por qué:** esa información no la genera ella. Los mantenimientos los
  lleva el taller y las horas las reporta el piloto, así que diseñar el
  formulario antes de ver cómo se lo entregan es inventar campos. El módulo
  sigue por el lado administrativo, que sí está en sus manos.
- **Para retomarlo:** hace falta el documento o la hoja con que el taller
  reporta un trabajo, y el formato en que el piloto entrega sus horas.
- **Estado:** En pausa, no cancelado. La bitácora de vuelo ya funciona; solo
  está esperando datos.

### DT-21 · `ConfirmacionBoton` está copiado nueve veces

- **Origen:** Fase 40 · al agregarle el botón de «Ver» a los adjuntos de T&T.
- **Impacto:** el mismo componente --subir un archivo y avisar que ya está--
  vive duplicado en los nueve formularios de servicio, idéntico salvo el
  color y el nombre de la función que sube. Cada arreglo hay que hacerlo
  nueve veces, que es justo lo que acaba de pasar.
- **Estimado:** 40 min · un solo componente en `arriaza/shared` que reciba la
  función de subida y los colores del servicio. Sin riesgo de datos: es
  puramente de pantalla.
- **Estado:** Pendiente, sin urgencia. Hacerlo cuando toque tocar esos
  formularios por otra razón.

### DT-19 · Los 12 invitados migrados están «Por clasificar»

- **Origen:** Fase 39 · al pasar los participantes de texto a catálogo.
- **Impacto:** cosmético hoy, útil mañana. Los 12 invitados que salieron de los
  seis viajes entraron con relación `Por clasificar` porque nadie puede
  adivinar desde el dato si «Cristina Safié» es familia o socia. Cuando la
  lista crezca, el desplegable de participantes se vuelve una pared de nombres
  sin la relación que los agrupe.
- **Estimado:** 10 min de la asistente en Admin → Invitados. No es trabajo de
  código.
- **Estado:** Pendiente · depende de ella, no del desarrollo.

### DT-20 · La gerente no figura en ningún viaje

- **Origen:** Fase 39 · al filtrar Arriaza T&T por participación.
- **Impacto:** su Arriaza T&T se ve vacío y parece roto. No lo está: en los
  seis viajes que hay, ella no es participante. Quien viaja hoy es Miguel
  Angel Arriaza (6), Patricia Esquivel (5), y José Miguel, Javier y Alejandro
  (1 cada uno).
- **Estimado:** nada que programar. Se resuelve agregándola a un viaje, o
  confirmando que así debe verse.
- **Estado:** Avisado. Confirmar con ella antes de tratarlo como un bug.

### DT-17 · Cinco catálogos sin trigger de auditoría

- **Origen:** Fase 38 · se descubrió al agregarle el trigger a `tarjetas_credito`.
- **Impacto:** `entidades`, `personas`, `empleados`, `proveedores` y `tipos_pago` no escriben en `audit_log`. Renombrar un proveedor o cambiar el NIT de una entidad no deja rastro de quién ni cuándo, y esos datos viajan a documentos que se entregan. La Regla 0 dice que toda mutación queda registrada; estas cinco no cumplen. `tc_consumos`, `vehiculos` y ahora `tarjetas_credito` sí.
- **Estimado:** 15 min · una migración con cinco `create trigger … execute function public.audit_trigger()`. Sin riesgo: el trigger solo escribe, no valida nada que pueda rechazar un insert existente.
- **Estado:** Pendiente. Vale la pena hacerlo junto con el próximo cambio que toque Admin, para no abrir una fase por esto solo.

### DT-18 · El `card_id` de los consumos es texto libre

- **Origen:** Fase 38 · la galería de TC mostraba menos consumos de los que hay.
- **Impacto:** `tc_consumos.card_id` guarda el nombre de la tarjeta escrito a mano y no coincide siempre con el catálogo: hay una fila que dice «TC Visa Term. 8694» por «Visa Term. 8694» y otra con la terminación vieja de una tarjeta repuesta («…7274» por «…4771»). La pantalla ya no depende de ese texto —agrupa por `tarjeta_id`—, pero el texto sigue ahí y el importador de CSV lo vuelve a llenar a mano.
- **Estimado:** el arreglo de fondo es dejar de capturar `card_id` como texto y derivarlo de `tarjeta_id` al mostrar. Son dos formularios y el importador. Medio día.
- **Estado:** Pendiente, sin urgencia: la lectura ya está corregida. Lo que falta es que no se sigan creando filas desalineadas.

### DT-15 · El puente de Consumos Varios a Finanzas

- **Origen:** Fase 37 · decisión de la usuaria el 2026-10-29 («después, en otra fase»).
- **Impacto:** el consumo queda registrado en el viaje y entra en su liquidación, pero para **solicitar el reintegro** hay que volver a teclearlo en Finanzas · Consumos TC. Es el único paso manual que queda del flujo.
- **Estimado:** botón «Enviar a Consumos TC» que cree la fila en `tc_consumos` desde el registro del viaje. Dos cuidados: esa tabla exige `proveedor` (iría «VARIOS» o el nombre del viaje) y hace falta marcar `origen = 'T&T'` + el id del registro para que el gasto no se cuente dos veces entre la liquidación del viaje y el reporte de Finanzas.
- **Estado:** Agendado. Hacer cuando ella haya usado la sección un par de veces y sepamos cómo la ocupa de verdad.

### DT-16 · El enum `currency` no tiene CHF

- **Origen:** Fase 37 · los viajes a Zúrich.
- **Impacto:** `currency` es `USD / GTQ / EUR / GBP`. Un consumo en francos suizos no cabe hoy en **ninguna** tabla del sistema, no solo en Consumos Varios: se tiene que convertir a mano y se pierde el número original. No ha mordido todavía porque los reportes han venido en euros.
- **Estimado:** 10 min de migración (`alter type public.currency add value 'CHF'`) **más** los 7 formularios de T&T que llevan la lista de monedas escrita a mano (`'USD', 'GTQ', 'EUR', 'GBP'`). Esa repetición es el verdadero costo: conviene sacarla a una constante compartida en el mismo cambio.
- **Estado:** Pendiente. Hacer cuando aparezca el primer reporte en francos.

### DT-10 · Las hojas por servicio en el documento único de la liquidación

- **Origen:** [`PLAN-TT-LIQUIDACION.md`](../PLAN-TT-LIQUIDACION.md) · pedido del usuario 2026-09-23
- **Impacto:** El botón «Descargar completa» junta la liquidación y el itinerario. Faltan las hojas que el sistema genera para cada servicio (ticket, hotel, etc.), que el usuario pidió incluir. No es bloqueante: las hojas se pueden imprimir una por una desde su 👁.
- **Por qué no se hizo aún:** cada hoja vive dentro de su propio modal, así que hay que montarlas y capturarlas en secuencia. Es un mecanismo aparte del que ya funciona y se prefirió no meter algo frágil al documento que el usuario archiva.
- **Estimado:** 2-3 h.
- **Estado:** Pendiente.

### ~~DT-11 · Liquidación por período, cruzando viajes~~ ✅

Cerrado el 2026-09-24 en la Fase 25. Botón **Liquidación por período** en la barra de T&T:
rango de fechas, todos los viajes, agrupado por tarjeta. Usa `coalesce(fecha_cargo, fecha
del servicio)`. Los servicios sin ninguna fecha se listan aparte en vez de desaparecer.

### DT-14 · «Monto total de compra» sale vacío en la solicitud de pago

- **Origen:** prueba del flujo de combustible, 2026-09-24. El circuito completo funciona hasta generar la SP; solo ese campo del PDF oficial no se llena.
- **Dónde:** `SolicitudPagoPrintable.tsx` lo toma de `pago.cotizacion`, que existe en el formulario pero **no se prellena desde ninguna notificación** — ni las de combustible ni las de caja chica o tarjetas. Hoy hay que escribirlo a mano en la SP.
- **A decidir antes de arreglarlo:** si «monto total de compra» debe igualar el monto del pago cuando no hay una cotización mayor de por medio, o si de verdad es un dato aparte que siempre se captura. No es obvio y define si se prellena solo o se marca como obligatorio en el formulario.
- **Impacto:** cosmético en el PDF, pero es un documento oficial que se firma.
- **Estado:** pendiente. Es del módulo de **Finanzas**, no de Aeronaves — el usuario lo dejó explícitamente para después.

### ~~DT-15 · Llevar los cargos adicionales a los servicios que faltan~~ ✅

Cerrado el 2026-09-28, el mismo día que se abrió. Los **diez servicios** con costo tienen ya
el editor de cargos: ticket, hotel, restaurante, renta, tour, aeronave, acuático, ferry,
terrestre y actividades. El cableado quedó en el hook `useCargosDeServicio`, así que cada
formulario son tres líneas.

Queda `att_hotel_services` sin uso, redundante con `att_cargos`. Dropear cuando se confirme
que nadie la lee.

### DT-12 · `att_reuniones.cita` y `.asunto` deprecadas

- **Origen:** migración `20260923000010`
- **Impacto:** Ninguno. Son del port de la Fase 19; el documento de Reuniones pide `titulo` y `descripcion`. `cita` dejó de ser `NOT NULL` para que se pueda guardar una reunión nueva.
- **Estimado:** 10 min · `drop column` cuando se confirme que el modelo nuevo funciona en producción.
- **Estado:** Deprecadas con comentario en la tabla.

### DT-13 · Dos componentes de chips conviviendo

- **Origen:** fase 22 · `shared/ChipsInput.tsx`
- **Impacto:** Cosmético. `TicketFormModal` conserva su `ListaChips` local, casi idéntico al `ChipsInput` compartido que usa Actividades. Se dejó así para no tocar un formulario que el usuario ya está usando sin problemas.
- **Estimado:** 10 min · cambiar los dos call sites del ticket a `ChipsInput` con `mono` y borrar el local.
- **Estado:** Pendiente. Hacer cuando se toque el formulario de ticket por otra razón.

### DT-4 · Actualizar `usuarios.nombre` de todos los usuarios con NULL

- **Origen:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding M-3
- **Impacto:** Estético — topbar renderiza `null` en el nombre.
- **Estimado:** 1 SQL UPDATE por usuario afectado. Al 2026-07-12 solo Angeles (`ff19eebc-d239-446e-92f7-4210fa67a60f`).
- **Script listo:** [`supabase/scripts/fix-usuarios-nombres.sql`](../supabase/scripts/fix-usuarios-nombres.sql)
- **Estado:** Pendiente que el usuario lo aplique en Supabase Studio.

---

## 🟢 Housekeeping / mejoras de proceso

### HK-1 · Skills propios de NOCTUA en `.claude/skills/`

Los 4 skills existentes (`apply-migration`, `sync-schema`, `check-rls`, `audit-cea`) están OK. Idea futura si aparecen patrones repetitivos:

- **`bootstrap-fix`** — auto-diagnóstico del "Cargando…" (comprobar env vars + getUser + loadProfile + audit_log) por si el bug del C-1 reaparece en otra forma
- **`gen-service-module`** — generador para F19-1..F19-5: dado un nombre de servicio, crea `services/<name>/api.ts`, `hooks.ts`, `<Name>Form.tsx`, `<Name>Printable.tsx` con el pattern estándar

### HK-2 · Validación end-to-end pendiente de F19-0

- **Origen:** F19-0 fase actual
- **Qué falta:**
  1. Confirmar que el fix C-1 dejó la app cargando bien (después del deploy de `895ad26`)
  2. Aplicar `fix-usuarios-nombres.sql` (DT-4)
  3. Prueba real del soft-delete: crear viaje test-soft-delete + hijos → borrar → validar `deleted_at` + `audit_log`
- **Estado:** Pendiente que el usuario lo valide. Sin esto no cerramos F19-0 y no arrancamos F19-1.

### ~~HK-3 · Fix permanente del webhook GitHub→Vercel · usar Deploy Hook~~ ✅

Cerrado el 2026-08-07 en commit `b3b5802`. Setup ejecutado:
- Vercel Deploy Hook creado: `https://api.vercel.com/v1/integrations/deploy/prj_kdnc2WS0hHmZdnMI5RKJdVjdez0u/n04ti0SrEf`
- GitHub webhook id `662696047` apuntando a esa URL, event `push`, active
- Delivery test confirmada: `status: OK`, latencia 4.59s

Ya no depende de GitHub App de Vercel ni de OAuth tokens múltiple-cuenta. Redundante con el webhook viejo (ambos coexisten).

---

## Fase actual en curso

**Fases 21, 22 y 23 · CERRADAS** el 2026-09-23.

- **21 · Dashboard T&T** — el viaje se arma en su propia pantalla, con resumen en números y el riel de la ruta ordenado por hotel → tour → parada → vuelo.
- **22 · Servicios** — los **11 servicios** reconstruidos uno por documento, cada uno con su formulario, su PDF, su color y su aporte al total del viaje.
- **23 · Liquidación** — cada servicio apunta a su tarjeta, se puede cancelar con reintegro total o parcial, y el viaje se liquida con el consumo por TC.

Lo que sigue: DT-10 de arriba (DT-11 cerrado el 2026-09-24). Ver [`docs/BITACORA.md`](BITACORA.md).

## Deferred a polish futuro (no bloquean uso)

### DT-5 · 14 Printables (vistas imprimibles por servicio) ✅ 10/14 hecho

- **Origen:** F19-3d — el HTML standalone tiene una vista imprimible tipo "boarding pass" por cada servicio con logo Arriaza + gradient + total.
- **Estado:** ✅ 10/14 servicios nuevos tienen printable end-to-end (commit `14f5ceb`) usando `ServicePrintable.tsx` shared. Falta portar tickets/hoteles/restaurantes que usan CatalogPage.
- **DT-5b** — printables para tickets/hoteles/restaurantes (los legacy con CatalogPage). Estimado ~2h.

### DT-6 · Share modal WhatsApp (html2canvas) ✅ HECHO

- **Estado:** ✅ Cerrado en commit `17fec49`. `ShareModal.tsx` con tarjeta pre-renderizada + html2canvas lazy (48 KB gzip chunk propio). Botón 📲 en cada TripCard.

### DT-7 · Calendar interactivo lateral ✅ HECHO

- **Estado:** ✅ Cerrado en commit `17fec49`. `CalendarPanel.tsx` con auto-pick del mes activo + navegación ‹ ›, celdas coloreadas por trip-start/mid/end + ring hoy. Renderizado en aside sticky de AttPage.

### DT-8 · Skill `check-rls-full` para monitoreo semanal ✅ HECHO

- **Estado:** ✅ Cerrado en commit `17fec49`. Skill `.claude/skills/check-rls-full.md` + script `supabase/scripts/check-rls-full.sql` con 3 reportes (RLS off + policies, RLS on sin policies, ambos off) + resumen. Correr semanalmente en Supabase Studio.

### DT-9 · Import backup: mapping completo de servicios en BackupModal UI

- **Origen:** F19-3f MVP.
- **Impacto:** El botón "Importar JSON" solo importa metadatos del viaje. Los servicios (14 tipos) requieren usar el skill.
- **Workaround actual:** invocar el skill [`import-tt-backup`](../.claude/skills/import-tt-backup.md) con el path del JSON. El skill genera un `.sql` con INSERTs completos para las 20 tablas att_*. El usuario aplica el SQL en Supabase Studio y refresca. Este flujo es más robusto que un botón UI porque:
  1. Se puede revisar el SQL antes de aplicarlo
  2. Errores parciales se ven en el output de SQL Editor
  3. La conversión JSON→SQL en cliente sería lenta para backups grandes
- **Estimado si se hace UI-side:** ~3h (portar la lógica del skill a TypeScript). Actualmente diferido a demanda.

---

## ✅ Cerrados (histórico corto)

| Fecha | ID | Cerrado en commit |
|---|---|---|
| 2026-11-08 | **DT-26** · la liquidación del piloto no salía hacia Pagos | Fase 57 · migración `20261108000002` |
| 2026-09-24 | **DT-11** · liquidación por período, agrupada por tarjeta | Fase 25 · sin migración |
| 2026-09-24 | **Restablecer contraseña** · no había ninguna ruta de recuperación en la app | Fase 24 · `1ea07a7` |
| 2026-09-23 | **Fase 22 completa** · los 11 servicios de T&T, uno por documento | commits `4385d58..0edf09f` · 10 migraciones |
| 2026-09-23 | **Fase 23** · liquidación de viaje y consumo por tarjeta | commits `5371982..321ca00` · migraciones `...011` y `...012` |
| 2026-09-23 | **Itinerario general vacío** · `.match({deleted_at:null})` nunca devolvía filas | `d7f8bc1` |
| 2026-09-23 | **PDF en varias hojas** · `visibility:hidden` dejaba el hueco de la página | `c676d8f` |
| 2026-09-23 | **DT-5** · drop de `att_actividad_tickets` y `att_actividad_subtickets` (vacias) + limpieza del codigo | migración `20260923000009_drop_actividad_tickets.sql` |
| 2026-08-09 | **F19 completa** · T&T con 14 servicios + backup + itinerary + docs | commits `b347470..683abd3` (~7500 LOC, 40+ archivos) |
| 2026-08-09 | **INCIDENTE RLS 34 tablas** · re-enable + ADR D-021 | migración `20260813000002_fix_rls_reenable.sql` |
| 2026-08-09 | **C-1 v4** · auth con timeout + auto-nuke storage | `2bf31cd` fix(auth) · ADR D-020 |
| 2026-08-09 | **M-3** · Angeles.nombre corregido | aplicado por usuario en Supabase |
| 2026-08-09 | **DT-4** · usuarios.nombre NULL fix | mismo aplicado por usuario |
| 2026-08-07 | **HK-3** · Deploy Hook manual GitHub→Vercel | `b3b5802` chore(test) · webhook id 662696047, delivery OK 4.59s |
| 2026-08-07 | **C-1 · getSession() cuelga forever** · validado por usuario | `895ad26` fix(auth) — reemplazo por getUser() · app cargando OK |
| 2026-07-12 | **F19-0** · Regla 0 compliance att_* | `1a767d0` feat(arriaza) + `b7ff827` fix defensivo previo |
| 2026-07-11 | **Fase 18** · Catálogo Vehículos | `6a5f343` feat(admin) |

---

**Última actualización:** 2026-09-28 · cierre de DT-15. Actualizar cada vez que se cierre un item o se agregue uno nuevo.

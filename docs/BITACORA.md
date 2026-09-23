# Bitácora · CEA NOCTUA

Registro cronológico de cambios de fondo. **No es un changelog** (para eso está `git log`), es el diario de decisiones y contexto de cada fase. Cada entrada explica **por qué** más que **qué**.

Formato: `## Fase N · YYYY-MM-DD · Título` seguido de bullets Objetivo / Cambios / Comentarios.

---

## Fase 23 · 2026-09-23 · Liquidación de viajes y consumo por tarjeta

**Objetivo:** que cada viaje pueda liquidarse para reporte financiero, con el detalle por servicio y —lo que de verdad pedía el usuario— cuánto consumió cada tarjeta. Plan en [`PLAN-TT-LIQUIDACION.md`](../PLAN-TT-LIQUIDACION.md).

### El hallazgo que definió el diseño (`5371982`)

Antes de escribir el reporte, la pregunta obvia: ¿se puede sumar por tarjeta? **No se podía.** `pagado_con` guardaba el **texto** que el desplegable armaba en el momento (`tc_id · red · banco · titular`), no una referencia a la tarjeta. En la base había tres valores para dos tarjetas:

```
Amex GT Term. 2345                                 (huérfano)
Mastercard  Term. 5907 · BAC · Miguel A. Arriaza   (con banco y titular)
TC MAA                                             (nunca estuvo en Admin)
```

El primero quedó huérfano **ese mismo día**: el catálogo decía `Amex GT Term. 2345` por la mañana y `Amex GT Term. 864` por la tarde, porque el usuario editó esa tarjeta mientras trabajábamos. Los servicios se quedaron apuntando a un nombre que ya no existía. La falla que se estaba describiendo en abstracto ocurrió en vivo.

`20260923000011` agregó `pagado_con_id` a los diez servicios con costo y enlazó los cinco registros existentes; los dos huérfanos los resolvió el usuario (ambos son la Amex de Guatemala). El desplegable ahora muestra Presidencia primero y guarda las dos cosas: el texto que se ve y la llave que suma.

### Cancelación con reintegro (`c242e05`)

El usuario lo planteó al preguntarle qué pasa con un servicio cancelado: *"cada servicio debería de tener un botón que al cancelar pregunte si se tiene un reintegro total, o parcial"*.

**`monto` no se toca.** Es lo que se le cargó a la tarjeta y así queda. Lo que volvió va aparte en `reintegro`, y el que suma al viaje es el neto. Guardar las dos cifras y no solo la resta es lo que permite cuadrar contra el estado de cuenta, que muestra un cargo y, por separado, un abono.

Cancelar tampoco borra: un servicio con reintegro parcial costó la diferencia y tiene que verse en el reporte.

`fecha_cargo` se agregó en la misma migración, aparte: cuándo se cobró la tarjeta, que puede ser meses antes del viaje. La liquidación del viaje **no** filtra por fechas —lleva todo lo del viaje, se haya comprado cuando se haya comprado—, pero el reporte por período que viene sí la va a necesitar.

### La hoja (`cb617c1`, `8f36d03`, `7c6ced3`, `791732c`)

Un renglón por servicio sin detalle —no van pasajeros, ni habitaciones, ni números de ticket— y debajo el consumo de cada tarjeta. Tres columnas de dinero y no una: cargo, reintegro y neto.

**Lo que no se puede identificar se agrupa aparte,** marcado «sin identificar», en vez de repartirse mal y ensuciar el total de otra tarjeta.

**El riesgo que descubrió una pregunta del usuario:** *"si en algún momento se hace modificación de algún número de TC o nombre, ¿el cambio se verá a partir de ese cambio?"*. Como la hoja resolvía el nombre contra el catálogo al imprimir, editar una tarjeta **reescribía todas las liquidaciones pasadas**. Una impresa en agosto decía una cosa y reimpresa hoy diría otra. Ahora usa el nombre tal como se guardó ese día —el texto siempre estuvo ahí, solo no se usaba— y sigue agrupando por la llave. Además, editar el identificador de una tarjeta con consumos avisa que conviene crearla aparte: una renovación son dos plásticos y los cargos viejos salieron en el estado de cuenta del anterior.

El documento único (`791732c`) junta liquidación e itinerario en un PDF armado con `pdf-lib`, porque `window.print()` imprime una sola cosa. El contenido del itinerario salió de su modal a `ItinerarioHojas` para poder montarlo fuera de pantalla y capturarlo. Ambas librerías se cargan solo al generar: el bundle inicial no se movió.

**Incidente propio (`321ca00`).** Al agregar las confirmaciones al documento puse `confirmacion_path` en las columnas comunes de las diez consultas. `att_tickets` no tiene esa columna —guarda sus archivos en `pdf_boleto_path`, `pdf_boarding_path` y `pdf_sat_path`—, así que la consulta falló y con ella toda la liquidación. Peor: el fallo **no se veía**, la hoja se quedaba en «Armando la liquidación…» indefinidamente. Ahora el error se muestra con botón de reintentar y la consulta no reintenta en silencio. El usuario después pidió sacar sus archivos del documento, lo que eliminó la causa de raíz.

**Pendiente:** las hojas que genera el sistema para cada servicio dentro del documento único (requiere montarlas y capturarlas en secuencia), y la liquidación por período cruzando viajes por tarjeta.

---

## Fase 22 · 2026-09-22 → 2026-09-23 · T&T Servicios, uno por documento

**Objetivo:** reconstruir los 11 servicios del viaje según los documentos Word que el usuario escribe para cada uno. **Cerrada: los 11 quedaron hechos.** Planes en [`PLAN-TT-TICKET-AEREO.md`](../PLAN-TT-TICKET-AEREO.md), [`PLAN-TT-TOURS-AERONAVE-ACUATICO-FERRY.md`](../PLAN-TT-TOURS-AERONAVE-ACUATICO-FERRY.md) y [`PLAN-TT-TERRESTRE-ACTIVIDADES.md`](../PLAN-TT-TERRESTRE-ACTIVIDADES.md).

**Ritmo acordado:** un documento por servicio → comparar contra el esquema real de la base → listar huecos y decisiones → migración → código → revisar en pantalla → commit → el usuario autoriza el push y lo revisa en producción.

### Ticket Aéreo (`b8f77fb`, `cc070d3`)

**Hallazgo:** el ticket que había era el de la Fase 13, pensado para control migratorio — vencimiento de pasaporte, libreta, visa, programa de viajero. El documento pide equipaje, tarifa y extras por pasajero, escalas y varios PNR. Casi nada existía, así que fue rehacer el modelo, no agregar campos. Había 0 tickets, riesgo nulo.

Migraciones `20260922000006` y `...007`: 16 columnas nuevas en `att_tickets`, `ruta`/`fecha_llegada`/`tiempo_vuelo` en los segmentos, equipaje y tarifas en los pasajeros, más `att_ticket_pnrs` y `att_segmento_escalas`.

**Decisiones:**

- **El total es Σ(tarifa + extras) por pasajero, sin multiplicar.** El documento dice "por el número de pasajeros" pero su propia imagen aclara "1 pasajero — suma de tarifa + extras". Multiplicarlo duplicaría el monto.
- **Un formulario, una pasada.** El anterior obligaba a guardar el ticket antes de poder agregarle un pasajero. `full-api.ts` expone `load` y `save`: `save` reconcilia el árbol completo contra la base. Mismo patrón que los destinos del viaje.
- **Tipo de pasajero es selección múltiple** (AD/CHD/INF/SSA) a propósito: un adulto puede además requerir asistencia especial.
- **Bucket `tt-documentos` propio** para los PDF del módulo. El usuario pidió que no se mezclen con los comprobantes de Finanzas; separarlos por bucket y no por carpeta hace que la separación la imponga la política de la base y no la disciplina de quien sube el archivo.
- **Nacionalidades ISO alfa-3** (GTM, USA, MEX) — las del pasaporte, no las de dos letras del destino. El catálogo se generó cruzando la lista oficial ISO con los 214 países del módulo; ninguno quedó sin código.

**Corrección propia:** al principio usé `estatus_pago` para el desplegable, pero en los otros diez servicios `estatus_pago` es la nota libre ("Depósito 50% pagado") y `estado_pago` el desplegable. El documento del hotel confirmó esa división y se corrigió el ticket en `20260922000008`.

### Hotel (`b085129`)

El hotel ya traía habitaciones múltiples y servicios extras desde la Fase 19. Faltaban teléfono, early check-in, estado de pago, comentarios y el adjunto de confirmación.

**Unificación de vocabulario:** el hotel guardaba "reservado a través de" en `ota` y "pagado con" en `pay`; el ticket los llama `reservado_por` y `pagado_con`. Con once servicios por construir, que cada uno bautice lo mismo distinto obliga a recordar el sinónimo en cada printable. Se agregaron las columnas con el nombre común y se copió el dato de la única fila existente.

**Estado de pago unificado:** las cinco opciones del documento del ticket (HOLD, PAGO PARCIAL, CONFIRMADO, CANCELADO, ABIERTO) más `A PAGAR EN PROPIEDAD`, que es un estado real de los hoteles que esa lista no cubría. El CHECK se puso **solo** en tickets y hoteles: los otros nueve conservan su lista vieja hasta que les toque su documento, porque ponerles la restricción ahora invalidaría datos sin revisar.

### Transversales (`9e03608`, `74d6061`, `da2e8e8`, `56f2844`)

- **Vista previa con logo** en `ServicePrintable`, que sirve a los 11 servicios. Antes armaba el encabezado con `innerHTML` y un helper que devolvía un placeholder de texto, porque el logo real nunca se había incorporado. Ahora es JSX con la imagen importada.
- **Los servicios entran solos al itinerario.** `useItineraryEvents` recoge los 11 tipos con fecha. Hasta ahora el Itinerario Final solo mostraba lo escrito a mano en el plan del día: un vuelo reservado no aparecía. Los vuelos entran **por segmento** y no por ticket, porque un ida y vuelta con escalas son varios movimientos en días distintos; los servicios con dos extremos aportan dos eventos.
- **El PDF del ticket se rediseñó** tras la revisión del usuario: la ruta pasó de línea de texto a pase de abordar, con los códigos IATA grandes y el tiempo de vuelo bajo el avión. Los datos de referencia se apretaron a cuatro columnas sin subrayados y el equipaje pasó a íconos dentro de la tabla.
- **Buscador de nacionalidades** en vez del `<select multiple>` nativo, que obligaba a desplazarse por 214 países y a saber que se elegía con Ctrl.

**Trampa de UI que costó un dato real:** los campos de chips (PNR, ciudades, participantes) perdían en silencio lo escrito si el usuario guardaba sin presionar "Agregar". El PNR del primer ticket real se perdió así. Ahora los chips también se agregan al salir del campo.

### Restaurante (`6aba8b1`)

Las tres sub-tablas que pide el documento — comensales, servicios adicionales y registros de pago — ya existían desde la Fase 13. Se agregaron once columnas y las dos condicionantes: Michelin con estrellas, y cancelación gratuita con fecha límite y aviso de cercanía (amarillo a cinco días, rojo el día que vence).

**Decisión:** el número de comensales sale de la lista de nombres, no de un campo aparte. El documento pedía ambos, pero dos fuentes llevan a "4 personas" con tres nombres cargados.

De paso, `att_restaurant_diners` estrenó `updated_at`: era la única sub-tabla del módulo sin marca de modificación.

### Renta de Vehículo (`05c1bd4`, `599c801`)

La reserva ya estaba completa desde la Fase 19. Lo que faltaba era el desglose del vehículo — marca, modelo, tamaño, capacidad, puertas, transmisión y combustible —, que sin columnas propias habría vivido dentro del texto libre `tipo_veh`.

Los días se calculan de recepción a entrega pero quedan editables: unas rentadoras cobran por día calendario y otras por 24 horas, así que manda el número del contrato.

**Incidente · dos restricciones a la vez.** Al unificar el estado de pago pregunté si existía `att_rentas_estado_pago_chk`. No existía, así que la creé — pero la de la Fase 19 se llama `..._check`, con la lista vieja. Quedaron ambas activas y ninguna fila podía cumplirlas: el usuario no pudo guardar. Corregido en `20260922000011`.

> **Para los servicios que faltan:** `att_tours`, `att_aeronaves`, `att_acuaticos`, `att_ferries`, `att_terrestres` y `att_actividades` todavía tienen su `*_estado_pago_check` viejo. Al unificar cada uno hay que **buscar la restricción por su definición, no adivinar el nombre**, y borrar la vieja en la misma migración.

### El diseño de los imprimibles (`0c88397`, `4f2939d`)

Tres rondas de correcciones del usuario hasta dar con un patrón que funciona, y que queda como referencia para los siete servicios restantes:

1. **Rótulos como chip** con fondo del color del servicio. El texto gris sobre blanco se perdía, y el chip vuelve innecesarios los subrayados que saturaban.
2. **Panel con cabecera de color** para el bloque que describe el objeto del servicio: el vehículo, las habitaciones, los pasajeros, los comensales.
3. **Dos tarjetas lado a lado para los dos momentos** del servicio: recepción y entrega, check-in y check-out, reserva y límite de cancelación. Esos datos salen de la rejilla superior para no repetirlos.

El usuario lo resumió así sobre la hoja de renta: *"me gusta como separaste la información del vehículo, y abajo las fechas están fenomenal"*.

**Trampa de tipos que costó una reparación.** Al editar `src/types/database.ts` delimité el bloque de `att_hoteles` usando `att_hotel_habitaciones` como final, suponiendo que iba a continuación. Está 800 líneas más abajo, así que la edición abarcó once tablas y les inyectó columnas de hotel. `tsc` no se queja: campos opcionales de más no rompen nada hasta que alguien los usa. Se reparó calculando el límite real de cada bloque — del marcador de la tabla al siguiente marcador — y auditando **cada** columna agregada ese día.

### Tours, Aeronave, Acuático y Ferry (`4385d58`, `f7915b4`, `9e9ae09`, `e0950c3`, `ec34b10`)

Cuatro servicios en un documento. Las cuatro tablas venían del port de la Fase 19 **vacías**, así que cambiar restricciones no tenía riesgo.

Les faltaba lo mismo a las cuatro: `monto` —sin ella el servicio aporta cero al total—, `moneda` y `confirmacion_path`. Y las cuatro arrastraban el `*_estado_pago_check` viejo, que esta vez **sí** se buscó por definición y se borró en la misma migración, como quedó anotado tras el incidente de la renta.

**Dos cosas que el documento pedía y el esquema no tenía:** el nombre del tour (`att_tours.nombre`, distinto del prestador que lo opera) y, en el ferry, la tercera opción de «Servicio para». La restricción solo aceptaba `Personas` y `Vehículos`; el documento pide también `Persona & Vehículo`, así que un ferry mixto no se habría podido guardar.

Acuático y ferry son el mismo servicio con otro casco: comparten los bloques del PDF y el selector OW/RT, que pasó a pintarse con el color de quien lo monta.

### Traslado Terrestre y Actividades (`6c2e726`, `6f2a810`, `8966851`)

El terrestre en **terracota**, pedido explícitamente en el documento; antes era un gris azulado que no lo distinguía de nada. Su total multiplica por personas y suma extras, distinto de acuático y ferry.

**Decisión de modelo en Actividades.** Existían `att_actividad_tickets` y `att_actividad_subtickets` del port viejo, ambas vacías, que ponen tarifa y extras **por bloque de participante**. El documento ponía el precio a nivel del evento, así que se creó `att_actividad_entradas` colgando directo de la actividad y las dos viejas quedaron deprecadas —y se borraron al día siguiente en `20260923000009`, con autorización del usuario.

**Giro a mitad de camino.** Después de construirlo el usuario pidió *"tarifa por participante, me funciona mejor"* y luego lo afinó a **por persona**: la tarifa del evento es la estándar que paga cada uno, y quien pague distinto lleva la suya en su fila. Vacío no es cero —una fila sin tarifa usa la estándar, un `0` escrito a mano es una cortesía—. Consecuencia en la UI: los participantes dejaron de ser chips sueltos y pasaron a ser la lista con tarifa, porque tener las dos cosas obligaba a escribir los nombres dos veces.

### Reuniones (`0edf09f`) · cierra los 11

El único sin costo: no tiene tarifa, ni forma de pago, ni aporta al total. Su PDF va en **azul marino y gris muy claro**, no en los colores vivos del resto, porque *"generalmente se utiliza para compartir con los participantes"*. Por lo mismo el pie dejó de decir «documento de uso interno» —sería contradecirse con alguien a quien se lo mandas— y el pie de todos los servicios pasó a tomar el color de su propio servicio.

`cita` era `NOT NULL` y el documento no la pide: una reunión nueva no se habría podido guardar. Se liberó.

La reunión entra al itinerario **y** marca su día en el calendario del dashboard, las dos cosas que pedía el documento.

### Tres fallas viejas que salieron a la luz

**El itinerario general nunca mostró un solo servicio (`d7f8bc1`).** Las once consultas filtraban el borrado suave con `.match({ viaje_id: id, deleted_at: null })`. PostgREST arma un `eq` por cada llave, así que eso sale como `deleted_at=eq.null`, y en SQL `= NULL` nunca es verdadero: las once devolvían cero filas **siempre**. Comprobado contra la base: `where deleted_at is null` da 3 tickets, `where deleted_at = null` da 0. La regla queda anotada en el archivo.

**Los PDF salían en varias hojas (`c676d8f`).** El CSS de impresión escondía el resto de la página con `visibility: hidden`, que oculta pero **deja el hueco**: el documento caía después de toda la pantalla del viaje. Medido con Chrome en modo impresión y una pantalla de fondo, un ticket salía en **tres** páginas con las dos primeras casi en blanco. Ahora los modales salen por un portal a `<body>` y la impresión saca del flujo todo lo que no es el modal. El mismo cambio arregló el Itinerario Final, que se imprimía **en blanco** porque su contenido no llevaba la clase que el CSS usaba para decidir qué imprimir.

**El encabezado del viaje se quedaba en números viejos (`11fb293`).** Un viaje con dos tickets decía «1 vuelo»: nadie invalidaba `att_trip_stats`. Cada formulario invalidaba a mano las queries que conocía, y las que vinieron después no entraban en esa lista. Ahora hay una sola función, `invalidarViaje`, que refresca todo lo que la pantalla deriva de los servicios; la usan los once formularios y los diez borrados. De paso salió que **borrar** un servicio tampoco refrescaba el total.

### El título del PDF bajo el logo (`c5a2e95`)

El bloque de texto del encabezado no reservaba el ancho del logo, así que un título largo —el nombre de un evento— se le montaba encima. Afectaba a los diez servicios; se arregló en la plantilla compartida. De paso, los seis servicios reconstruidos se montaban a mano en el panel y se quedaban sin `tripNo`: su PDF salía sin el correlativo del viaje.

---

## Fase 21 · 2026-09-22 → 2026-09-23 · T&T Dashboard inicial

**Objetivo:** dejar Arriaza T&T como lo describe `TT_Dashboard_inicial.docx`. Plan completo en [`PLAN-TT-DASHBOARD.md`](../PLAN-TT-DASHBOARD.md).

**Hallazgo de arranque:** el usuario subió el paquete `TT_modulo.html` para "trasladarlo", pero ese mismo HTML ya se había portado en la Fase 19. Las instrucciones del handoff (pegar el JS vanilla, cambiar `ttSave()` por `save()`) eran para el monolito legacy con localStorage y no aplican a React + Supabase: violarían la Regla 0. Se acordó construir por partes desde el documento en vez de trasladar.

**Estado real que justificó reconstruir:** el módulo estaba prácticamente sin estrenar — 2 viajes, 1 hotel, 0 tickets, 0 day_plans, 0 notas. Reconstruir no cuesta datos.

### Nombres de los miembros de junta (2026-09-22)

Migraciones `20260922000001/2/3`. `miembros_board.nombre` pasó de repetir el código a llevar el cargo: MAA→Presidencia, JA→Gerencia Agrícola, LA→Gerencia Administrativa, JM→Gerencia LUM, EG→Gerente General, AA y PE→Board.

**Por qué no se tocó `codigo`:** es la llave técnica — ruta `/maa`, control de acceso de `board_member`, importación por CSV. Cambiarlo obligaba a mover ruta, carpeta y política sin ganar nada visible.

**Por qué la pestaña sigue mostrando iniciales:** se midió el ancho real de la barra. Con los cargos completos son 1471px contra 1352px útiles → dos filas. Con iniciales, 922px. El cargo quedó como tooltip y como título de la página.

### F21-1 · Destinos múltiples (2026-09-22)

Migración `20260922000004`: `att_viaje_paises`, `att_viaje_ciudades`, `att_viaje_paradas`, las tres con Regla 0 completa y RLS Pattern A. `att_viajes.pais/ciudad/destino` quedan marcadas como deprecadas vía `comment on column`.

**Incidente:** el backfill derivó el código de país con `upper(left(pais,2))` — las dos primeras letras del **nombre**, no el ISO. "Estados Unidos" quedó como `ES`, que es España. Se detectó al verificar y se corrigió en `20260922000005`. De ahí salió `isoFromFlag()`, que deriva el ISO de la bandera del catálogo en vez de adivinarlo.

### F21-2 · Formulario del viaje (2026-09-22)

`TripFormModal` reescrito: países y ciudades múltiples como chips, paradas con fechas propias, motivo como Placer/Trabajo/Otros, más Pagado por y Notas — estas dos ya existían en la tabla desde antes y nunca se habían mostrado.

`viajes/destinos-api.ts` expone `sync()`: recibe la lista completa y reconcilia contra la base (inserta, actualiza, marca `deleted_at` lo quitado). Se eligió así porque el formulario edita colecciones, no filas sueltas.

**Banderas descartadas:** Windows no dibuja banderas emoji. Se queda el chip de dos letras; el ISO igual se guarda por si algún día se quieren.

### F21-3 · El viaje se arma en su propia pantalla (`82839e7`)

El cambio de fondo que pedía el documento del dashboard. Antes la tarjeta del viaje desplegaba ahí mismo las once secciones de servicios, lo que mezclaba *ver la lista de viajes* con *construir uno* y saturaba la pantalla. Ahora la tarjeta es un resumen y una puerta: ruta `/arriaza/viaje/:id` con su botón Regresar.

### Los cuatro ajustes del usuario (`3e4a00d`, `f8cd49c`, `ab96969`)

- **Compartir viaje mostraba cero.** El total estaba literalmente escrito como `0` con un texto de relleno; nunca se conectó a los servicios.
- **El itinerario se escribe día a día.** Cada día es una banda con su fecha y una tarjeta debajo, y dentro conviven los servicios reservados y las actividades escritas a mano **en una sola línea de tiempo ordenada por hora**. Al verlo en pantalla salió que el restaurante de las 20:00 aparecía arriba de las actividades de las 10:00: eran dos listas separadas.
- **Resumen en números y ruta lateral.** Días, noches de hotel, ciudades y vuelos. Los vuelos cuentan **segmentos**, no tickets: un ida y vuelta con escala son varios vuelos en un boleto.

### La ruta del riel, dos veces (`adb801c`, `41c7504`)

El usuario lo reportó así: *"en teoría llego primero a MIA y luego a NY, pero como de donde te pedí que extrajeras la información NO tiene fechas de llegada, el timeline no está alimentándose bien"*. Tenía razón: `att_viaje_ciudades` dice a qué ciudades va el viaje, no cuándo se llega, así que el riel las mostraba en el orden en que se capturaron.

Primera versión: ordenar por lo que sí tiene fecha, con los vuelos como fuente principal. **El usuario corrigió el criterio, y el suyo es mejor:** no se ordena por qué dato es más confiable sino por **qué ciudad merece aparecer** —

> *"La fecha de las ciudades primero la ponen los Hoteles, si no hay hotel el Tour, y luego los vuelos. Porque la mayoría de las ciudades que merece la pena mencionar es donde se aloja (…) y por último, como el del viaje a NY, es la del vuelo como MIA, ya que hago escala allí."*

Así quedó: **hotel → tour → parada → vuelo**. Cada ciudad toma la fecha de su fuente más importante, y agregarle un hotel a una escala la reordena sola. La misma jerarquía resuelve los choques de día, que es lo que evita que el hotel «Brooklyn NY» y el vuelo a «Nueva York» del mismo día salgan como dos escalas.

**Las ciudades sin fecha no cuelgan del riel.** No tienen lugar en una línea de tiempo, y ponerlas al final duplicaba la misma escala cuando está escrita distinto que en el servicio —«New York» a mano contra «Nueva York» del aeropuerto JFK. Se siguen viendo en «Datos del viaje», donde la lista no promete ningún orden.

---

## Fix notificaciones · 2026-09-22 · La notificación se cierra al generar su acción

**Objetivo:** que una notificación de pago desaparezca del panel cuando ya generó la solicitud que pedía, para que el dashboard muestre solo lo que falta hacer.

**Bug doble, confirmado contra la base de producción:**
1. Crear la SP desde el panel solo abría el form pre-rellenado. Nadie marcaba `procesado`, así que la notificación quedaba pendiente para siempre y se limpiaba a mano con la ✕.
2. `PagosSection` sí ponía `origen_notificacion_id` en el objeto inicial, pero `PagoForm.toInput()` no lo incluye al armar el insert y el campo se **descartaba en silencio**. Evidencia: `SP-2026-0004` nació de una notificación y tiene el campo en `null`. Sin ese vínculo no hay a quién cerrarle nada ni cómo auditarlo.

**Cambios de UI:**
- `PagosSection.tsx` — estado `fromNotif` con la notificación que abrió el form; al crear con éxito se persiste `origen_notificacion_id` y se marca `procesado` + `procesado_at`. Cancelar **no** cierra la notificación. Si el marcado falla, el pago no se revierte: se avisa que quedó pendiente.

**Segunda pasada — la notificación tampoco aparecía al crearse:**
- `pushPagoNotificacion()` insertaba la fila pero nadie invalidaba la query del panel. Con `staleTime: 30_000` y `refetchOnWindowFocus: false`, cambiar de pestaña seguía sirviendo la lista cacheada: la notificación recién creada no salía hasta refrescar el navegador. No era red ni base.
- La invalidación se puso **dentro del helper**, no en cada caller (Consumos TC y Liquidaciones), para que el próximo que despache no pueda olvidarla.
- `PAGOS_NOTIF_KEY` exportada desde `NotificacionesPanel` — las 4 referencias a la key ahora son la misma constante.

**Comentarios:**
- No se corrigió la data vieja (`be4d0a36`, VCH-0004) desde la Management API: eso saltaría RLS y `audit_log`, contra la Regla 0. Se cierra con la ✕ del panel, que sí pasa por la app.
- Ojo al patrón: `toInput()` del form es la única fuente del insert. Cualquier campo que se precargue fuera del `FormState` se pierde sin error. Si aparece otro caso, revisar ahí primero.

---

## Formato oficial SP · 2026-09-22 · FZ-RG-0185 imprimible desde Pagos

**Objetivo:** que la asistente imprima la solicitud de pago en el formato oficial de la empresa directamente desde el sistema, sin volver a teclear los datos en el Excel. El documento se firma en físico, así que el entregable es papel, no archivo.

**Cambios de UI:**
- `src/modules/finanzas/pagos/SolicitudPagoPrintable.tsx` — réplica del formato FZ-RG-0185 v04 (Tesorería). Se reconstruyó celda por celda desde el `.xlsx` original: 6 columnas con su ancho relativo, 43 filas con su altura en puntos, textos fijos y recuadro de firmas.
- `src/modules/finanzas/pagos/logo-fz.png` — logo extraído del Excel (`xl/media/image1.png`).
- `PagosSection.tsx` — botón 📄 a la par del 👁, con su propio `PrintableModal`. El printable genérico anterior queda intacto.

**Comentarios:**
- **Se descartó generar un `.xlsx` relleno.** Habría necesitado `exceljs` en el bundle y, peor, escribir en coordenadas fijas: si alguien reacomoda la plantilla el archivo sale mal llenado **sin error**. El printable + `window.print` es además el patrón que ya usan Vales, Liquidaciones y Consumos.
- **`K` y `SHEET_W` van juntos** y están documentados en el componente. `@media print` estira `.printable` al 100% de la página, así que sin un ancho propio la hoja se desborda a dos páginas. Medido: 8.96in de 9.56in disponibles en carta.
- **El Excel está tipografiado en Gisha, que no está instalada.** La caída a Segoe UI es más ancha y partía en dos "Fecha Aprobación:" y las descripciones de la tabla de anticipos; se compensó con 170mm de ancho en vez de los 160mm del escalado puro. Si se instala Gisha, volver a 160mm.
- **Centro Productivo se deja siempre en blanco** — se llena a mano, por pedido del usuario.
- **Pendiente decidir:** el formato no tiene casilla para el correlativo, así que la hoja firmada no queda amarrada a su `SP-YYYY-####`. Igual "Autorizado Por" va vacío aunque `autorizador_id` exista.

---

## Bootstrap fix · 2026-07-12 · C-1 CRITICAL del AUDIT

**Objetivo:** arreglar el bug intermitente "Cargando…" eterno / "No hay perfil cargado" que bloqueaba la app en producción para la mayoría de sesiones.

**Ver:** [`docs/AUDIT-2026-07-12.md`](AUDIT-2026-07-12.md) finding C-1 + ADR [D-018](PROCESO-Y-DECISIONES.md#d-018).

**Cambios:**
- `src/lib/auth.tsx` — bootstrap ahora usa `supabase.auth.getUser()` (fetch HTTP real) en vez de `getSession()` (que espera evento local que nunca llega con extensiones crypto tipo MetaMask instaladas).
- Reconstrucción de `Session` desde `localStorage` para exponerla al `AuthContext`.
- Timeout defensivo reducido de 8s a 5s (getUser() ya no cuelga; el timeout es solo red de seguridad para network offline).
- Se mantienen `.catch`/`.finally` y try/catch alrededor de `loadProfile` (garantiza `setLoading(false)` siempre).

**Housekeeping incluido:**
- `supabase/scripts/fix-usuarios-nombres.sql` — script para arreglar `usuarios.nombre = NULL` de Angeles (finding M-3).

**Regresa al día siguiente:** F19-1 · servicios simples del PLAN-TT-TOUR-Y-TRAVEL.md (tiendas, reuniones, rutas, pois, restaurantes).

---

## Fase 19 · 2026-07-12 → 2026-08-09 · T&T Tour & Travel completo

**Objetivo:** portar el módulo standalone HTML de T&T (14 servicios + itinerario + calendar + map Leaflet) al stack de NOCTUA — React + TypeScript strict + Supabase con RLS Pattern A + triggers de audit.

### F19-1 · Schema completo T&T (2026-08-09)

Migración `20260813000001_fase19_1_att_tt_completo.sql`:
- ALTER `att_viajes` · `trip_no text unique` + `manual_status` (Solicitado/En planeación/En curso/Finalizado) + sequence `att_viaje_seq` + trigger auto-gen `TT-YYYY-####`.
- CREATE 17 tablas nuevas: `att_rentas`, `att_tours`, `att_aeronaves`, `att_acuaticos`, `att_ferries`, `att_terrestres`, `att_tiendas`, `att_actividades` + `att_actividad_tickets` + `att_actividad_subtickets`, `att_reuniones`, `att_rutas`, `att_pois`, `att_day_plans` + `att_day_plan_rows`, `att_day_notes`, `att_hotel_habitaciones`.
- Todas con Regla 0: PK uuid, FK cascade, AuditCols, deleted_at, RLS Pattern A, triggers audit_trigger + set_updated_at_with_by.

**Bug encontrado y corregido en el proceso**: la migración original usaba `update_updated_at_column()` que no existe en CEA — se cambió a `set_updated_at_with_by()` (nombre canónico desde fase 4).

### F19-2 · API + hooks + cascade viajes

- 13 pares api.ts + hooks.ts para los servicios nuevos (rentas, tours, aeronaves, etc.).
- Infra compartida: `constants/serviceMeta.ts` (14 servicios · TT_SVC_META), `constants/countries.ts` (~213 países con aliases), `constants/airports.ts` (~180 IATA), `utils.ts`, `branding.ts`, `shared/PaymentFields.tsx`, `shared/OwRtFields.tsx`.
- `viajes/api.ts` extendido: cascade soft-delete alcanza 17 tablas nuevas + nietos (habitaciones, tickets de actividad, day_plan_rows) + bisnietos (subtickets).
- Sync auto reunión → day_plan_rows implementado en `reuniones/api.ts::syncReunionToDayPlan` desde React Query hook onSuccess.
- Reutilización de `createCrudHooks` factory de `src/lib` para hooks estándar.
- Intento de helper genérico `makeTripChildApi` descartado: el union de tablas hacía imposible tipar sin recurrir a `any` (violación §6.1). Cada api.ts tiene CRUD inline directo contra Supabase (~30 LOC c/u).

### F19-3 · UI completa (4 bloques + fixes)

**F19-3a** · Playwright setup + smoke tests (2/2 pass · guarda contra C-1).

**F19-3b** · 5 shared UI: `CountryPicker` (autocomplete con aliases), `AirportPicker` (autocomplete IATA), `PaymentMethodSelect` (lee tarjetas_credito), `EstadoPagoBadge`, `ManualStatusSelect`.

**F19-3c** · Rebuild AttPage completo: hero gradient + KPIs (Viajes/En curso/Próximos) + toolbar (búsqueda + filtro estado + sort) + grid trip cards. TripCard con flag país + trip_no + auto-status + ManualStatusSelect + dropdown "+ Agregar Servicios" (14 opciones).

**Bug encontrado y corregido**: color `navy` no estaba en tailwind.config → gradient hero invisible → tsc-verde pero UI-rota. Fix agregando `navy: '#0d2b2e'`.

**Bug encontrado y corregido (recurrente)**: C-1 volvió tras 1h porque `getUser()` no refresh el token expirado. Fix v3 con `refreshSession()` retry. Aún se colgaba por lock interno de supabase-js → fix v4 (final): `withTimeout(3s, ...)` por operación + `nukeSessionStorage()` + auto-redirect `/login` cuando falla. Ver ADR D-020.

**Incidente de seguridad** durante F19-3: Supabase Advisor reportó 34 tablas de `public` con RLS deshabilitado (att_* viejas + finanzas + catalogos). Fix inmediato: `supabase/migrations/20260813000002_fix_rls_reenable.sql` re-habilita RLS en las 34. Causa raíz sin confirmar — sospecha: rollback parcial mal manejado del primer intento de F19-1, o cambio silencioso de Supabase. Ver ADR D-021.

**F19-3d** · 14 servicios con UI (4 bloques): Tiendas + Rutas + POIs + Reuniones (bloque 1) · Tours + Aeronaves + Rentas (bloque 2, con `shared/PaymentFields`) · Acuáticos + Ferries + Terrestres (bloque 3, con `shared/OwRtFields`) · Actividades con tickets+subtickets anidados + Hoteles con habitaciones múltiples (bloque 4).

**Fix UX en el camino**: se eliminó el sub-nav de tabs que duplicaba el dropdown "+ Agregar Servicios". Ahora todas las Sections se renderean apiladas (paridad HTML).

**F19-3e** · ItineraryModal + DayPlanModal + DayNoteModal. Botón 📋 en cada TripCard abre ItineraryModal (día por día desde fecha_ini→fecha_fin, con rows del day_plan y notas). Modal imprimible con `window.print()`.

**F19-3f** · BackupModal (export JSON completo de todas las att_* + import MVP de metadatos del viaje) + FinishedFolder (viajes con manual_status='Finalizado' en grid separado con botón "↩ Reactivar").

### F19-4 · Skill import-tt-backup

Documenta el mapping completo campo por campo del JSON del standalone HTML → INSERTs SQL para las tablas CEA. Cubre los 14 servicios + subtablas + preservación de tripNo + idempotencia via `on conflict`. Ver [`.claude/skills/import-tt-backup.md`](../.claude/skills/import-tt-backup.md).

### F19-5 · QA + docs cierre

- Playwright: 3 smoke tests pass (login, bundle, /arriaza sin errores). CRUD tests skippeados (necesitan E2E_USER + E2E_PASS).
- Bundle inicial: **141.23 KB gzip** (target 145 · +0.29 vs pre-F19). Route `/arriaza` lazy: **84.54 KB gzip**.
- Deferred a polish futuro: 14 printables por servicio, Share modal con html2canvas, Calendar interactivo lateral.
- Total: **17 tablas nuevas + 40+ archivos TS + ~7,500 LOC** en F19 completa.

---

## Fase 20 · próximos pasos posibles

Ideas post-F19 (no comprometidos):
- Skill `check-rls-full` para auto-detectar tablas con "Policy Exists RLS Disabled" antes de que Supabase Advisor las flaggée
- Vitest setup + tests unitarios (DT-1)
- Printables por servicio (F19 polish)
- Share to WhatsApp (F19 polish)
- Calendar lateral interactivo en /arriaza (F19 polish)


**Estado:** planificación completa. Ver [PLAN-TT-TOUR-Y-TRAVEL.md](../PLAN-TT-TOUR-Y-TRAVEL.md) para el detalle. Descompuesto en 6 sub-fases (F19-0 a F19-5), estimado ~19 h de trabajo.

**Alcance confirmado por el usuario:**
- Los 14 servicios se implementan todos (nada se difiere)
- Portar completo al stack de NOCTUA (no hosting estático del HTML)
- Igual prioridad que otros items pendientes

**Entregables recibidos como input:**
- `TT_modulo.html` (~5000 líneas standalone) del proveedor
- `README_INTEGRACION_TT_CEA.md` con instrucciones de integración

**Comentarios:**
- El HTML asume integración en el monolito HTML original de Board Assistant. NOCTUA ya migró de ese monolito en fase 1. Copiar-pegar rompería 4 invariantes de CLAUDE.md §4 (stack, RLS, audit_log, storage). Se traduce al modelo NOCTUA en su totalidad.
- 20 tablas nuevas (15 raíz + 5 sub) + 6 enums + 2 catálogos globales (aeropuertos_iata, paises_catalogo con seed).
- Reusa: PrintableModal, DataTable, Modal, createCrudHooks, CsvImporter, Storage bucket comprobantes, RLS Pattern A.

---

## Fase 18 · 2026-07-12 · Catálogo Vehículos (flota empresa)

**Objetivo:** agregar catálogo para la flota vehicular de la empresa. Distinto de `arriaza_autos` (autos personales de LA · fase 13).

**Cambios de schema:**
- Tabla `vehiculos` con 6 campos + auditoría + soft delete
- Índice único parcial `vehiculos_placa_activa_uidx` en `(placa) where deleted_at is null`
- Triggers `set_updated_at` + `audit_trigger`
- RLS Pattern C · Catálogo

**Cambios de UI:**
- Módulo nuevo `src/modules/admin/vehiculos/` con api, hooks, VehiculoForm, VehiculosSection
- Sub-tab "Vehículos" en AdminPage entre Tarjetas y Status SP
- Reusa CatalogPage genérico

**Divergencia intencional documentada:**
Los otros catálogos (empleados, entidades, personas, status_sp, tarjetas, tipos_pago) NO tienen `audit_trigger` — solo lo tienen las 6 tablas financieras según fase 3. Vehículos SÍ lo lleva porque la Regla 0 (CLAUDE.md §4 invariante 10) dice "audit_log NUNCA se edita ni borra… solo escribe el trigger". Ver ADR D-016 en `docs/PROCESO-Y-DECISIONES.md`.

**Comentarios:**
- Sin validación de formato de placa (queda pendiente de confirmar con el usuario).
- Fase pequeña — 45 min de trabajo total, siguió el patrón canonical de `status_solicitud_pago` (fase 16 · F-0).

**Commits clave:** commit fase 18 = `2520eb1` .. HEAD (pendiente push explícito).

---

## Fase 17 · 2026-06-07 → 2026-06-08 · Refactor Finanzas F-1 a F-5

**Objetivo:** Reorganizar el módulo Finanzas para reflejar el modelo real de la operación: Vales (desembolso vs a entidad), Liquidaciones con multi-vale, Reintegros como dashboard read-only, Consumos TC con line items y notificaciones, Pagos con bandeja de origen.

**Cambios de schema:**
- Enum `vale_tipo` (`desembolso`, `entidad`) + 4 columnas nullable en `caja_chica_vales`.
- Tabla junction `liquidacion_vales` (M:N) reemplaza el `liquidacion_id` que estaba en vales.
- Nuevos campos en `caja_chica_liquidaciones` (producto_servicio, forma_pago, reintegrar_a_persona_id, totales calculados por trigger).
- `caja_chica_liq_rows.factura`.
- 5 nuevos campos en `tc_consumos` + tabla `consumo_renglones` con trigger que recalcula el total.
- `tarjetas_credito.color` para gallery visual.
- **Rename `pagos.estado → pagos.status`** + `status_id` FK al catálogo `status_solicitud_pago` (fase 16).
- Tabla nueva `pagos_notificaciones` con RLS.

**Cambios de UI:**
- Vales: 2 botones (+ Nuevo Vale · + Vale a Entidad), dropdowns invertidos según tipo, botón + Liquidar por fila.
- Liquidaciones: multi-vale via checkboxes, botón 💸 PAGOS (siempre visible desde el hotfix).
- Reintegros: reescrito como dashboard read-only sobre vales tipo=entidad.
- Consumos TC: gallery de cards por tarjeta con color custom, botón + TC CORP, botón Estado de Cuenta (PDF vía print).
- Pagos: panel Notificaciones lateral púrpura, PagoForm con status_id del catálogo, timeline horizontal con círculos y fechas.
- ConsumoPrintable nuevo: header púrpura-azul según mockup image37/image23.
- PagoPrintable: timeline horizontal reemplaza el vertical StepTracker.

**Bonus (no en el plan):**
- SheetJS `xlsx` para importer binario.
- CsvImporter genérico + 6 importadores wireados (Entidades, Personal JD, Empleados, Proveedores, Tarjetas, Status SP, Tipos Pago, Vales, Consumos TC, Liquidaciones, Pagos).
- Datalist para sub-listas de tareas con 9 categorías.

**Comentarios:**
- El botón PAGOS originalmente se mostraba solo cuando `forma_pago = 'Solicitud de Pago'` — mala asunción. Se abrió después para **siempre visible** con canEdit=true.
- El PostgREST schema cache mordió al primer test post-migración. Se agregó `NOTIFY pgrst, 'reload schema';` como práctica obligatoria en `scripts/apply-sql.mjs` y al final de cada migración.
- El `vercel.json` inicial rompió SPA fallback al limpiar `_comment` fields. Hotfix commit `6b4d9b9`.

**Commits clave:** `eea3cea` (schema+types), `de34af6` (multi-vale+notifs), `3778a8b` (importer+gallery), `2c32585` (4 catálogos importer), `c4da61f` (SheetJS+printables), `f54d5f3` (+ Liquidar+TC CORP), `a9f32e0` (anti-cache), `91e12cc` (PAGOS siempre+PDF estado cuenta), `6b4d9b9` (SPA fallback fix).

---

## Fase 16 · 2026-06-05 · F-0 estructural de Finanzas

**Objetivo:** Preparar el terreno para el refactor F. Reorganizar tabs y crear el catálogo `status_solicitud_pago`.

**Cambios:**
- Nueva tabla `status_solicitud_pago` con 6 filas seed (Generado → En Solicitud de Firma → Firmado → Presentado → Procesado → Pagado).
- FinanzasPage con 5 tabs en el orden correcto (Vales · Liquidaciones · Reintegros · Consumos TC Corp · Pagos), removida Vouchers.
- Hash navigation entre tabs.

**Comentarios:**
- El catálogo es requisito de F-5. Sin él, la fase 17 no compila el `pagos.status_id`.
- Vouchers queda deprecado en UI pero la tabla `vouchers` permanece para no romper migración.

---

## Fase 15 · 2026-06-04 · Personal JD (personas)

**Objetivo:** Consolidar todos los "quienes firman/autorizan/son JD" en una sola tabla `personas` con flags. Reemplaza `autorizadores` (que quedaba huérfana + duplicada).

**Cambios:**
- Nueva tabla `personas` con `es_jd`, `es_autorizador`, `es_firmante` (bools).
- FK migradas desde `autorizadores` hacia `personas` (via lookup por nombre).
- Seed de 12 personas desde el Excel del cliente.
- PersonasCatalog en Admin con chips coloreados de roles.

**Comentarios:**
- El Excel original venía en CP1252 leído como UTF-8 → mojibake. Se transliteró manualmente (Ã© → é).
- La tabla `entidades.direccion` (no `dir`) — solo `autorizadores`/`personas` usan `dir`. Diferencia esencial descubierta a golpes en el seed.

---

## Fase 14 · 2026-06-03 · Firma → Pago link

**Objetivo:** Cerrar el ciclo firmas ↔ pagos. Cuando un pago necesita firma de un firmante, guardar la referencia bidireccional.

**Cambios:**
- Columna `pago_id` en tabla `firmas` con FK.
- Trigger que actualiza el estado del pago cuando la firma se registra.

---

## Fase 13 · 2026-06-02 · Arriaza sub-tablas

**Objetivo:** Modelar la profundidad de datos del miembro Arriaza (LA) — el que más información maneja: residencias, autos, mascotas, staff, salud, docs, holding, servicios.

**Cambios:**
- 8 tablas hijas nuevas: `arriaza_autos`, `arriaza_residencias`, `arriaza_mascotas`, `arriaza_staff`, `arriaza_docs`, `arriaza_salud`, `arriaza_holding`, `arriaza_servicios`.
- Todas siguen el Pattern B de RLS (asistente lee, admin escribe).
- ArriazaPanel con navegación por sub-tab.

**Comentarios:**
- Esta fase decidió el patrón "sub-tablas de miembro" que luego se generalizará si otros miembros crecen.
- El miembro LA tiene ~40% del volumen de datos del sistema.

---

## Fase 12 · 2026-06-01 · Audit fixes

**Objetivo:** Correcciones de una auditoría adversarial. 3 findings críticos + 4 medios.

**Fixes críticos:**
- **C-1:** RLS Pattern C bloqueaba asistente en tablas CEA. Se agregó `admin OR asistente` a las policies de write.
- **C-2:** Trigger `sync_vale_liquidacion_link` perdía el estado previo del vale al desvincular. Se agregó columna `estado_previo`.
- **C-3:** Faltaban CHECK constraints en montos, fechas y enums. Se agregaron 7.

**Fixes medios:**
- Tabla huérfana `cea_directorio` — DROP.
- Índices faltantes en columnas usadas por queries frecuentes.
- Trigger `updated_at` faltante en 2 tablas.
- `deleted_at` no chequeado en queries de list.

---

## Fase 11 · 2026-05-30 → 2026-05-31 · CC Board rewrite

**Objetivo:** Reescribir Caja Chica Board (vales, liquidaciones, vouchers) desde cero con el modelo correcto: seriales, estados, RLS. Reemplaza el HTML monolítico legacy.

**Cambios:**
- 4 tablas nuevas: `caja_chica_vales`, `caja_chica_liquidaciones`, `caja_chica_liq_rows`, `vouchers`.
- Enums `vale_status`, `pago_estado`, `tc_tipo`.
- Sequences per-año con format `VL-YYYY-####`, `CC-YYYY-####`, `VCH-YYYY-####`.
- Triggers de audit_log en las 4.
- Modulo `lavanderia` (submodulo LA).
- `pagos` con StepTracker de 6 pasos y `step_dates` array.
- 8 firmantes iniciales en `firmas`.

**Comentarios:**
- Esta es la fase que marcó el fin del HTML monolítico como fuente de verdad. A partir de aquí el DB es el único.
- Se decidió NO migrar el localStorage — el usuario cargaría data via Excel más tarde (que se materializó en Fase 17 con los importers).

---

## Fases 1-10 (pre-Claude Code) · 2026-01 → 2026-05

Fundaciones del proyecto: setup Vite/React/TS, config Supabase, RLS baseline, esquema básico de `usuarios` + `miembros_board`, primera versión de la UI de Board sin CC Board.

Detalle en git log (`git log --oneline --before=2026-05-29`).

---

## Ejemplo de siguiente entrada (plantilla)

```
## Fase N · YYYY-MM-DD · Título corto

**Objetivo:** una frase que explique por qué.

**Cambios de schema:** (si aplican)
- Tabla X…
- Enum Y…

**Cambios de UI:**
- Módulo X…

**Comentarios:** decisiones, incidentes, workarounds.

**Commits clave:** `hash1`, `hash2`.
```

# Bitácora · CEA NOCTUA

Registro cronológico de cambios de fondo. **No es un changelog** (para eso está `git log`), es el diario de decisiones y contexto de cada fase. Cada entrada explica **por qué** más que **qué**.

Formato: `## Fase N · YYYY-MM-DD · Título` seguido de bullets Objetivo / Cambios / Comentarios.

---

## Fase 36 · 2026-09-30 · Aeronaves · Bitácora de vuelo

**Objetivo:** lo que el piloto reporta después de volar. *«Es de donde todo parte»* —de acá salen las horas, y de las horas saldrán después los cobros por uso personal y la cuenta regresiva de los mantenimientos. Plan en [`PLAN-HORAS-DE-VUELO.md`](../PLAN-HORAS-DE-VUELO.md).

**Cambios de schema:** migración `20260930000001_bitacora_vuelo.sql` — `avn_pilotos`, `avn_vuelos` (correlativo `VU-AAAA-####`), `avn_vuelo_tramos` y `avn_vuelo_pax`.

**Comentarios:**

- **Las horas salen del horómetro, no del reloj.** Cada tramo guarda el horómetro al salir y al llegar; la diferencia es una **columna generada** y el total del vuelo lo mantiene un trigger. La hora de reloj se guarda aparte: sirve para el itinerario y para la espera, pero no es lo que cuenta la aeronave. Verificado contra el ejemplo del mock: `0.8 + 0.7 + 0.6 = 2.1 h`.

- **El horómetro no camina para atrás.** Hay un CHECK que lo impide y el formulario lo avisa mientras se escribe. Un dedazo acá no se nota hasta que un mantenimiento sale con la cuenta mal, tres meses después.

- **Al agregar un tramo, su horómetro de salida arranca donde terminó el anterior** y su origen es el destino del anterior: entre dos tramos del mismo vuelo la aeronave no voló sola.

- **Los pilotos son catálogo de flota, no de aeronave**: uno puede volar más de una. No se usa `personas` porque un piloto necesita licencia y vencimiento médico, que esa tabla no tiene ni debería tener —`personas` sigue siendo la fuente de autorizadores y firmantes, que es otra cosa. El vencimiento del médico se vigila como los certificados de la aeronave, con un mes de aviso.

- **Un pasajero por fila**, no todos en una celda: *«si después lo quiero descargar no lo puedo filtrar»*.

- **Lo que deliberadamente NO va todavía**, por decisión de la usuaria:
  - **Ciclos** — *«mi alcance de información no llegará a los ciclos, nada más a horas»*.
  - **Galones por tramo** — *«no estoy segura de cómo lo vamos a amarrar»*. El fuel hoy se captura como facturas en la pestaña de Combustible, y meterlo también acá sería tener el mismo número en dos lugares antes de saber cuál manda.
  - **Tarifas, viáticos y a quién se le cobra** — eso es lo que la administración le agrega después a lo que reportó el piloto, y va en su propia fase.

**Commits clave:** ver `git log` de 2026-09-30.

---

## Fase 35 · 2026-09-29 · CEA · Nota de entrega de documentos

**Objetivo:** la constancia de que unos documentos se entregaron —a quién, qué día, quién los entregó y quién los pidió— con correlativo y buscable. Hoy se hace en un Word suelto, sin número y sin forma de encontrar la de hace tres meses.

**Cambios de schema:** migración `20260929000003_cea_notas_entrega.sql` — `cea_notas_entrega` con correlativo `NED-AAAA-####` por sequence + trigger, RLS con el mismo patrón del resto de CEA (lee cualquiera autenticado, escriben admin y asistente).

**Comentarios:**

- **«Recibido por» no es un campo.** En la hoja se imprime el mismo nombre de «Para», porque quien recibe es a quien iba dirigida. Lo dice el documento de la usuaria y además tenerlo dos veces sería invitar a que digan cosas distintas.

- **«Solicitado por» es opcional de verdad**: *«si se escribe aparece en PDF, si no NO»*. El renglón desaparece en vez de imprimirse con una raya. Verificado en las dos variantes.

- El bloque de descripción lleva **alto mínimo** para que la hoja se vea igual aunque el detalle sea corto: es un documento que se firma, no una pantalla.

- El correlativo lo pone la base y el formulario nunca lo manda, igual que los demás seriales del proyecto.

**Queda pendiente** la **Nota de envío**, que la usuaria pidió a continuación: la guía de encomienda para cuando se mandan documentos u objetos a otro punto.

**Commits clave:** ver `git log` de 2026-09-29.

---

## Fase 34 · 2026-09-29 · Aeronaves · Reporte del estado de cuenta y borrado solo para super

**1 · Reporte por período, en PDF y en Excel.** Dos campos de fecha con atajos (este mes, mes pasado, el año, todo) y un reporte con saldo al inicio, los movimientos y saldo al cierre.

**2 · Borrar un registro de combustible quedó en el nivel `super`.** Lo pidió la usuaria: borrar es irreversible y anular ya deja rastro, así que para todos los demás la salida es anular. El nivel `super` ya existía en `puede()` —`{observador: 1, editor: 2, super: 3}`— y el rol `admin` lo pasa siempre; no hubo que inventar nada.

**Comentarios:**

- **El período es un TRAMO del libro, no un filtro por fecha.** Filtrar movimiento por movimiento dejaba fuera los que el proveedor mandó sin fecha —los dos anticipos del cierre, la factura con la fecha corrupta— y entonces las columnas no cerraban: saldo inicial + repuesto − consumido no daba el saldo final. Ahora las fechas marcan dónde empieza y dónde termina el tramo, y lo que va en medio entra completo. Verificado en los cuatro atajos: **todos cuadran al centavo**. El de septiembre es el caso real: 24,736.20 − 1,969.50 = 22,766.70.

- **Un reporte por período necesita el saldo al inicio.** Sin él la columna de saldo no significa nada, porque el depósito no arranca en cero el día que empieza el rango. Y el arrastre se toma del movimiento **anterior por posición**, no comparando fechas: el orden del estado de cuenta no es cronológico.

- **Las hojas se parten por programa y no se dejan fluir.** El mismo corte sirve para las dos salidas: al imprimir cada bloque arranca en hoja nueva con `.salto-pagina`, y al descargar cada bloque es una página del PDF. Si se dejara fluir, el PDF descargado saldría como una sola imagen larguísima aplastada en una página. Verificado: el reporte del año son 2 páginas carta de 612×792 pt.

- **El Excel va plano** —una fila por movimiento, sin celdas combinadas ni sub-encabezados— porque el punto de bajarlo es poder filtrarlo y sumarlo, y eso se rompe con cualquier adorno. Los montos se redondean antes de escribir: el saldo corriente arrastra ruido de punto flotante y un `22766.699999999997` en una celda ensucia cualquier suma que se haga encima.

- **`liquidacion-pdf.ts` se mudó a `src/lib/pdf-hojas.ts`** como `armarPdfDeHojas`. Ya era genérico —recibe nodos del DOM y devuelve un Blob— y ahora lo usan la liquidación de T&T y el reporte de combustible. Mismo motivo por el que `descargar` se había mudado antes.

**Commits clave:** ver `git log` de 2026-09-29.

---

## Fase 33 · 2026-09-29 · Aeronaves · Estado de cuenta del proveedor de combustible

**Objetivo:** saber cuánto queda del depósito con Aeroclub de Guatemala Gasolinera sin abrir el Excel que manda el proveedor. Plan en [`PLAN-ESTADO-CUENTA-FUEL.md`](../PLAN-ESTADO-CUENTA-FUEL.md).

**No es crédito, es un depósito.** El límite de crédito del proveedor es 0.00: hay un depósito del que se consume y que se va reponiendo. Agotarlo es quedarse sin fuel, y por eso el aviso de saldo bajo no es decorativo.

**Lo que decidió el alcance:** la cuenta es **exclusiva de TG-OBI** (confirmado con la usuaria). Si se compartiera con vehículos u otras aeronaves, el saldo de CEA jamás cuadraría con el del proveedor y habría que conformarse con conciliar.

**Cambios de schema:** migración `20260929000002_fuel_cuenta.sql` — `avn_fuel_cuentas`, `avn_fuel_movimientos` (la historia importada), `avn_fuel_abonos` (las reposiciones) y `avn_fuel_abono_registros` (qué facturas cubre cada una).

**Comentarios:**

- **El signo se invierte a propósito.** El Excel lleva el saldo en negativo cuando hay dinero a favor —para el proveedor somos un pasivo— y cierra con «Saldo disponible −24,736.20». En CEA el disponible va **en positivo**: nadie lee bien un negativo que significa que tenés plata.

- **El estado de cuenta no se guarda, se calcula**, igual que la liquidación del crucero. Sale de tres fuentes que no se duplican: la historia importada, los registros de combustible de CEA y las reposiciones. Por eso editar una factura corrige el saldo solo. Guardar `S.Anterior` y `S.Final` como los trae el Excel sería guardar la misma verdad tres veces.

- **El comprobante de pago vive en la reposición, no en la solicitud.** La usuaria: *«se hace una solicitud por cada factura con su vale, y la mayoría de las veces contabilidad agrupa solicitudes y hace un solo pago que abarca un grupo de facturas»*. Se verificó contra el Excel con una búsqueda de subconjuntos: **67 de 75 abonos son la suma exacta de un grupo de facturas pendientes** (`2354.10 = FER2033637 + FER2033663`). O sea que un comprobante cubre N solicitudes, y ponerlo en cada una sería el mismo papel en N lugares. El formulario de reposición deja marcar las facturas que cubre y avisa si la suma no cuadra con el monto.

- **`historico_hasta` evita el doble conteo.** Los registros de CEA anteriores al corte de la historia ya están dentro de ella y no vuelven a restar.

- **El mínimo de alerta son Q8,000** porque son cuatro o cinco días de abastecimiento, que es lo que tarda en procesarse un pago. Por debajo de eso hay que iniciar la reposición o se llega a cero antes de que entre el dinero. Está en el comentario de la columna: sin el porqué, el día que alguien lo cambie no va a saber qué está cambiando.

- **La importación se verifica contra el propio Excel.** El script recalcula la cadena `S.Anterior + Cargos − Abonos = S.Final` de las 299 filas y se niega a cargar nada si no cierra o si el disponible no coincide. Resultado: 293 movimientos, **Q24,736.20**, idéntico al estado de cuenta. `S.Anterior`/`S.Final` no se guardan pero sirven justo para esto.

- **El Excel del proveedor trae una fecha corrupta** (`22/02/202` en FER1040281). El script no adivina: deja el movimiento sin fecha, conserva el texto original en el comentario y lo reporta. Una fecha inventada en un estado de cuenta es peor que una vacía.

- **El orden de la historia no es cronológico** —el Excel trae el 21/03/26 antes del 22/02/26— y es el orden, no la fecha, el que sigue la cadena de saldos. Por eso `avn_fuel_movimientos` lleva `orden`.

- De aquí en adelante no hay más importaciones: las facturas las captura CEA y las reposiciones se registran en la pantalla. El Excel de Aeroclub solo sirve para conciliar.

**Commits clave:** ver `git log` de 2026-09-29.

---

## Fase 32 · 2026-09-29 · Aeronaves · Anular un registro de combustible y verlo completo

Tres cosas del control de fuel, reportadas por el usuario después de probarlo con un registro real.

**1 · El candado de borrado miraba lo que no era.** Un registro que ya tuvo solicitud de pago no se podía borrar nunca más, aunque la solicitud se hubiera eliminado después. El usuario hizo una prueba de punta a punta, borró la SP porque no era real, y el registro quedó atrapado: ni se podía quitar ni se podía volver a enviar.

La causa: la pantalla preguntaba por `notificacion_id` —el aviso que se le manda a Pagos— y ese aviso no se borra nunca, queda con su `procesado_at` para poder rastrear qué pasó. Lo que importa es si hay una **solicitud viva**, que es `pago_id` (la consulta ya filtra `pagos.deleted_at is null`). Ahora el estado se calcula en `estadoPago()` con tres casos —`conSolicitud`, `pendiente`, `libre`— y borrar depende de `conSolicitud`.

**2 · Faltaba una salida cuando borrar no es opción.** Migración `20260929000001_combustible_cancelado.sql`: `cancelado_en` y `cancelacion_nota`. Anular no es borrar —misma idea que los servicios de T&T—: el registro se queda en la lista con su historial, atenuado y con su etiqueta, pero **deja de sumar al total facturado**, y el pie de la tabla dice cuántos quedaron fuera.

**3 · No había dónde ver el registro completo.** El botón 👁, a la par de editar, abre `RegistroPrintable`: los datos, los productos con su precio unitario, el documento que se adjuntó y la solicitud de pago si existe, los tres en la misma hoja. Antes estaban en tres lugares distintos.

**Comentarios:**
- **El envío a Pagos ahora se puede deshacer** mientras nadie lo haya procesado: la ✕ junto a «enviada a pagos» cierra el aviso y el registro vuelve a estar libre. Sin esto quedaba el mismo callejón sin salida del punto 1, solo que un paso antes. Y borrar un registro con un aviso pendiente **también cierra el aviso**: si no, Pagos seguiría pidiendo una solicitud por algo que ya no existe.
- Cerrar un aviso es marcarlo `procesado`, igual que generar la solicitud. Un aviso solo existe para pedir una acción; cancelarlo la cierra. No se borra nunca.
- Anular pide el motivo en su propio modal y no con `useConfirm`, porque ese devuelve un booleano y no texto. El motivo es lo que después explica por qué el total del mes no cuadra con las facturas.
- La hoja usa el **acento de la aeronave**, no un logo: el de Arriaza es de T&T y el de Finanzas es del formato oficial FZ-RG-0185. Esta es interna de CEA.
- Anular el registro **no toca la solicitud de pago**. Son dos documentos de dos módulos; la SP se maneja desde Finanzas y el modal lo dice.

**Commits clave:** ver `git log` de 2026-09-29.

---

## Fase 31 · 2026-09-28 · Crucero · pasajeros por camarote y hoja en dos partes

Tres cosas que salieron al cargar el primer crucero real, reportadas por el usuario.

**1 · No había dónde anotar quién viaja en cada camarote.** El usuario terminó creando un camarote por persona —era lo único que la pantalla permitía— y la hoja quedó diciendo que los dos iban en el mismo. Ahora el camarote tiene sus pasajeros, como el ticket aéreo y las actividades: **una fila por persona** (`att_crucero_pax`), no un texto con nombres separados por coma, para poder filtrarlos y exportarlos después. Se captura con `ChipsInput`, el mismo componente de los participantes de Actividades.

De paso se agregó `reserva_numero`: la naviera da un número por camarote, no uno por crucero, y no había columna para él. El del crucero completo sigue en `att_cruceros.confirmacion`.

**2 · El formulario no se dejaba leer.** *«Me cuesta mucho identificar visualmente cada segmento.»* Todo tenía el mismo borde beige. Ahora cada sección lleva **número y color**: el crucero y los camarotes en el índigo del servicio, los abonos en verde —dinero que entra a la reserva— y los servicios extra en ámbar —dinero que se suma encima—. Dentro del camarote hay cuatro sub-bloques con su barra de color: datos, pasajeros, tarifa, y los dos de dinero.

**3 · El PDF salía saturado.** Se partió en dos hojas:
- **Hoja 1**, la que se lee: por camarote solo nombre de la reserva, **su número**, cubierta, camarote, tipo de habitación y **monto pagado**, con los pasajeros bajo el nombre. Más embarque/desembarque, itinerario y el total.
- **Hoja 2**, el detalle del dinero: un bloque por camarote con cada abono y cada extra, **con su tarjeta y su fecha**, y cuánto falta.

**Comentarios:**
- La columna «Monto pagado» muestra lo abonado, que es lo que pidió el usuario, pero cuando no cubre la reserva agrega un «de USD X» en gris. Mostrar solo lo pagado escondería una deuda en la hoja que se mira primero.
- El salto de hoja es la clase `.salto-pagina` (`break-before: page`), nueva en `index.css`. En pantalla no existe, así que la vista previa lleva un separador punteado `no-print` que dice «Segunda hoja»: sin él la separación solo se vería al imprimir.
- El total y el estado se sacaron del pie de `ServicePrintable` y se armaron dentro de la hoja 1. Ese pie va después de los extras, o sea que habría caído hasta el final de la segunda hoja.
- Si la cantidad de pax cobrados no coincide con los pasajeros anotados, el formulario lo dice pero **no lo corrige**: un camarote puede cobrar 3 y tener 2 nombres conocidos, y bloquearlo sería peor que avisar.
- Los pasajeros se rehacen en cada guardado en vez de reconciliar como los abonos: un nombre no es dinero y no tiene historial que conservar entre ediciones. El borrado sigue siendo en suave, que para eso está `audit_log`.

**Commits clave:** ver `git log` de 2026-09-28.

---

## Fase 30 · 2026-09-28 · T&T · Servicio de Crucero

**Objetivo:** el crucero como servicio del viaje, según el Word que mandó el usuario. Tiene una estructura que ningún otro servicio comparte: **crucero → camarotes → abonos y servicios extra**.

**Cambios de schema:** migración `20260928000002_cruceros.sql`.
- `att_cruceros` con las columnas comunes de servicio, para que encaje en el itinerario, la liquidación y la cancelación como los otros diez.
- `att_crucero_camarotes` · el total del camarote es una **columna generada** `tarifa × pax`.
- `att_crucero_pagos` · abonos y servicios extra en una sola tabla, distinguidos por `clase`. Los dos tienen la misma forma —monto, tarjeta, fecha, comentario— y los dos son dinero que llega a una tarjeta; lo único que cambia es si abonan a la reserva o suman encima.
- El total del crucero lo mantiene un trigger: camarotes + extras. Los abonos **no** suman, son forma de pago.
- Se amplió el CHECK de `att_cargos.servicio_tipo` para aceptar `crucero`.

**Cambios de UI:** sección en el viaje, formulario de tres niveles, hoja imprimible, y el crucero en el itinerario general, en el resumen del viaje y en las dos liquidaciones.

**Comentarios:**
- **La tarifa es por pasajero y por el crucero completo, no por noche.** Un camarote de 2 pasajeros a 1,500 son 3,000 aunque el crucero dure 7 noches. En el hotel es al revés —ahí `tarifa × noches` sí es correcto porque la tarifa es por noche— y está bien que las dos fórmulas no coincidan. Las noches del camarote se guardan porque aparecen en el documento, pero son informativas y la pantalla lo dice.
- **Es el primer servicio cuyo dinero llega a las tarjetas por varios caminos.** La reserva se paga en abonos, cada uno con su tarjeta y su fecha, y encima los extras traen la suya. Leerlo como los demás —`monto` contra `pagado_con_id`— habría puesto el crucero entero en una sola tarjeta: exactamente el error que se corrigió el mismo día con los cargos adicionales. Por eso no entró en `MAPEO` y vive en `liquidacion-cruceros.ts`, que lo descompone en un renglón por abono, uno por extra y uno por el **saldo** que falta abonar. Los tres suman exactamente el total del trigger; verificado contra la base: 4,500 + 420 + 3,000 = 7,920.
- **Un abono se fecha el día que se cobró**, no el día que zarpa el barco. Es lo único que lo ubica en un estado de cuenta: un abono de julio no puede aparecer en diciembre.
- **El estado de pago del crucero no se elige, se calcula** de los abonos. En los otros servicios se escoge a mano, pero acá sería mentirle a la hoja: los abonos ya dicen cuánto se lleva pagado. Lo único que lo pisa es la cancelación, y volver a guardar el formulario no lo resucita.
- El pendiente de un camarote cuenta **solo la reserva**, no los extras: el documento dice «hasta pagar el 100 % de **la reserva**», y un extra ya trae su propia tarjeta y su propia fecha, o sea que ya está pagado. Meterlo en el pendiente lo cobraría dos veces.
- El crucero **no lleva el editor de cargos adicionales** de los otros diez: los servicios extra por camarote ya cubren eso con más detalle, y tener las dos cosas sería dos lugares para lo mismo.

**Commits clave:** ver `git log` de 2026-09-28.

---

## Fase 29 · 2026-09-28 · Cada cargo adicional con su tarjeta y su fecha

**El problema, reportado por el usuario:** al agregar un monto extra a un servicio —asientos, maletas— solo había un campo para el monto. Ningún lugar para decir con qué se pagó ni cuándo, así que el extra se sumaba al `monto` del servicio y al liquidar se le cargaba entero a la tarjeta del servicio. *«El monto por TC está incorrecto porque todo se cargó a la TC con la que se pagó el boleto inicial.»*

Con datos reales: el ticket EWR-GUA eran 2 × (603.50 + 103.50) = 1414.00, y los 207.00 de asientos y maleta aparecían en la Amex del boleto aunque se hubieran pagado otro día y con otra tarjeta.

**Cambios de schema:** migración `20260928000001_cargos_extra.sql`.
- `att_cargos` · una sola tabla para los once servicios, con descripción, monto, reintegro, **`pagado_con_id`** y **`fecha_cargo`** propios. `viaje_id` va denormalizado para que la liquidación lea todos los cargos del viaje en una consulta, sin pasar por las once tablas de servicio.
- `pax_id` opcional: en el ticket permite decir de qué pasajero es el cargo, y la hoja conserva el desglose.
- **Rescate de lo capturado:** los 6 extras de pasajero (345.40) se convirtieron en cargos conservando la tarjeta y la fecha del boleto —la única información que había— y con una nota que pide verificarlos. `att_tickets.monto` se redujo a la base y `att_ticket_pax.extras` quedó en cero y marcada como deprecada, para que nada lo sume dos veces. Verificado: los totales no se movieron (1414.00, 1358.86, 606.96).

**Cambios de UI:**
- `CargosEditor` compartido: un renglón por cargo con descripción, monto, **tarjeta** y **fecha de pago**. En el ticket además deja amarrar el cargo a un pasajero.
- El total del ticket pasó a mostrarse como **boleto + cargos**.
- Las **dos liquidaciones** —por viaje y por período— listan cada cargo como renglón propio, sangrado bajo su servicio con «↳ cargo», y el consumo por tarjeta reparte correctamente.

**Comentarios:**
- **A partir de aquí `monto` del servicio es lo que se le cargó a SU tarjeta**, no el total del servicio. El total que ve el usuario es base + cargos. Era la única forma de que un servicio pueda aportar a varias tarjetas.
- Una sola tabla en vez de dos columnas por cada tabla de servicio y el mismo formulario repetido nueve veces. Ya había tres formas distintas de guardar extras —`extras` numérico por pasajero, `extras`+`monto_extras` en cinco servicios, y `extras` jsonb en rentas—; esto las unifica.
- `guardarCargos` actualiza y borra en suave en vez de rehacer la lista, porque un cargo es dinero con historial en `audit_log` y rehacerlo perdería el rastro.
- **Los diez servicios con costo** quedaron con el editor el mismo día: ticket, hotel, restaurante, renta, tour, aeronave, acuático, ferry, terrestre y actividades. El cableado vive en el hook `useCargosDeServicio` —cargar, mantener, sumar y guardar después del servicio— así que cada formulario son tres líneas y no once oportunidades de equivocarse.
- Los campos viejos salieron de las pantallas: el «Monto extras» sin forma de pago de cinco servicios, los «Servicios extras» del hotel y los extras por pasajero del ticket. `monto` del servicio quedó en la base en todos.
- `att_hotel_services` queda sin uso, redundante con `att_cargos`.

**Commits clave:** ver `git log` de 2026-09-28.

---

## Fase 28 · 2026-09-24 · Aeronaves · Control de combustible

**Objetivo:** el registro de vales y facturas de combustible del OBI, y el puente hacia la solicitud de pago. Hoy el usuario lo hace uno a uno en papel y luego lo digitaliza.

**Cambios de schema:** migración `20260925000002_combustible.sql`.
- `avn_combustible_registros` · correlativo `CB-YYYY-####` por trigger, fecha, vale, factura, FER/AP, entidad y proveedor, moneda, total, escaneo adjunto.
- `avn_combustible_lineas` · producto, galones, precio unitario. **El total de la línea es una columna generada** (`galones × precio`) y **el total del registro lo mantiene un trigger** sumando sus líneas: ninguno de los dos se escribe desde el cliente, así que no pueden quedar desincronizados de sus factores.
- Se amplió el CHECK de `pagos_notificaciones.origen_tipo` para aceptar `combustible`.

**Cambios de UI:**
- La aeronave ahora tiene **pestañas** —Ficha y documentos · Combustible— porque con horas, mantenimientos y pagos por venir, una sola columna se volvía interminable.
- **Control de fuel**: la tabla de registros con su serial, y por cada uno el estado de su solicitud de pago en tres momentos: **Enviar a SP**, **enviada a pagos**, o **👁 Ver SP-XXXX**.
- El formulario refleja el Excel del usuario: entidad y proveedor con su NIT, fecha/vale/factura/FER-AP, líneas de producto con **＋ Producto**, y el total calculándose en vivo.
- En **Finanzas → Pagos**, la solicitud que nace de una notificación de combustible ahora se prellena con el **proveedor, su NIT y la entidad** leídos del registro de origen.

**Comentarios:**
- **El puente hacia Pagos no se inventó.** `pagos_notificaciones` ya existía y ya lo usaban las liquidaciones de Caja Chica y los consumos de tarjeta, con el mismo flujo que pidió el usuario: el módulo de origen deja una notificación, y quien administra pagos la procesa extrayendo los datos del documento que la originó. Lo único que hacía falta era dejar la tabla aceptar este origen.
- **La cadena para poder ver la solicitud desde el registro** ya estaba, pero al revés de lo esperado: `pagos_notificaciones.pago_id` nunca se escribe (12 filas, 0 enlazadas), y el enlace real es `pagos.origen_notificacion_id`. Así que se navega registro → notificación → pago, en dos saltos.
- Los datos del proveedor **se leen del registro en el momento**, no se copian a la notificación: duplicarlos en dos lugares es lo que después se desincroniza. Y si el origen no se puede leer, la solicitud se llena a mano —nunca vale la pena bloquear la creación de un pago por un prellenado.
- El registro guarda el **nombre y el NIT** de entidad y proveedor además de su id, por la misma razón que la tarjeta en la liquidación de T&T: renombrar el catálogo no puede reescribir lo que decía un documento de hace un año.
- Quien procesa pagos puede **leer** los registros de combustible aunque no tenga el módulo de Aeronaves: sin eso el prellenado saldría vacío.
- Un registro ya enviado a pagos **no se puede quitar** desde esta pantalla: del otro lado hay una solicitud que quedaría apuntando al vacío.
- Los productos (Gasolina, Aceite, Diesel) van como lista en el código y la columna es texto libre: sumar el Jet A1 del King Air será agregar un renglón, sin migración.

**Commits clave:** ver `git log` de 2026-09-24.

---

## Fase 27 · 2026-09-24 · Módulo Aeronaves · Fase 1

**Objetivo:** arrancar el módulo de administración y control operativo de las aeronaves. El alcance de esta primera fase es la ficha de cada aeronave y sus certificados escaneados. Plan completo en [`PLAN-AERONAVES.md`](../PLAN-AERONAVES.md).

**El alcance, acotado por el usuario:** el rol es administrativo, no técnico de mantenimiento. **Sin ciclos** —todo se mide en horas— y sin control de aeronavegabilidad por componente, que lo lleva el taller. Eso simplifica el modelo a la mitad: el mantenimiento será un historial, no un motor de cumplimiento.

**La flota:** TG-OBI (Cirrus SR22T) como plan piloto, TG-FLY (King Air 300) después, y un helicóptero más adelante. Se construye para varias desde el primer día aunque hoy solo se administre una.

**Cambios de schema:** migración `20260925000001_aeronaves_fase1.sql`.
- `avn_aeronaves` · la ficha. **La nomenclatura es la del perfil que ya usa el usuario**, no la de un sistema de aeronavegabilidad. Dos columnas engañan y llevan comentario en la base: `modelo` es el **año** del modelo (2018) y `color` es el color de **pintura** de la aeronave; el color de pantalla es `acento`.
- `avn_tipos_certificado` · el catálogo, sembrado con los 7 certificados de la documentación histórica DGAC del OBI, sin repetir.
- `avn_documentos` · los escaneos, uno por año y por tipo.
- RLS con el módulo nuevo `aeronaves` de la fase 23, y bucket privado `avn-documentos` con sus cuatro políticas.

**Cambios de UI:**
- **Capa 2 · la flota**: un botón grande por aeronave, con su color, más «Registrar aeronave».
- **Capa 3 · la aeronave**: ficha y **Documentación DGAC agrupada por año**, que es exactamente como el usuario los tiene organizados en su propio documento. Un clic abre el escaneo.
- **Agregar documento**: a propósito corto —nombre desde el catálogo, año y archivo— con los datos opcionales plegados.
- **Admin → Certificados Aéreos**: el catálogo, editable.

**Comentarios:**
- La estructura en capas la pidió el usuario así: dashboard general, luego la flota con un botón por aeronave, y de ahí adentro cada una con lo suyo. «Para que la información esté independiente pero en el mismo lugar». El **dashboard se construye al final**, cuando haya con qué llenarlo, y no al principio con números inventados.
- La **matrícula va en la dirección** (`/aeronaves/TG-OBI`) en vez de un identificador interno: es única, no cambia y se lee.
- El nombre del certificado sale de un catálogo y no de texto libre, para que el mismo documento no quede guardado con tres nombres distintos según quién lo subió. Un tipo ya usado se desactiva, no se borra.
- El bucket es privado, así que tanto los escaneos como la foto de la aeronave se sirven con URL firmada. Las firmas de las fotos se guardan en un mapa de módulo porque la misma imagen aparece en el botón de la flota y en el encabezado de la aeronave.
- Se exportó `AuthContext` de `lib/auth.tsx` para poder montar estas pantallas con una sesión simulada al revisarlas fuera de la aplicación.

**Ajustes del mismo día, ya con documentos cargados:**
- **Visor dentro de la aplicación.** El certificado se abría en otra pestaña y en algunos navegadores se descargaba de una vez, lo que sacaba al usuario de la pantalla. Ahora hay un **ojo** junto a cada certificado que lo abre en una ventana encima, y desde el visor del navegador se decide si imprimir o guardar. No se puso un botón de «Imprimir» propio a propósito: el archivo vive en otro dominio, así que la página no puede ordenarle imprimir al marco; el visor de PDF incorporado sí trae sus propios botones, que es justo lo que hacía falta. Las imágenes, que no traen visor, se muestran directo y quedan los botones de descargar y abrir en otra pestaña.
- **«Todos» por año**: junta todos los certificados de un año en un solo PDF y lo muestra en el mismo visor, listo para descargar. Un PDF aporta todas sus páginas y una imagen se vuelve una página. Aquí **no hay nada que el sistema genere** --son únicamente los archivos subidos-- así que no hace falta capturar pantallas, que es la parte frágil del mecanismo de T&T; se pegan archivos y ya. Si alguno no se puede leer (protegido con clave, formato raro) se avisa cuál fue y el resto sigue: en un respaldo es peor perder el documento entero que perder una hoja.
- `descargar()` se mudó de `arriaza/viajes/liquidacion-pdf.ts` a `@/lib/descargar`, porque ahora lo usan los dos módulos.

**Lo que viene:** horas de vuelo (con la tarifa capturada **en el vuelo** y no solo en la ficha, para que subir la tarifa no recalcule lo ya cobrado), mantenimientos, pagos, renta y al final el dashboard.

**Commits clave:** ver `git log` de 2026-09-24.

---

## Fase 26 · 2026-09-24 · El itinerario como documento, y el archivo de viajes

**Objetivo:** el itinerario se le entrega al cliente final y salía como una pantalla impresa, no como un documento. El usuario: *"NO ME GUSTA EN LO ABSOLUTO... de ninguna manera puedo entregar algo así tan básico"*. Además faltaban dos cosas que el HTML original sí tenía en la carpeta de viajes realizados: un color por viaje y el botón **Ver**.

**Cambios de schema:** ninguno.

**Cambios de UI:**
- **Itinerario rediseñado.** Portada con la marca en degradado, el título, el destino y los cuatro datos que se buscan primero (salida, regreso, duración con noches, cantidad de servicios). Debajo, quiénes viajan y el motivo. Cada día es una banda oscura con el número grande y la fecha larga, y su contenido es una línea de tiempo con riel, un punto por evento del color de su servicio, y la hora a la izquierda. Nota del día en dorado, día sin nada como "Día libre", y una banda de cierre con la marca.
- **Carpeta de viajes realizados:** los diez degradados del HTML original, uno por viaje según su posición.
- **Vista previa del viaje** (botón **Ver**): portada, fechas / participantes / motivo, y la lista completa de servicios con su color, su estado, su subtítulo y su monto, más el total. Desde ahí se salta al itinerario o se abre el viaje. Está tanto en la carpeta de realizados como en las tarjetas de los viajes activos, donde además avisa cuando el total es parcial porque hay servicios sin monto.

**Comentarios:**
- **Los controles de edición se estaban imprimiendo.** Las casillas de hora y descripción, con su ✕, salían en el PDF que se le entrega al cliente. Ahora cada actividad escrita a mano tiene dos caras: la casilla editable, marcada `no-print`, y un espejo estático marcado `print-only` que es el que sale en papel. Se agregaron las clases `print-only` y `evitar-corte` a `index.css`. Verificado: 41 controles en pantalla, 0 al imprimir, y los 9 espejos en su lugar.
- El itinerario pasó de `Modal` a `PrintableModal`, que es el que trae la clase `printable` con `print-color-adjust: exact`. Sin eso el navegador se come los fondos y los degradados al imprimir.
- **Sin bandera en la portada del itinerario.** Windows no dibuja los emojis de bandera y los deja como dos letras sueltas: el título salía "us NEW YORK- BODA", que en un documento para el cliente se lee como un error de tipeo. El país va escrito debajo. En las tarjetas de la carpeta sí se conserva, porque ahí es de uso interno y es como se ve en el HTML original.
- `capitalize` de Tailwind sube la inicial de **cada** palabra: la fecha salía "Jueves 24 De Septiembre". Se cambió por `first-letter:uppercase`.
- El mapeo de servicios de `liquidacion.ts` ganó `sub` y `subExtra` opcionales, que solo usa el resumen del viaje. Los dos reportes financieros los ignoran: la liquidación va sin detalle a propósito. Sigue habiendo un solo lugar donde se declara de qué tabla sale cada servicio.
- El resumen suma las reuniones, que no tienen costo y por eso no están en los reportes financieros pero sí son parte del viaje. No cuentan como "sin monto": no es que se haya olvidado capturarlo.

**Ajustes posteriores del mismo día:**
- Se quitaron los segundos de la columna de horas del itinerario. Las actividades escritas a mano guardan la hora en una columna `time`, que vuelve como `22:00:00`, mientras que los servicios ya llegaban como `HH:MM`: la columna mezclaba dos formatos.
- **El número de confirmación subió del pie a junto de «Reservado a través de»**, en las hojas de los 9 servicios que lo llevan. Es el número que da la OTA, el GDS o el prestador, y estaba al final en letra chica y gris — justo el dato que hay que encontrar rápido cuando algo sale mal con una reserva. Ahora va en una casilla con el color del servicio, en monoespaciada y destacado. No basta con insertarlo después en la lista: el bloque es una rejilla que se llena por filas, así que «después» caía al inicio de la fila siguiente y quedaba en diagonal; se reordena el par para que las dos casillas caigan juntas. En el pie quedó solo la política de cancelación, que sí es letra chica.

**Commits clave:** ver `git log` de 2026-09-24.

---

## Fase 25 · 2026-09-24 · Liquidación por período

**Objetivo:** la liquidación era por viaje, y para pagar las tarjetas eso no sirve: el estado de cuenta no viene separado por viaje, viene por mes. Falta el reporte al revés — un rango de fechas, todos los viajes, agrupado por tarjeta. Plan en [`PLAN-TT-LIQUIDACION-PERIODO.md`](../PLAN-TT-LIQUIDACION-PERIODO.md). Cierra DT-11.

**Cambios de schema:** ninguno. `pagado_con_id` y `fecha_cargo` ya estaban desde las migraciones `...011` y `...012` de la Fase 23.

**Cambios de UI:**
- Botón **Liquidación por período** en la barra de T&T.
- La hoja: resumen por tarjeta arriba, detalle por tarjeta abajo, total del período. Mismo azul marino y gris que la liquidación del viaje, y sin íconos, porque es el mismo tipo de documento y se archiva igual.
- Rango con atajos de mes actual, mes pasado y año.

**Comentarios:**
- **La fecha que manda es `coalesce(fecha_cargo, fecha del servicio)`.** Un hotel de diciembre pagado en octubre aparece en el estado de cuenta de octubre, no en el de diciembre. Cuando las dos difieren, el renglón lo dice.
- **Bug encontrado y arreglado en el camino:** `att_tickets.fecha_salida` es `timestamptz` y vuelve como `2026-09-24 00:00:00+00`, no como `2026-09-24`. Comparado contra un `YYYY-MM-DD` eso dejaba fuera **el último día de cada período** — `'2026-09-30 00:00:00+00' > '2026-09-30'` — o sea que un ticket comprado el 30 desaparecía del reporte de septiembre sin avisar. Se agregó `soloFecha()` en `liquidacion.ts`, que recorta a 10 caracteres en vez de convertir a `Date` (convertir correría el día hacia atrás en UTC-6). Verificado contra el valor real que devuelve Postgres.
- **Los servicios sin ninguna fecha se muestran igual**, en un bloque aparte y fuera del total. Filtrarlos sin más los habría hecho invisibles en todos los reportes, y se pagaría de menos sin enterarse.
- Solo entran renglones con dinero. La liquidación del viaje lista el viaje entero; esta es de consumo, y un servicio en cero es ruido entre lo que hay que pagar.
- El mapeo de los diez servicios se exportó desde `liquidacion.ts` en vez de copiarse: si mañana se agrega un servicio, aparece en los dos reportes o en ninguno.
- Se consultan las diez tablas enteras y se filtra en el cliente. La condición real es sobre un `coalesce`, que en PostgREST obliga a un `or(and(...),and(...))` distinto por tabla: diez cadenas a mano en un reporte de dinero. Con el volumen actual no vale el riesgo; si crece, se vuelve una función en la base.

**Commits clave:** ver `git log` de 2026-09-24.

---

## Fase 24 · 2026-09-24 · Restablecer la contraseña

**Objetivo:** el usuario instaló la webapp en su teléfono, no recordaba su contraseña y no tenía desde dónde cambiarla — ni siquiera siendo admin. No había ninguna ruta de recuperación en la aplicación.

**Cambios de schema:**
- `usuarios.email`, espejo de `auth.users.email`. El correo vive en el esquema `auth`, que no se puede leer desde el navegador, así que la pantalla de Usuarios no tenía forma de saber con qué correo entra cada quien.
- `handle_new_user()` reescrita para copiar el correo al crear la cuenta, con `on conflict (id) do update`.
- `handle_user_email_change()` + trigger `on_auth_user_email_changed`, para que el espejo no se quede viejo si el correo cambia después.

**Cambios de UI:**
- Login: enlace **Olvidé mi contraseña**, que manda el correo de recuperación con `resetPasswordForEmail`.
- Ruta `/nueva-clave` (fuera del armazón con menú, porque también se llega sin sesión desde el enlace del correo). Sirve para los dos casos: llegar del correo y cambiarla estando adentro.
- Barra superior: 🔑 para cambiarla en cualquier momento.
- Admin → Usuarios: se ve el correo de cada quien y hay un botón para mandarle el restablecimiento.

**Comentarios:**
- **Una contraseña no se puede ver, nunca.** Se guardan cifradas de un solo sentido; lo único posible es reemplazarlas. La pantalla de Admin lo dice explícitamente para que nadie vuelva a buscar dónde estaba.
- Las cuentas con correo interno inventado — el caso del presidente, `@cea.local` — no pueden recibir el enlace. Ese caso se atiende desde el panel de Supabase, y la pantalla lo explica en vez de ofrecer un botón que iba a fallar en silencio.
- `/nueva-clave` lleva un enlace **Volver sin cambiarla**: en la app instalada en el teléfono no hay botón de atrás del navegador, así que sin eso quedaba sin salida.
- No se pudo hacer desde aquí lo obvio —restablecer la contraseña de otro usuario directamente— porque eso exige la llave `service_role`, que no puede viajar al cliente. De ahí el rodeo del correo.

**Commits clave:** ver `git log` de 2026-09-24.

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

# PLAN · Servicio Ticket Aéreo (Fase 22)

**Fuente:** `TT_SERVICIOS- Ticket Aéreos.docx` (2026-09-22) + 4 imágenes de referencia.
**Estado:** pendiente de aprobación. No se toca código hasta el GO.

---

## 1 · El hallazgo que define el tamaño

El módulo de tickets que hay hoy en CEA **no es el del HTML**. Es el original de la
Fase 13, con un modelo pensado para control migratorio: guarda vencimiento de pasaporte,
número de libreta, país y vencimiento de visa, programa de viajero.

El documento pide otra cosa: equipaje, tarifa y extras por pasajero, escalas, múltiples
PNR y archivos adjuntos. Casi nada de eso existe.

| Lo que pide el documento | Estado hoy |
|---|---|
| Título del ticket | ❌ no existe |
| Reservado a través de | ❌ |
| Categoría (4 opciones) | ⚠️ existe `clase`, texto libre |
| **Varios PNR** por ticket | ⚠️ existe `codigo_reserva`, uno solo |
| Check-in inicio / fin | ⚠️ existe en el segmento, no en el ticket |
| **Directo / Con escala + No. de escalas** | ❌ |
| Segmentos con ruta, 2 fechas y PNR propio | ⚠️ el segmento tiene 1 fecha, sin ruta ni PNR |
| **Escalas** (IATA, ciudad, tiempo) | ❌ no existe la tabla |
| Pax: nacionalidad **múltiple** | ⚠️ una sola |
| Pax: No. de ticket, asiento | ❌ (están en el ticket, no por pasajero) |
| Pax: equipaje (personal / carry on / documentado) | ❌ |
| Pax: tarifa + extras con comentario | ❌ |
| Estatus HOLD/PARCIAL/CONFIRMADO/CANCELADO/ABIERTO | ❌ hoy usa otra lista |
| Forma de pago múltiple (dinero/millas/puntos/créditos) | ❌ |
| Penalidad por cambios (texto + monto) | ❌ |
| Adjuntar PDF boleto, boarding pass y SAT | ❌ |

**Conclusión:** esto no es agregarle campos al formulario. Es rehacer el modelo del
ticket y su formulario.

---

## 2 · Modelo propuesto

### 2.1 · `att_tickets` — columnas nuevas

```
titulo text                     -- "Vuelo GUA-MIA"
reservado_por text              -- agencia o plataforma
categoria text                  -- Económica | Premium Economy | Ejecutiva | Primera Clase
tipo_ticket text                -- OW | RT
vuelo_directo boolean           -- Directo vs Con escala
num_escalas int
checkin_ini time · checkin_fin time
estatus_pago text               -- HOLD | PAGO PARCIAL | CONFIRMADO | CANCELADO | ABIERTO
formas_pago text[]              -- DINERO | MILLAS | PUNTOS | CREDITOS
penalidad_desc text · penalidad_monto numeric
pagado_con_tc_id uuid           -- catálogo ADMIN › Tarjetas
pdf_boleto_path · pdf_boarding_path · pdf_sat_path   -- Supabase Storage
```

### 2.2 · Tablas nuevas

**`att_ticket_pnrs`** — un ticket puede tener varios PNR, y un segmento también.
```
id · ticket_id · segmento_id (null = PNR del ticket) · codigo · orden
```

**`att_segmento_escalas`** — escalas de un segmento.
```
id · segmento_id · iata · ciudad · tiempo interval/text · orden
```

### 2.3 · `att_ticket_segments` — columnas nuevas
```
ruta text · fecha_llegada date
```
(`fecha` pasa a ser la de salida; `direccion` ya distingue ida/retorno para los RT.)

### 2.4 · `att_ticket_pax` — columnas nuevas
```
nacionalidades text[]    -- reemplaza `nacionalidad` (que se conserva por ahora)
numero_ticket text · asiento text
eq_personal text · eq_carryon text · eq_documentado text
tarifa numeric · tarifa_nota text
extras numeric · extras_nota text
```

### 2.5 · Cómo se calcula el total

El documento dice "la sumatoria de todos los montos ingresados por pasajero por el
número de pasajeros". La imagen de referencia lo aclara: *"1 pasajero — suma de tarifa
+ extras"*.

**Interpretación: `total = Σ(tarifa + extras)` de cada pasajero.** No se multiplica por
el número de pasajeros — eso lo duplicaría. `att_tickets.monto` pasa a ser un valor
derivado que se recalcula al guardar.

---

## 3 · Pantallas

### 3.1 · Formulario (una sola pestaña, con secciones)

1. **Encabezado** — título, aerolínea, reservado a través de, categoría, PNR múltiples.
2. **Tipo** — OW / RT, directo o con escala + número de escalas, horario de check-in.
3. **Ruta** — si es OW, una lista de segmentos. Si es RT, dos bloques: Ida y Retorno,
   cada uno con sus segmentos. Cada segmento lleva su botón **+ Escala**.
4. **Pasajeros** — tarjetas apiladas con el botón **+ Agregar PAX** (imagen 2).
5. **Pago** — estatus, formas de pago, penalidad, pagado con, total general (imagen 3).
6. **Adjuntos** — PDF del boleto, boarding pass y SAT.

El buscador de aeropuertos por código IATA ya existe (`AirportPicker`, ~180
aeropuertos) y autocompleta la ciudad.

### 3.2 · Cómo se ve en la tarjeta del viaje (imagen 4)

Una línea por ticket, y si hay varios se apilan:

```
✈ GUA- MIA   [RESERVADO]                                   US$ 550,00   👁 ✏️ 🗑
  American Airlines · GUA → MIA · OW — Solo ida · 1 pax
```

Solo aerolínea, fechas, PNR, estatus de pago y total, como pide el documento.

### 3.3 · Vista previa imprimible

Rediseño de `ServicePrintable` **con el logo de Arriaza**, que ya está en el proyecto.
Sirve para los 11 servicios, no solo para tickets — es la pieza que el usuario pidió
como "diseño excepcional para descargar o imprimir".

---

## 4 · Los tres requisitos transversales

El usuario los pidió para **todos** los servicios, no solo para tickets:

1. **Vista previa con logo** en cada servicio → se resuelve una vez en `ServicePrintable`.
2. **Todo servicio con fecha entra al itinerario general** → verificar que el ticket
   aporte sus segmentos al itinerario por día, y dejar el patrón listo para los demás.
3. **Color propio por servicio** → ya existe en `SERVICE_META`: los 14 tienen su color
   sólido, oscuro y claro. Hay que usarlo de forma consistente en la fila del flyer, el
   encabezado del formulario y el imprimible.

**El total del ticket suma al total del viaje** — hoy la tarjeta ya muestra un costo
total; hay que confirmar que incluya los tickets con el nuevo cálculo.

---

## 5 · Orden de trabajo

| Paso | Qué | Entregable |
|---|---|---|
| **F22-1** | Migración: columnas nuevas + 2 tablas + types | Aplicada y verificada |
| **F22-2** | Formulario: encabezado, tipo, ruta con segmentos y escalas | Se captura una ruta completa |
| **F22-3** | Pasajeros con equipaje y tarifas + total | El total cuadra |
| **F22-4** | Pago, adjuntos y fila del flyer | Servicio completo |
| **F22-5** | Vista previa con logo (sirve para los 11) + itinerario | Imprimible y en el itinerario |

---

## 6 · Lo que necesito que decidas

**1 · El estatus de pago choca con el resto del módulo.** El documento pide HOLD,
PAGO PARCIAL, CONFIRMADO, CANCELADO y ABIERTO. Los otros 10 servicios usan hoy
Reservado, Pagado, Pago parcial, A pagar en propiedad y Cancelado. ¿Cambio la lista
solo en tickets, o unifico las dos listas para todos los servicios? Recomiendo unificar
— si no, el itinerario y los reportes van a mezclar dos vocabularios.

**2 · Moneda.** El documento pide todo en US$. ¿Los tickets son siempre dólares, o
mantengo el selector de moneda que ya existe?

**3 · Los archivos.** PDF del boleto, boarding pass y SAT van a Supabase Storage, en el
mismo bucket `documentos` que usa Finanzas. ¿De acuerdo?

**4 · Las nacionalidades.** Se pide selección múltiple de "abreviaturas de todas las
nacionalidades del mundo". Uso los códigos de país del catálogo que ya tenemos (213
países). ¿Sirve?

---

## 7 · Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo viejo de pasajeros (pasaporte, visa, libreta) queda huérfano | No se borra nada: las columnas se conservan y el formulario deja de pedirlas. Si se necesitan para migración, siguen ahí. |
| El formulario se vuelve gigante y pesado de usar | Secciones colapsables y guardado por partes. El documento ya pide un botón "Finalizar carga de Ticket". |
| Romper los tickets que ya existan | Hoy hay **0 tickets** en la base. Riesgo nulo. |
| El chunk de `/arriaza` crece | Ya es lazy; se mide en cada build contra el tope de 145 KB gzip del inicial. |

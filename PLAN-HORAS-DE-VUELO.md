# PLAN · Aeronaves · Horas de vuelo

## Objetivo

La bitácora de vuelo del TG-OBI: cuándo voló, cuántas horas, quién iba al
mando, quiénes viajaron, y —cuando el uso fue personal— a quién se le cobra la
hora.

> *«Cuando hablo de horas y pagos es porque a veces al usarlo de forma personal
> se saca un costo de hora de vuelo… le cobro a ellos mismos cuando es
> personal, pero eso es el 3% del 100% de vuelos del OBI.»*

Ese 3% es la razón de ser del cobro, pero el 97% restante también hay que
registrarlo: las horas son lo que dispara los mantenimientos y lo que dice
cuánto se usó la aeronave.

**Fuera de alcance, por decisión de la usuaria:** los **ciclos**. *«Mi alcance
de información no llegará a los ciclos, nada más a horas.»* El mock los traía
por el King Air; acá no van.

## De dónde salen las horas

Del **horómetro**, no del reloj. Cada tramo guarda el horómetro al salir y al
llegar, y la diferencia son las horas de ese tramo. Las horas del vuelo son la
suma de sus tramos.

```
tramo:  MGGT → MGRT   horómetro 4212.4 → 4213.2   =  0.8 h
        MGRT → MGQZ   horómetro 4213.2 → 4213.9   =  0.7 h
        MGQZ → MGGT   horómetro 4213.9 → 4214.5   =  0.6 h
                                          vuelo:     2.1 h
```

La hora de salida y llegada de reloj se guardan aparte: sirven para el
itinerario y para calcular la **espera**, que sí se cobra, pero no son las
horas de vuelo.

## Modelo

### `avn_pilotos` — catálogo
Del mock: *«Se capturan una vez y se escogen en cada vuelo.»*
- `nombre`, `licencia`, `tipo` (PPL · dueño, Instructor…), `medico_vence`
- El vencimiento del médico se vigila igual que los certificados de la
  aeronave: un piloto con el médico vencido no debería volar.

No se usa `personas` para esto: un piloto necesita licencia y vencimiento
médico, que esa tabla no tiene ni debería tener. Sí se usa `personas` para **a
quién se le cobra**, que es justo lo que esa tabla sí sabe.

### `avn_aeronaves` — tres tarifas más
Son propuestas, no verdades fijas (*«no es tarifa fija»*):
- `tarifa_piloto` — cuando vuela un piloto contratado
- `tarifa_instructor` — cuando el vuelo es de instrucción
- `tarifa_espera` — por hora de espera
- `tarifa_hora` — la hora de vuelo que se le cobra a quien lo usa personal

### `avn_vuelos`
- correlativo `VU-AAAA-####`, `aeronave_id`, `fecha`, `numero` (el del operador)
- `mando`: `piloto` | `dueno` | `instruccion`
  - *«Cuando vuela el dueño no hay costo de piloto. En instrucción se paga la
    tarifa del instructor.»*
- `piloto_id`, `instructor_id`
- `uso`: `trabajo` | `personal`
- `cobrar_a_id` → `personas`, solo cuando el uso es personal
- **`tarifa_hora_aplicada`** — la tarifa **se copia al vuelo**. *«Si mañana
  sube, lo ya cobrado no se recalcula.»* Misma razón por la que la liquidación
  de T&T guarda el texto de la tarjeta.
- `viaticos`, `otros`, `notas`

### `avn_vuelo_tramos`
- `origen`, `destino` (OACI), `hora_salida`, `hora_llegada`
- `horometro_salida`, `horometro_llegada`
- `horas` — **columna generada**: `llegada − salida`
- `espera` (horas), `notas`

### `avn_vuelo_pax`
Una fila por pasajero. *«Pasajeros que sean agregados, no solo en una fila
todos, porque si después lo quiero descargar no lo puedo filtrar.»*

## UI

Pestaña nueva en la aeronave: **Horas de vuelo**.

1. **Cabecera** — horas del mes, horas del año, horómetro actual.
2. **Bitácora** — un renglón por vuelo con fecha, número, ruta, horas, mando,
   uso y —si es personal— a quién se le cobra y cuánto.
3. **Formulario** de tres niveles: vuelo → tramos → pasajeros, con la misma
   idea de bloques a color que quedó bien en el crucero.
4. **Hoja imprimible** del vuelo, y para el 3% de uso personal, la hoja de
   cobro con su tarifa.
5. **Pilotos** — catálogo pequeño, con aviso cuando el médico está por vencer.

## Lo que falta decidir

1. **Los galones por tramo.** El mock los traía (`galones inicio`, `galones
   final`, `cargados`, `precio`, `FBO`). Pero el consumo de fuel ya se captura
   en la pestaña de Combustible como facturas de Aeroclub. Tenerlo en los dos
   lados son dos verdades sobre el mismo número.
2. **Viáticos y otros gastos del vuelo**: ¿se anotan acá como referencia, o son
   pagos que van por su propio camino?
3. **El correlativo**: ¿`VU-AAAA-####` para todas las aeronaves, o uno por
   matrícula?

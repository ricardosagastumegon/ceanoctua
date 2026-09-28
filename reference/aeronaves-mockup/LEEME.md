# Mock de la flota · TG-FLY y TG-OBI

`mock-flota.html` es un **prototipo para revisión**, no código del sistema.
Se abre con doble clic, funciona sin internet salvo por las tipografías, y se
puede mandar por correo a quien tenga que opinar: el piloto, la secretaria o
los propietarios.

## Qué trae

Dos aeronaves, con su propia configuración, vuelos, plan de mantenimiento y
pilotos:

- **TG-FLY** · King Air 300, compartida entre dos propietarios. Los costos
  fijos se dividen mitad y mitad; los variables de cada vuelo los cubre quien
  lo solicitó, y cuando vuelan juntos se reparte por el porcentaje de ese
  vuelo.
- **TG-OBI** · Cirrus SR22T, propia. **No reparte nada.** Cuando vuela el
  dueño no hay costo de piloto; en instrucción se paga la tarifa del
  instructor; y el uso personal se cobra por hora a quien lo usó.

Cuatro vistas por audiencia: **Piloto** (tramos, horómetro, ciclos,
combustible por ala), **Administración** (costos, pasajeros, tarifas),
**Mantenimiento** (plan con alertas por horas, ciclos o calendario) y
**Cierre**.

## Cómo tratarlo

Es un mock: HTML suelto con JavaScript y `localStorage`. **No se copia al
proyecto.** Cuando el formato quede aprobado se construye en el stack de
NOCTUA —React, Supabase, RLS y `audit_log`— igual que se hizo con el módulo
de Aeronaves. Véase `memory/feedback_provider_html_modules.md`.

Lo que se edite en el archivo queda guardado solo en ese navegador; sirve
para probar las fórmulas, no para llevar datos reales.

## De dónde sale

Se genera desde el artifact de revisión:
https://claude.ai/artifact/GPSPhtgyXR2d9pyBja7QwZ

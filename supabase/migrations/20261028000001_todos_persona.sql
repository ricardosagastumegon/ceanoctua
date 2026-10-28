-- CEA · To-dos · a quién de la JD pertenece el pendiente
--
-- La usuaria: "si un pendiente es de alguno de ellos pueda agregarse y ser un
-- filtro despues". Son los que ya estan en `personas` --la unica fuente de
-- personal de JD, por la invariante 4-- asi que se referencia esa tabla en
-- vez de repetir los nombres.
--
-- Solo el id, sin copiar el nombre: esto es una lista operativa, no un
-- documento financiero. Si manana se corrige como esta escrito un nombre, lo
-- correcto es que el pendiente lo muestre corregido. Lo contrario --guardar
-- el texto del dia-- se hace en liquidaciones y estados de cuenta, donde
-- reescribir el pasado si seria un error.

alter table public.cea_todos
  add column if not exists persona_id uuid references public.personas(id);

create index if not exists cea_todos_persona_idx
  on public.cea_todos (persona_id) where persona_id is not null;

comment on column public.cea_todos.persona_id is
  'De quien de la JD es el pendiente. Se lee de `personas`; el nombre no se copia a proposito.';

-- Estas dos nacieron con la tabla y nunca se usaron --0 de 31 filas-- ni
-- aparecen en el formulario. Se dejan anotadas para que nadie las confunda
-- con la columna de arriba; borrarlas es otra conversacion.
comment on column public.cea_todos.responsable is
  'DEPRECADA · nunca se uso. Para el personal de JD esta `persona_id`.';
comment on column public.cea_todos.empleado_id is
  'DEPRECADA · nunca se uso, y apunta a `empleados`, no a `personas`.';

NOTIFY pgrst, 'reload schema';

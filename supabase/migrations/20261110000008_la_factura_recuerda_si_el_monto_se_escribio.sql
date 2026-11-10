-- Fase 59 · La factura recuerda si su monto se escribió o se calculó
--
-- EL CASO QUE ELLA TRAJO. Ingresó la factura `DCA74135` con un solo vale
-- --Q 559.01--. Después se dio cuenta de que faltaba el segundo vale de esa
-- misma factura, lo capturó, editó la factura y lo agregó. En vales todo se
-- ve bien, pero la factura quedó avisando: «los vales escogidos suman
-- Q 609.02» contra un monto de Q 559.01.
--
-- LA ALERTA TIENE RAZÓN, Y NO ES EL FALLO. Es exactamente lo que esa pantalla
-- existe para hacer, con las palabras que ella misma dio: «el ingreso del
-- monto es manual y eso es causante de doble error, porque en el despacho
-- también fue manual». Dos cifras que se pueden desmentir valen más que una
-- sola en la que hay que confiar.
--
-- EL FALLO ESTÁ ANTES. El formulario decide así si el monto es del papel o
-- de la suma:
--
--     const [montoManual, setMontoManual] = useState(inicial?.monto != null);
--
-- Es decir: **lo adivina**. Si la factura trae un monto guardado, asume que
-- alguien lo escribió a propósito. Pero el monto de `DCA74135` nunca se
-- escribió: al crearla con un solo vale, la pantalla lo calculó sola --ese es
-- su comportamiento por omisión-- y se guardó. Al reabrirla, ese número
-- calculado pasó por tecleado, el monto se congeló, y agregar el segundo vale
-- ya no pudo moverlo.
--
-- Lo que falta es un dato que nadie guardó: **si una persona escribió ese
-- número o lo puso la máquina**. Es el mismo error de forma que la fase 57
-- resolvió al revés --«el origen se graba al crearla, no se deduce después;
-- un dato que se recalcula cada vez que alguien mira es un dato que cambia de
-- respuesta»--. Aquí el dato ni siquiera se recalcula: se adivina de una
-- pista que no distingue los dos casos.
--
-- Con la columna, el comportamiento es el que ella esperaba sin tener que
-- saber ningún truco:
--
--   monto calculado  + agrega un vale  ->  el monto sigue a la suma
--   monto escrito    + agrega un vale  ->  el monto NO se toca, y avisa
--
-- EL RELLENO de las facturas que ya existen usa la única pista disponible:
-- si el monto guardado coincide con la suma de sus vales, lo puso la máquina;
-- si no coincide, alguien lo escribió. Es una inferencia, pero se hace UNA
-- VEZ y queda escrita, en vez de rehacerse cada vez que se abre la pantalla.
-- Hoy sale: ocho facturas calculadas y una escrita --la de ella--, que es
-- justamente la que debe seguir avisando hasta que la confirme.

alter table public.comb_facturas
  add column if not exists monto_manual boolean not null default false;

comment on column public.comb_facturas.monto_manual is
  'Si el monto lo escribió una persona (true) o lo calculó la pantalla sumando '
  'los despachos de sus vales (false). Sin este dato la pantalla lo adivinaba '
  'por «tiene monto guardado», que no distingue los dos casos.';

-- Relleno de una sola vez, para las que ya existían.
update public.comb_facturas f
   set monto_manual = (
     f.monto is distinct from (
       select coalesce(sum(s.monto), 0) from public.comb_solicitudes s
        where s.factura_id = f.id and s.deleted_at is null
     )
   )
 where f.deleted_at is null;

-- ══════════════════════════════════════════════════════════════════════
-- Comprobación
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  v_rep text := '';
  v_n   int;
  v_m   int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='comb_facturas'
       and column_name='monto_manual'
  ) then
    v_mal := v_mal || 'no se creó la columna; ';
  end if;

  -- Las que cuadran quedaron como calculadas...
  select count(*) into v_n
    from public.comb_facturas f
   where f.deleted_at is null and f.monto_manual
     and f.monto is not distinct from (
       select coalesce(sum(s.monto), 0) from public.comb_solicitudes s
        where s.factura_id = f.id and s.deleted_at is null);
  if v_n > 0 then
    v_mal := v_mal || format('%s facturas que cuadran quedaron como escritas; ', v_n);
  end if;

  -- ...y las que no cuadran, como escritas: si no, dejarían de avisar.
  select count(*) into v_n
    from public.comb_facturas f
   where f.deleted_at is null and not f.monto_manual
     and f.monto is distinct from (
       select coalesce(sum(s.monto), 0) from public.comb_solicitudes s
        where s.factura_id = f.id and s.deleted_at is null);
  if v_n > 0 then
    v_mal := v_mal || format('%s facturas descuadradas dejarían de avisar; ', v_n);
  end if;

  select count(*) into v_n from public.comb_facturas where deleted_at is null;
  select count(*) into v_m from public.comb_facturas where deleted_at is null and monto_manual;
  v_rep := format('facturas: %s, de ellas con monto escrito a mano: %s', v_n, v_m);

  if v_mal <> '' then
    raise exception 'NO QUEDÓ BIEN: % || %', v_mal, v_rep;
  end if;
  raise notice 'OK || %', v_rep;
end $$;

NOTIFY pgrst, 'reload schema';

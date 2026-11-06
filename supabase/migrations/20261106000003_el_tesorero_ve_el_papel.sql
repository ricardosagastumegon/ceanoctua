-- Fase 47 · Los envios que ya se mandaron tambien llevan su documento
--
-- EL PROBLEMA: «Victor al recibirla NO tiene ningun boton en donde pueda ver
-- la solicitud de vale con el formato OFICIAL que yo si veo, solo ve un
-- resumen».
--
-- El arreglo es de pantalla --un boton «Ver» junto a «Emitir vale»-- pero
-- apoyado en un cambio de datos: el `snapshot` del envio llevaba cinco campos
-- sueltos y el formato necesita trece. El Tesorero no puede leer
-- `comb_solicitudes` y no debe poder: RLS concede por tabla, asi que darle
-- esa lectura seria darle todos los vales de la casa. Lo unico que cruza
-- entre dos usuarios es lo que alguien manda a proposito, y eso es el envio.
--
-- El codigo nuevo mete `snapshot.documento` al enviar. Esta migracion se lo
-- pone a los que YA se mandaron, que son justo los que ella esta probando:
-- sin esto, el boton no aparece en las tres solicitudes que el tiene en
-- pantalla y la correccion se veria como si no hubiera pasado.
--
-- Se arma con los mismos campos y el mismo orden que `datosDeSolicitud` en
-- `src/modules/combustible/documento.ts`. No se toca nada mas del snapshot.

do $$
declare v_n int;
begin
  update public.envios e
     set snapshot = coalesce(e.snapshot, '{}'::jsonb) || jsonb_build_object(
       'documento', jsonb_strip_nulls(jsonb_build_object(
         'fecha',              s.fecha,
         'vale_num',           s.vale_num,
         'vale_a',             s.vale_a,
         'marca',              v.marca,
         -- Los cuadros de «vehiculos varios» no tienen carro de catalogo:
         -- ahi la placa se escribe en la propia solicitud.
         'placa',              coalesce(v.placa, s.placa_libre),
         'tipo',               v.tipo,
         'departamento',       s.departamento,
         'justificacion',      s.justificacion,
         'autorizado_por',     aut.nombre,
         'solicitado_por',     coalesce(perS.nombre, empS.nombre),
         'monto_autorizado',   s.monto_autorizado,
         'kilometraje_actual', s.kilometraje_actual,
         'km_ultima_llenada',  s.km_ultima_llenada
       ))
     )
    from public.comb_solicitudes s
    left join public.vehiculos v   on v.id    = s.vehiculo_id
    left join public.personas  aut on aut.id  = s.autorizado_por_id
    left join public.personas  perS on perS.id = s.solicitado_por_persona_id
    left join public.empleados empS on empS.id = s.solicitado_por_id
   where e.doc_tipo = 'comb_solicitud'
     and e.doc_id = s.id
     and e.deleted_at is null
     and not (e.snapshot ? 'documento');

  get diagnostics v_n = row_count;
  raise notice 'Envios a los que se les puso el documento: %', v_n;
end $$;

-- ── Comprobacion ───────────────────────────────────────────────────────
--
-- Importa que lo lleven TODOS los que tienen su solicitud viva. Uno sin
-- documento es un envio al que el Tesorero le ve la ficha y no el papel, que
-- es exactamente lo que se viene a quitar.

do $$
declare
  v_sin  int;
  v_con  int;
  v_mal  text := '';
begin
  select count(*) into v_sin
    from public.envios e
    join public.comb_solicitudes s on s.id = e.doc_id and s.deleted_at is null
   where e.doc_tipo = 'comb_solicitud' and e.deleted_at is null
     and not (e.snapshot ? 'documento');

  select count(*) into v_con
    from public.envios e
   where e.doc_tipo = 'comb_solicitud' and e.deleted_at is null
     and e.snapshot ? 'documento';

  if v_sin > 0 then
    v_mal := v_mal || format('%s envios de vale siguen sin documento; ', v_sin);
  end if;

  -- Y que el documento traiga de verdad lo que el formato imprime, no un
  -- objeto vacio que pase la comprobacion de arriba sin servir de nada.
  if exists (
    select 1 from public.envios e
     where e.doc_tipo = 'comb_solicitud' and e.deleted_at is null
       and e.snapshot ? 'documento'
       and nullif(trim(coalesce(e.snapshot -> 'documento' ->> 'vale_a', '')), '') is null
  ) then
    v_mal := v_mal || 'algun documento salio sin «Vale a»; ';
  end if;

  if v_mal <> '' then
    raise exception 'No quedo bien: %. No se guarda nada.', v_mal;
  end if;

  raise notice 'Envios de vale con documento: %', v_con;
end $$;

NOTIFY pgrst, 'reload schema';

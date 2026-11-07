-- Fase 50 · El expediente viaja la cadena hasta la SP
--
-- LO QUE FALTABA, en sus palabras: «si hablamos de COMBUSTIBLES es en ese
-- paso de la cadena [el control de vales] que se debe de cargar 1 PDF con
-- todos los vales, despachos, facturas y contraseñas para que soporte al
-- llegar a la SP final». Y: «ten en cuenta que cuando hablamos de SP es la
-- parte final que puede tener orígenes diferentes, las SP pueden nacer desde
-- un vale pasar por una liquidación o pueden nacer desde un vale de
-- combustible pasar por toda la cadena y llegar, entonces a la SP».
--
-- Eso cambia una cosa de fondo respecto de la fase anterior. Alli el adjunto
-- colgaba de la SP y la regla era «lo ve quien ve la SP». Sigue valiendo,
-- pero ahora el respaldo NO SE SUBE EN LA SP: se sube donde se arma, que es
-- el ultimo paso antes de mandarla a Pagos. La SP es el final de cadenas
-- distintas, y el expediente tiene que llegar hasta ella desde donde sea que
-- nacio.
--
-- Asi que la regla se extiende sin cambiar de forma: un documento colgado de
-- un ORIGEN lo ve quien puede ver la SP a la que ese origen llega. Para
-- Victor y para Lissa es lo mismo de antes --abren el expediente de la SP y
-- esta todo-- aunque ninguno de los dos pueda leer `comb_reportes` ni
-- `pagos_notificaciones`.
--
-- POR QUE EL MAPA LLEVA LAS CUATRO CADENAS y no solo la del combustible, que
-- es la unica que se usa hoy: porque la usuaria ya describio la siguiente
-- --«en caja chica se adjuntará un documento PDF con las facturas de
-- respaldo [...] en la liquidación»-- y escribir las cuatro ahora cuesta
-- cuatro lineas, mientras que volver a tocar una politica de seguridad
-- dentro de tres meses cuesta acordarse de que habia que tocarla.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · De un documento de origen a su solicitud de pago
-- ══════════════════════════════════════════════════════════════════════
--
-- `security definer` porque tiene que atravesar `pagos_notificaciones`, que
-- ni Victor ni Lissa leen. No devuelve datos: devuelve un identificador, y
-- quien decide si ese identificador se puede ver es `puede_ver_pago`, que
-- sigue siendo `security invoker`. Resolver el camino y conceder el permiso
-- son dos actos distintos y conviene que lo sigan siendo.

create or replace function public.pago_del_documento(p_tipo text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id
    from public.pagos_notificaciones n
    join public.pagos p on p.origen_notificacion_id = n.id
   where n.origen_id = p_id
     and n.origen_tipo = case p_tipo
           when 'comb_reporte'           then 'combustible_vehiculos'
           when 'caja_chica_liquidacion' then 'liquidacion'
           when 'consumo'                then 'consumo_tc'
           when 'avn_combustible'        then 'combustible'
           else null
         end
     and p.deleted_at is null
   order by p.created_at
   limit 1;
$$;

comment on function public.pago_del_documento(text, uuid) is
  'La solicitud de pago a la que llega un documento de origen (control de vales, liquidacion, consumo...). Solo resuelve el camino; quien concede es puede_ver_pago.';

revoke execute on function public.pago_del_documento(text, uuid) from public, anon;
grant  execute on function public.pago_del_documento(text, uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · La regla, extendida
-- ══════════════════════════════════════════════════════════════════════
--
-- `puede_ver_pago(null)` da falso --sus dos `exists` no encuentran nada con
-- id nulo-- asi que un origen que todavia no llego a ninguna SP solo lo ve
-- quien opera. Es lo correcto: mientras el control de vales esta abierto, su
-- expediente es cosa de quien lo arma.

drop policy if exists documentos_read on public.documentos;
create policy documentos_read on public.documentos for select
  using (
    case entidad_tipo
      when 'pago' then public.puede_ver_pago(entidad_id)
      when 'firmas' then exists (
        select 1 from public.firmas f where f.id = entidad_id)
      when 'vouchers' then exists (
        select 1 from public.vouchers v where v.id = entidad_id)
      else
        public.auth_rol() in ('admin','asistente')
        or public.puede_ver_pago(public.pago_del_documento(entidad_tipo, entidad_id))
    end
  );

-- ══════════════════════════════════════════════════════════════════════
-- 3 · El bucket · y una mina que puso la fase anterior
-- ══════════════════════════════════════════════════════════════════════
--
-- Para los ADJUNTOS no hay nada que cambiar, y eso es la prueba de que la
-- regla quedo en el sitio correcto: la politica del bucket pregunta por la
-- fila de `documentos`, asi que hereda la extension de arriba sin tocarse.
--
-- PERO el bucket `documentos` guarda algo mas que adjuntos: tambien las
-- ESTAMPAS DE FIRMA (`usuarios.firma_path`), que no tienen fila en
-- `documentos` porque no son adjuntos de nada --son la imagen que se imprime
-- sobre los documentos que esa persona firmo.
--
-- Al acotar el bucket en 20261107000002 quedaron fuera. Hoy no se nota
-- porque el bucket esta vacio, pero el dia que se suba una firma la hoja
-- saldria en blanco justo en el renglon de la firma, Y SIN DECIR NADA: el
-- codigo que la busca se traga el error a proposito para no romper el
-- documento entero. Un fallo silencioso en un papel que se firma es de los
-- peores que se pueden dejar puestos.
--
-- La politica anterior a todo esto era `auth.uid() IS NOT NULL` para el
-- bucket entero. Lo que se restituye aqui es ESO Y SOLO ESO, acotado a los
-- archivos de firma: quien ve un documento firmado tiene que poder ver la
-- firma. Si algun dia se quiere apretar mas --que la estampa de alguien solo
-- la vea quien tenga delante un documento suyo-- se aprieta aqui, con el
-- expediente ya a salvo.

create or replace function public.es_estampa_de_firma(p_path text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.usuarios u where u.firma_path = p_path);
$$;

comment on function public.es_estampa_de_firma(text) is
  'Si ese archivo del bucket es la estampa de firma de alguien. Security definer porque cada quien solo lee su propia fila de `usuarios`, y la firma que hay que imprimir es la de OTRO.';

revoke execute on function public.es_estampa_de_firma(text) from public, anon;
grant  execute on function public.es_estampa_de_firma(text) to authenticated;

drop policy if exists "documentos read" on storage.objects;
create policy "documentos read" on storage.objects for select
  using (
    bucket_id = 'documentos'
    and (
      exists (select 1 from public.documentos d where d.storage_path = storage.objects.name)
      or public.es_estampa_de_firma(storage.objects.name)
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_mal text := '';
  pol   text;
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'pago_del_documento'
  ) then
    v_mal := v_mal || 'falta pago_del_documento; ';
  end if;

  if has_function_privilege('anon', 'public.pago_del_documento(text, uuid)', 'execute') then
    v_mal := v_mal || 'anon puede ejecutar pago_del_documento; ';
  end if;

  select qual into pol from pg_policies
   where schemaname = 'public' and tablename = 'documentos' and policyname = 'documentos_read';
  if pol is null or pol not like '%pago_del_documento%' then
    v_mal := v_mal || 'documentos_read no sigue la cadena hasta la SP; ';
  end if;
  if pol not like '%puede_ver_pago%' then
    v_mal := v_mal || 'documentos_read dejo de apoyarse en puede_ver_pago; ';
  end if;

  -- Y que la estampa de firma no se haya quedado fuera del bucket.
  select qual into pol from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'documentos read';
  if pol is null or pol not like '%es_estampa_de_firma%' then
    v_mal := v_mal || 'el bucket dejaria la firma sin imprimir; ';
  end if;
  if pol not like '%storage_path%' then
    v_mal := v_mal || 'el bucket dejo de apoyarse en la tabla documentos; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

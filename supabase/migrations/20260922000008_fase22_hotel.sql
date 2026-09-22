-- Fase 22 · Servicio Hotel según TT_SERVICIOS-HOTEL.docx
--
-- El hotel ya tenía casi todo el modelo desde la Fase 19 — habitaciones
-- múltiples y servicios extras incluidos. Faltan teléfono, early check-in,
-- estado de pago y el adjunto de confirmación.
--
-- Además se unifica el vocabulario entre servicios, que hoy no cuadra:
--
--   1) El hotel guarda "reservado a través de" en `ota` y "pagado con" en
--      `pay`; el ticket los llama `reservado_por` y `pagado_con`. Con once
--      servicios por construir, que cada uno bautice lo mismo distinto obliga
--      a recordar el sinónimo en cada printable y cada resumen. Se agregan las
--      columnas con el nombre común y se copia el dato de la fila existente.
--
--   2) En el ticket usé `estatus_pago` para el desplegable, pero en los otros
--      diez servicios `estatus_pago` es la nota libre ("Depósito 50% pagado")
--      y `estado_pago` es el desplegable. El documento del hotel confirma esa
--      división. Se corrige el ticket para que coincida: hoy hay 0 tickets,
--      así que no hay dato en riesgo.

-- ============================================================
-- 1) att_hoteles — lo que pide el documento
-- ============================================================
alter table public.att_hoteles
  add column if not exists telefono text,
  add column if not exists reservado_por text,
  add column if not exists pagado_con text,
  add column if not exists early_checkin text,
  add column if not exists estatus_pago text,
  add column if not exists estado_pago text,
  add column if not exists comentarios text,
  add column if not exists confirmacion_path text;

update public.att_hoteles
   set reservado_por = coalesce(reservado_por, ota),
       pagado_con = coalesce(pagado_con, pay)
 where ota is not null or pay is not null;

comment on column public.att_hoteles.ota is
  'DEPRECADA (fase 22) — usar reservado_por, que es como lo llaman los demás servicios.';
comment on column public.att_hoteles.pay is
  'DEPRECADA (fase 22) — usar pagado_con.';
comment on column public.att_hoteles.monto is
  'Derivado: suma de (tarifa × noches) por habitación + servicios extras.';

-- ============================================================
-- 2) att_tickets — corregir el nombre del desplegable
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'att_tickets'
       and column_name = 'estatus_pago'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'att_tickets'
       and column_name = 'estado_pago'
  ) then
    alter table public.att_tickets drop constraint if exists att_tickets_estatus_pago_chk;
    alter table public.att_tickets rename column estatus_pago to estado_pago;
    -- La nota libre vuelve a existir con su nombre de siempre.
    alter table public.att_tickets add column estatus_pago text;
  end if;
end $$;

-- ============================================================
-- 3) Lista unificada de estado de pago
--
--    Solo se aplica a los dos servicios ya construidos bajo el documento
--    nuevo. Los otros nueve conservan su lista vieja hasta que les toque su
--    propio documento: ponerles el CHECK ahora invalidaría datos que todavía
--    no se han revisado.
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'att_tickets_estado_pago_chk') then
    alter table public.att_tickets add constraint att_tickets_estado_pago_chk
      check (estado_pago is null or estado_pago in
        ('HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'att_hoteles_estado_pago_chk') then
    alter table public.att_hoteles add constraint att_hoteles_estado_pago_chk
      check (estado_pago is null or estado_pago in
        ('HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'));
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

-- CEA · las dos clases de firma, y poder firmarlas
--
-- LAS DOS CLASES
--
-- Una firma digital nace dentro del sistema: alguien la dispara desde una
-- solicitud de pago o desde una liquidacion, y el documento ya esta en CEA.
-- Una firma fisica es un papel que alguien trajo a la oficina: se registra a
-- mano para dejar constancia y avisar que hay algo que firmar.
--
-- Hasta hoy la diferencia se deducia de si la firma tenia `pago_id`. Eso
-- funcionaba por accidente --Pagos era el unico que las creaba-- y se rompe en
-- cuanto las liquidaciones tambien las envien, que es justo lo que sigue. La
-- clase pasa a ser un dato.
--
-- FIRMAR
--
-- No habia forma de firmar: para marcar una como firmada habia que abrir el
-- formulario de edicion y cambiar un desplegable. Se agrega de quien es la
-- firma --`firmada_por`-- y donde vive la imagen de la firma de cada usuario,
-- para que el documento salga estampado y no solo marcado.

-- ── 1 · De donde viene la firma ──────────────────────────────────────────
alter table public.firmas
  add column if not exists origen text not null default 'fisica',
  add column if not exists liquidacion_id uuid references public.caja_chica_liquidaciones(id),
  add column if not exists firmada_por uuid references public.usuarios(id);

alter table public.firmas drop constraint if exists firmas_origen_chk;
alter table public.firmas add constraint firmas_origen_chk
  check (origen in ('digital', 'fisica'));

comment on column public.firmas.origen is
  'digital = la disparo el sistema desde un pago o una liquidacion; fisica = papel registrado a mano.';
comment on column public.firmas.liquidacion_id is
  'La liquidacion que la origino, cuando viene de Caja Chica.';
comment on column public.firmas.firmada_por is
  'Quien la firmo. Se llena al firmar, junto con fecha_firma.';

create index if not exists firmas_liquidacion_idx on public.firmas(liquidacion_id);

-- Lo ya registrado: lo que vino de un pago es digital, el resto es papel.
update public.firmas set origen = 'digital' where pago_id is not null;

-- ── 2 · La firma de cada quien ───────────────────────────────────────────
-- La imagen vive en el bucket `documentos`, que ya existe y es privado.
alter table public.usuarios
  add column if not exists firma_path text;

comment on column public.usuarios.firma_path is
  'Ruta en el bucket documentos de la imagen de su firma, para estampar los documentos que firma.';

NOTIFY pgrst, 'reload schema';

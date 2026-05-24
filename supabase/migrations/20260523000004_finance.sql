-- Phase 2 - Migration 0004
-- Finance: TC consumos, reintegros, caja chica, pagos, vouchers.
-- Note: tc_consumos and reintegros reference each other. Tables are created
-- first without the cross-reference, then both FKs are added at the end.

-- TC consumos (fusion: maatc + latc + aceConsumos) ------------------------
create table tc_consumos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  origen        text,                              -- 'maa' | 'la' | 'ace'
  voucher_num   text,                              -- 'VCH-0001' (de seq_voucher)
  fecha         date not null,
  empresa       text,
  card_id       text not null,
  tarjeta_id    uuid references tarjetas_credito(id),
  proveedor     text not null,                     -- 'supplier'
  proveedor_id  uuid references proveedores(id),
  concepto      text not null,
  monto         numeric(14,2) not null,
  moneda        currency not null,
  autorizo      text,
  autorizador_id uuid references autorizadores(id),
  reintegro_id  uuid,                              -- FK agregada al final
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index tc_consumos_fecha_idx     on tc_consumos (fecha);
create index tc_consumos_card_idx      on tc_consumos (card_id);
create index tc_consumos_origen_idx    on tc_consumos (origen);
create index tc_consumos_proveedor_idx on tc_consumos (proveedor_id);
create index tc_consumos_active_idx    on tc_consumos (deleted_at) where deleted_at is null;

-- Reintegros (fusion: larei + reintegros de ACE) --------------------------
create table reintegros (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  fecha         date not null,
  empresa       text not null,
  tc_empresa    text,
  card_id       text not null,
  consumo_id    uuid references tc_consumos(id),  -- ex 'linkedId'
  monto         numeric(14,2) not null,
  moneda        currency not null,
  autorizo      text,
  autorizador_id uuid references autorizadores(id),
  notas         text,
  estado        reintegro_status not null default 'generada',
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index reintegros_fecha_idx   on reintegros (fecha);
create index reintegros_consumo_idx on reintegros (consumo_id);
create index reintegros_estado_idx  on reintegros (estado);
create index reintegros_active_idx  on reintegros (deleted_at) where deleted_at is null;

-- Close the cycle: tc_consumos.reintegro_id -> reintegros(id)
alter table tc_consumos
  add constraint tc_consumos_reintegro_fk
  foreign key (reintegro_id) references reintegros(id);

-- Caja chica - vales (ccVales) -------------------------------------------
create table caja_chica_vales (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  serial      text unique,                         -- 'CC-0001' (de seq_cc_vale)
  fecha       date,
  moneda      currency not null default 'GTQ',
  monto       numeric(14,2) not null,
  vale_a      text not null,                       -- 'valeA'
  empleado_id uuid references empleados(id),
  entidad     text,
  entidad_id  uuid references entidades(id),
  concepto    text,
  lugar       text,
  estado      vale_status not null default 'Creado',
  notas       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index caja_chica_vales_estado_idx on caja_chica_vales (estado);
create index caja_chica_vales_active_idx on caja_chica_vales (deleted_at) where deleted_at is null;

-- Caja chica - liquidaciones (ccLiq) -- ajustar contra el HTML ------------
create table caja_chica_liquidaciones (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  fecha       date not null,
  periodo     text,                                -- ej. '2026-05'
  moneda      currency not null default 'GTQ',
  monto_total numeric(14,2) not null default 0,
  responsable text,
  empleado_id uuid references empleados(id),
  notas       text,
  estado      text not null default 'Creada',
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Pagos (acePagos) -- ajustar contra el HTML ------------------------------
create table pagos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  fecha         date not null,
  proveedor     text,
  proveedor_id  uuid references proveedores(id),
  concepto      text,
  monto         numeric(14,2) not null,
  moneda        currency not null default 'GTQ',
  tipo          pago_tipo not null default 'transferencia',
  referencia    text,                              -- num cheque / transf
  banco         text,
  autorizo      text,
  autorizador_id uuid references autorizadores(id),
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index pagos_fecha_idx     on pagos (fecha);
create index pagos_proveedor_idx on pagos (proveedor_id);

-- Vouchers (aceVouchers) -- ajustar contra el HTML -----------------------
create table vouchers (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  serial        text unique,                       -- 'VCH-0001' (de seq_voucher)
  fecha         date not null,
  consumo_id    uuid references tc_consumos(id),
  concepto      text,
  monto         numeric(14,2),
  moneda        currency,
  estado        text,
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index vouchers_consumo_idx on vouchers (consumo_id);

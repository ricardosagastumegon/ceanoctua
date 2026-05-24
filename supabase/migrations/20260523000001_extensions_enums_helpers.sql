-- Phase 2 - Migration 0001
-- Extensions, enums, sequences and helper functions.

-- Extensions ---------------------------------------------------------------
create extension if not exists pgcrypto;

-- Enums --------------------------------------------------------------------
-- Defined in PLAN-FASE-2.md
create type currency         as enum ('USD','GTQ','EUR','GBP');
create type reintegro_status as enum ('generada','firmada','presentada','procesada','reintegrada');
create type tc_tipo          as enum ('corporativa','presidencia');

-- The following enums are placeholders. PLAN-FASE-2.md instructs to confirm
-- the exact values against reference/board-assistant-actual.html. Adjust the
-- values below (or add migrations that ALTER TYPE ... ADD VALUE) once the HTML
-- is available.
create type task_priority   as enum ('baja','media','alta');
create type task_status     as enum ('pendiente','en_progreso','completada','cancelada');
create type trip_status     as enum ('planificado','en_curso','completado','cancelado');
create type trip_type       as enum ('personal','trabajo','familia','salud','otro');
create type vale_status     as enum ('Creado','Aprobado','Liquidado','Anulado');
create type firma_status    as enum ('pendiente','firmado','presentado','procesado');
create type pago_tipo       as enum ('transferencia','cheque','efectivo','tarjeta','otro');
create type evento_tipo     as enum ('reunion','cumpleanos','aniversario','viaje','religioso','otro');

-- Sequences for human-readable serials ------------------------------------
create sequence if not exists seq_voucher    start with 1;
create sequence if not exists seq_cc_vale    start with 1;
create sequence if not exists seq_miel_corr  start with 1;

-- Helper: set updated_at automatically on UPDATE --------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

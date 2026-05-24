-- Phase 14 — Link pago → firma (one-to-many)
-- A pago can request multiple firmas during its lifecycle.
-- We add a single pago_id column on firmas (1 firma → 0/1 pago); a pago can
-- have many firmas pointing at it (1 pago → N firmas).
--
-- This is simpler than a junction table and matches the original HTML
-- behaviour where `linkedFirmas: number[]` was an array on the pago.

alter table public.firmas
  add column if not exists pago_id uuid references public.pagos(id);

create index if not exists firmas_pago_idx on public.firmas(pago_id);

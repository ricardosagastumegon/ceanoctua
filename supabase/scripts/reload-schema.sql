-- ============================================================
-- Force PostgREST schema cache reload
-- ============================================================
-- Cuando aplicas ALTER TABLE / CREATE TABLE / DROP COLUMN /
-- RENAME COLUMN y el frontend falla con:
--   "Could not find the 'X' column of 'Y' in the schema cache"
-- ...significa que PostgREST está sirviendo el schema viejo.
--
-- Esto fuerza un reload del cache (~5 segundos de efecto).
-- Después del NOTIFY, recarga la app con Ctrl+Shift+R.
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- Verificación opcional: contar tablas del schema public
SELECT count(*) as tablas_publicas
  FROM information_schema.tables
 WHERE table_schema = 'public';

-- ============================================================
-- SEED DE CATÁLOGOS · Base de datos Noctua (corregido)
-- Reemplaza al original seed-catalogos.sql.
--
-- Cambios vs original:
--  * entidades.dir       → entidades.direccion  (fix de schema)
--  * Encoding mojibake CP1252→UTF-8 corregido (á, é, í, ó, ú, ñ)
--  * Typos corregidos: "TesoserÃ­a" → "Tesorería", "8 día" → "8 días"
--  * Direcciones "Ciudad" placeholder → NULL
--  * Doble espacio en nombres → 1 espacio
--  * Idempotente: usa unique-key + DO blocks para evitar duplicados
--    si se re-ejecuta (busca por nombre).
--
-- Pre-requisito: tener las migraciones fase 1-12 aplicadas.
-- ============================================================
BEGIN;

-- Helpers de upsert por nombre (no UNIQUE en DB, usamos NOT EXISTS) -------

-- ENTIDADES (7) --------------------------------------------------------------
INSERT INTO entidades (nombre, nit, direccion)
SELECT * FROM (VALUES
  ('AGROATLANTIC S.A.',     '7507658',      '14 Ave 2-60 Apto A Zona 15 Col. Tecún Umán'),
  ('BANANERA IZABAL',       '1689663-7',    '14 Ave 2-60 Apto A Z.15 Colonia Tecún Umán'),
  ('TRANSPORTES LIS S.A.',  '3405432-4',    'Avenida Hincapié 10-19 Zona 13'),
  ('SUREÑA S.A.',           '22931406',     '12 calle 01-25 Zona 10, Edificio Géminis, Torre Norte, Oficina 1303 y 1304, Ciudad de Guatemala, Guatemala.'),
  ('VIDA CON CALIDAD',      '82135819',     NULL),
  ('MARLEY S.A.',           '8328911-9',    NULL),
  ('FEFAM S.A.',            '110796969',    NULL)
) AS v(nombre, nit, direccion)
WHERE NOT EXISTS (SELECT 1 FROM entidades e WHERE e.nombre = v.nombre);

-- AUTORIZADORES (7) ----------------------------------------------------------
INSERT INTO autorizadores (nombre, nit, dir)
SELECT * FROM (VALUES
  ('Miguel Angel Arriaza', NULL,        NULL),
  ('Javier Arriaza',       '24774510',  NULL),
  ('Alejandro Arriaza',    '79101526',  NULL),
  ('Lissa Arriaza',        '7858186-9', NULL),
  ('Jose Miguel Arriaza',  NULL,        NULL),   -- doble espacio quitado
  ('Patricia Esquivel',    NULL,        NULL),
  ('Rodrigo Santos',       '1824658-3', NULL)
) AS v(nombre, nit, dir)
WHERE NOT EXISTS (SELECT 1 FROM autorizadores a WHERE a.nombre = v.nombre);

-- EMPLEADOS (33) -------------------------------------------------------------
INSERT INTO empleados (nombre, puesto, depto)
SELECT * FROM (VALUES
  ('Erick González',          'Gerente General',              'Gerencias'),
  ('Estuardo Mateu',          'Financiero',                   'Finanzas'),
  ('Guillermo Gómez',         'Gerente Financiero',           'Contabilidad'),
  ('Victor Murillo',          'Tesorero General',             'Tesorería'),
  ('Verónica Pérez',          'Compras',                      'Compras'),
  ('Miltón Pérez',            'Gerente IT Infraestructura',   'IT'),
  ('Mayra Hernández',         'Recepcionista',                'Contabilidad'),
  ('Jenny Leiva',             'Legal',                        'Legal'),
  ('Jaime Chipel',            'Auditor',                      'Auditoría'),
  ('Vilma Aracely Maxia',     'Auditor',                      'Auditoría'),
  ('Cesar Vasquez',           'Auditor',                      'Auditoría'),
  ('Edgar Ventura',           'Coordinador de Compras',       'Compras'),
  ('William Vásquez',         'Coordinador de Compras',       'Compras'),  -- typo Vasques→Vásquez
  ('Carlos Chew',             'Coordinador de Compras',       'Compras'),
  ('Angélica Rodríguez',      'Planillas',                    'RRHH'),
  ('Maria Jose Soyos',        'Planillas',                    'RRHH'),
  ('Lucía Monrroy',           'RRHH',                         'RRHH'),
  ('Erick Gudiel',            'Coordinador Contable',         'Contabilidad'),
  ('Baldwin Mellado',         'Coordinador Contable',         'Contabilidad'),
  ('Maria Isabel Aguirre',    'Coordinador de Impuestos',     'Impuestos'),
  ('Merlin Morales',          'Tesorería',                    'Tesorería'),
  ('David García',            'Tesorería',                    'Tesorería'),
  ('Fátima Alonso',           'Tesorería',                    'Tesorería'),  -- typo "Tesosería"
  ('Herby Ramos',             'IT Infraestructura',           'IT'),
  ('Jose Juan Aldana',        'Jefe de Software',             'IT'),
  ('Jorge Hernandez',         'Jefe de Seguridad',            'Seguridad'),
  ('Miguel Angel Chavez',     'Seguridad Gerencia Agrícola',  'Seguridad'),
  ('Pedro Mejía',             'Piloto Gerencia',              'Seguridad'),
  ('Luis Alegría',            'Piloto Lancha',                'RD'),
  ('Gladis Suchite',          'Limpieza',                     'RD'),
  ('Sofia Pérez',             'Limpieza',                     'Mantenimiento'),
  ('Carolina Las Nubes',      'Coordinadora Hogar',           'Las Nubes'),
  ('Isabel Alfaron',          'Limpieza',                     'Oficinas Centrales')  -- doble espacio + typo Centrals
) AS v(nombre, puesto, depto)
WHERE NOT EXISTS (SELECT 1 FROM empleados e WHERE e.nombre = v.nombre);

-- TIPOS DE PAGO (13) ---------------------------------------------------------
INSERT INTO tipos_pago (tipo)
SELECT * FROM (VALUES
  ('Anticipo con factura'),
  ('Anticipo sin factura'),
  ('Pago de Contado'),
  ('TC-Reintegro'),                    -- sin espacio para coincidir con PAGO_TIPO_LABELS del front
  ('Transferencia Internacional'),
  ('Impuestos'),
  ('Crédito 8 días'),                  -- typo "8 día" → "8 días"
  ('Crédito 15 días'),
  ('Crédito 30 días'),
  ('Otros'),
  ('Caja Chica'),
  ('Recibo simple'),
  ('Gastos Personales')
) AS v(tipo)
WHERE NOT EXISTS (SELECT 1 FROM tipos_pago t WHERE t.tipo = v.tipo);

-- TARJETAS DE CRÉDITO · CORPORATIVAS (4) ------------------------------------
INSERT INTO tarjetas_credito (tipo, tc_id, empresa, nit, direccion)
SELECT * FROM (VALUES
  ('corporativa'::tc_tipo, 'TC Corp Agro Term. 7274',     'AGROATLANTIC S.A.', '7507658',   '14 Ave 2-60 Apto A Zona 15 Col. Tecún Umán'),
  ('corporativa'::tc_tipo, 'TC Corp Bananera Term. 5523', 'BANANERA IZABAL',   '1689663-7', '14 Ave 2-60 Apto A Z.15 Colonia Tecún Umán'),
  ('corporativa'::tc_tipo, 'TC Corp VCC',                 'VIDA CON CALIDAD',  '82135819',  NULL),
  ('corporativa'::tc_tipo, 'TC Corp Sureña Term. 2297',   'SUREÑA S.A.',       '22931406',  '12 calle 01-25 Zona 10, Edificio Géminis, Torre Norte, Oficina 1303 y 1304, Ciudad de Guatemala, Guatemala.')
) AS v(tipo, tc_id, empresa, nit, direccion)
WHERE NOT EXISTS (SELECT 1 FROM tarjetas_credito tc WHERE tc.tc_id = v.tc_id);

-- TARJETAS DE CRÉDITO · PRESIDENCIA (4) -------------------------------------
INSERT INTO tarjetas_credito (tipo, tc_id)
SELECT * FROM (VALUES
  ('presidencia'::tc_tipo, 'Mastercard BAC Term. 0908'),
  ('presidencia'::tc_tipo, 'Visa BAC Term. 6171'),
  ('presidencia'::tc_tipo, 'Amex GT Term. 2345'),       -- doble espacio quitado
  ('presidencia'::tc_tipo, 'Amex EEUU Term. 7002')
) AS v(tipo, tc_id)
WHERE NOT EXISTS (SELECT 1 FROM tarjetas_credito tc WHERE tc.tc_id = v.tc_id);

COMMIT;

-- Verificación rápida ------------------------------------------------------
-- SELECT 'entidades' AS t, count(*) FROM entidades
-- UNION ALL SELECT 'autorizadores', count(*) FROM autorizadores
-- UNION ALL SELECT 'empleados',     count(*) FROM empleados
-- UNION ALL SELECT 'tipos_pago',    count(*) FROM tipos_pago
-- UNION ALL SELECT 'tarjetas_credito', count(*) FROM tarjetas_credito;
-- Esperado: 7, 7, 33, 13, 8.

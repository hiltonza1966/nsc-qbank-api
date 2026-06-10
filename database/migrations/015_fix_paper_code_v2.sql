-- Migration: Fix missing paper_code columns in parser tables
-- Date: 2026-06-10
-- MySQL 8.0.45 compatible
-- Verified: ADD COLUMN IF NOT EXISTS is NOT supported in MySQL 8.0 (only MariaDB)
-- Using PREPARE/EXECUTE with information_schema check instead

-- 1. Add paper_code to parse_expected_structure if missing
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'parse_expected_structure'
     AND table_schema = DATABASE()
     AND column_name = 'paper_code') > 0,
    'SELECT 1',
    'ALTER TABLE parse_expected_structure ADD COLUMN paper_code VARCHAR(50) NULL AFTER assessment_body_id'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add index (drop first if exists, then create)
SET @idx = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE table_name = 'parse_expected_structure'
     AND table_schema = DATABASE()
     AND index_name = 'idx_paper_code') > 0,
    'SELECT 1',
    'CREATE INDEX idx_paper_code ON parse_expected_structure(paper_code)'
));
PREPARE stmt2 FROM @idx;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. Update existing seeded data
UPDATE parse_expected_structure 
SET paper_code = 'LIFE_SC_P1_NOV_2025'
WHERE year_id = 6 AND grade_id = 3 AND subject_id = 1 AND paper_id = 1 
  AND assessment_type_id = 1 AND assessment_body_id = 1
  AND (paper_code IS NULL OR paper_code = '');

-- 4. Add paper_code to parse_results if missing
SET @s2 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'parse_results'
     AND table_schema = DATABASE()
     AND column_name = 'paper_code') > 0,
    'SELECT 1',
    'ALTER TABLE parse_results ADD COLUMN paper_code VARCHAR(50) NULL AFTER session_id'
));
PREPARE stmt3 FROM @s2;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 5. Add index to parse_results
SET @idx2 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE table_name = 'parse_results'
     AND table_schema = DATABASE()
     AND index_name = 'idx_paper_code') > 0,
    'SELECT 1',
    'CREATE INDEX idx_paper_code ON parse_results(paper_code)'
));
PREPARE stmt4 FROM @idx2;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

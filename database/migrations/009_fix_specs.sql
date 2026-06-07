-- ============================================
-- Fix: Clean up duplicate specs and fix empty sections_config
-- Date: 2026-06-07
-- MySQL 8.0.45 compatible
-- ============================================

USE nsc_qbank;
SET @db_name = DATABASE();

-- 1. Delete specs with empty sections_config (they are invalid)
DELETE FROM qbank_paper_specs 
WHERE sections_config = '[]' OR sections_config IS NULL OR JSON_LENGTH(sections_config) = 0;

-- 2. Delete duplicate specs - keep only the most recent for each subject/paper
DELETE t1 FROM qbank_paper_specs t1
INNER JOIN qbank_paper_specs t2
WHERE t1.spec_id < t2.spec_id
  AND t1.subject_official_code = t2.subject_official_code
  AND t1.paper_no = t2.paper_no;

-- 3. Add unique key to prevent future duplicates (check if exists first)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db_name AND table_name = 'qbank_paper_specs' AND index_name = 'uq_spec');

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE qbank_paper_specs ADD UNIQUE KEY uq_spec (subject_official_code, paper_no)',
  'SELECT "Unique key uq_spec already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Insert MATH P1 with proper sections (will update if exists due to unique key)
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'MATH', 1, 150, 180, '[{"name":"Algebra","marks":50},{"name":"Calculus","marks":50},{"name":"Geometry","marks":50}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

-- 5. Verify all specs are valid
SELECT subject_official_code, paper_no, total_marks, sections_config 
FROM qbank_paper_specs 
ORDER BY subject_official_code, paper_no;

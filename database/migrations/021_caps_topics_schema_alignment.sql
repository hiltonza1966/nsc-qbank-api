-- ============================================================
-- MIGRATION 021: CAPS Topics Schema Alignment & Constraints
-- Date: 2026-06-18
-- Purpose: 
--   1. Add grade_number to lookup_caps_topics for alignment with caps_atp_content
--   2. Add FK constraint on caps_atp_content.caps_topic_id
--   3. Add unique index on topic_code to prevent duplicates
--   4. Add composite index for fast lookups
-- ============================================================

USE nsc_qbank;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------
-- STEP 1: Add grade_number to lookup_caps_topics
-- --------------------------------------------------
ALTER TABLE lookup_caps_topics 
ADD COLUMN grade_number INT NULL AFTER grade_id;

-- Backfill grade_number from grade_id mapping
UPDATE lookup_caps_topics t
JOIN lookup_grades g ON t.grade_id = g.grade_id
SET t.grade_number = g.grade_number;

-- --------------------------------------------------
-- STEP 2: Add FK constraint on caps_atp_content.caps_topic_id
-- --------------------------------------------------
ALTER TABLE caps_atp_content 
ADD CONSTRAINT fk_atp_caps_topic 
FOREIGN KEY (caps_topic_id) REFERENCES lookup_caps_topics(topic_id)
ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------
-- STEP 3: Add unique constraint on topic_code
-- --------------------------------------------------
ALTER TABLE lookup_caps_topics 
ADD UNIQUE INDEX uk_topic_code (topic_code);

-- --------------------------------------------------
-- STEP 4: Add composite index for lookups
-- --------------------------------------------------
ALTER TABLE lookup_caps_topics 
ADD INDEX idx_subject_grade (subject_official_code, grade_number);

-- --------------------------------------------------
-- STEP 5: Add index on caps_atp_content.caps_topic_id
-- --------------------------------------------------
ALTER TABLE caps_atp_content 
ADD INDEX idx_caps_topic_id (caps_topic_id);

SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------
-- VERIFICATION
-- --------------------------------------------------
SELECT 'lookup_caps_topics columns' as check_item;
DESCRIBE lookup_caps_topics;

SELECT 'caps_atp_content FKs' as check_item;
SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'nsc_qbank' 
AND TABLE_NAME = 'caps_atp_content' 
AND REFERENCED_TABLE_NAME IS NOT NULL;

SELECT 'topic_code uniqueness' as check_item;
SELECT COUNT(*) as total_topics, COUNT(DISTINCT topic_code) as unique_codes FROM lookup_caps_topics;

-- ============================================================
-- MIGRATION 022: Clear CAPS Topics/Subtopics & Reset Consumer Tables
-- Date: 2026-06-18
-- Purpose: 
--   1. Clear item_caps_mapping (references lookup_caps_topics/subtopics)
--   2. Reset parse_expected_structure caps references
--   3. Reset item_master caps references
--   4. Truncate paper_caps_constraints
--   5. Truncate lookup_caps_subtopics
--   6. Truncate lookup_caps_topics
-- ============================================================

USE nsc_qbank;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------
-- STEP 1: Clear item_caps_mapping (consumer of topics/subtopics)
-- --------------------------------------------------
TRUNCATE TABLE item_caps_mapping;

-- --------------------------------------------------
-- STEP 2: Reset parse_expected_structure caps references
-- --------------------------------------------------
UPDATE parse_expected_structure 
SET caps_topic_id = NULL, 
    caps_subtopic_id = NULL, 
    caps_reference = NULL;

-- --------------------------------------------------
-- STEP 3: Reset item_master caps references
-- --------------------------------------------------
UPDATE item_master 
SET caps_topic_id = NULL, 
    caps_subtopic_id = NULL, 
    caps_reference = NULL;

-- --------------------------------------------------
-- STEP 4: Clear paper_caps_constraints
-- --------------------------------------------------
TRUNCATE TABLE paper_caps_constraints;

-- --------------------------------------------------
-- STEP 5: Clear subtopics (child table first)
-- --------------------------------------------------
TRUNCATE TABLE lookup_caps_subtopics;

-- --------------------------------------------------
-- STEP 6: Clear topics (parent table last)
-- --------------------------------------------------
TRUNCATE TABLE lookup_caps_topics;

SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------
-- VERIFICATION
-- --------------------------------------------------
SELECT 'item_caps_mapping' as table_name, COUNT(*) as row_count FROM item_caps_mapping
UNION ALL SELECT 'lookup_caps_subtopics', COUNT(*) FROM lookup_caps_subtopics
UNION ALL SELECT 'lookup_caps_topics', COUNT(*) FROM lookup_caps_topics
UNION ALL SELECT 'paper_caps_constraints', COUNT(*) FROM paper_caps_constraints;

SELECT 'parse_expected_structure NULL caps_topic_id' as check_item, 
       COUNT(*) as null_count 
FROM parse_expected_structure 
WHERE caps_topic_id IS NULL;

SELECT 'item_master NULL caps_topic_id' as check_item, 
       COUNT(*) as null_count 
FROM item_master 
WHERE caps_topic_id IS NULL;

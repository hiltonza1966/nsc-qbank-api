-- Fix remaining 6 unlinked Life Sciences Paper 1 items
-- These are extra items (1.2.9, 1.3.4, 1.3.5) beyond the 38 from Nov 2025 paper

-- 1.2.9 (2 rows) - Short Answer section, link to DNA topic (same as 1.2.1-1.2.2)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_1_B'),
    caps_reference = 'LIFE 2.1.2',
    cognitive_level_weighting = 'remember',
    assessment_verb = 'describe',
    source_topic = 'DNA: Code of Life',
    source_subtopic = 'DNA Replication',
    topic_coverage_required = 1
WHERE question_number = '1.2.9';

-- 1.3.4 (3 rows) - Matching section, link to Homeostasis topic (same as 1.3.3)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_4_A'),
    caps_reference = 'LIFE 2.7.1',
    cognitive_level_weighting = 'understand',
    assessment_verb = 'match',
    source_topic = 'Homeostasis in Humans',
    source_subtopic = 'Homeostasis Concepts',
    topic_coverage_required = 1
WHERE question_number = '1.3.4';

-- 1.3.5 (1 row) - Matching section, link to Plant Hormones topic (same as 2.5)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_5_A'),
    caps_reference = 'LIFE 2.8.1',
    cognitive_level_weighting = 'apply',
    assessment_verb = 'classify',
    source_topic = 'Responding to the Environment: Plants',
    source_subtopic = 'Plant Hormones',
    topic_coverage_required = 1
WHERE question_number = '1.3.5';

-- Verify all are now linked
SELECT '=== FINAL COUNT ===' as status;
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN caps_topic_id IS NOT NULL THEN 1 END) as linked,
  COUNT(CASE WHEN caps_topic_id IS NULL THEN 1 END) as unlinked
FROM parse_expected_structure
WHERE question_number LIKE '1.1._' 
   OR question_number LIKE '1.2._'
   OR question_number LIKE '1.3._'
   OR question_number LIKE '1.4._'
   OR question_number LIKE '1.5._'
   OR question_number IN ('2.1','2.2','2.3','2.4','2.5')
   OR question_number IN ('3.1','3.2','3.3','3.4','3.5');

-- Show any remaining unlinked
SELECT question_number, expected_marks 
FROM parse_expected_structure 
WHERE (question_number LIKE '1.1._' OR question_number LIKE '1.2._' OR question_number LIKE '1.3._'
   OR question_number LIKE '1.4._' OR question_number LIKE '1.5._'
   OR question_number IN ('2.1','2.2','2.3','2.4','2.5')
   OR question_number IN ('3.1','3.2','3.3','3.4','3.5'))
AND caps_topic_id IS NULL;

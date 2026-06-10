-- ============================================================
-- MIGRATION: 022_link_caps_items_FIXED.sql
-- Date: 2026-06-10
-- Purpose: Link ALL items in parse_expected_structure to CAPS
-- FIX: Removes paper_code filter, uses question_number only
-- ============================================================

-- ============================================================
-- PART 1: CREATE TABLES AND VIEWS (IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS item_caps_mapping (
  mapping_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  topic_id INT NOT NULL,
  subtopic_id INT DEFAULT NULL,
  strand_id INT DEFAULT NULL,
  grade_id INT NOT NULL,
  term_id VARCHAR(10) DEFAULT NULL,
  paper_id INT DEFAULT NULL,
  cognitive_level VARCHAR(20) DEFAULT NULL,
  assessment_verb VARCHAR(50) DEFAULT NULL,
  curriculum_weight DECIMAL(5,2) DEFAULT NULL,
  is_primary_mapping TINYINT(1) DEFAULT 1,
  mapping_confidence DECIMAL(3,2) DEFAULT 1.00,
  mapped_by INT DEFAULT NULL,
  mapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_by INT DEFAULT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  UNIQUE KEY uk_item_topic (item_id, topic_id, subtopic_id),
  KEY idx_item_id (item_id),
  KEY idx_topic_id (topic_id),
  KEY idx_subtopic_id (subtopic_id),
  KEY idx_strand_id (strand_id),
  KEY idx_grade_id (grade_id),
  KEY idx_cognitive_level (cognitive_level),
  KEY idx_is_primary (is_primary_mapping),
  KEY idx_mapped_at (mapped_at),
  CONSTRAINT fk_mapping_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_mapping_topic FOREIGN KEY (topic_id) REFERENCES lookup_caps_topics(topic_id),
  CONSTRAINT fk_mapping_subtopic FOREIGN KEY (subtopic_id) REFERENCES lookup_caps_subtopics(subtopic_id),
  CONSTRAINT fk_mapping_strand FOREIGN KEY (strand_id) REFERENCES lookup_caps_topics(topic_id),
  CONSTRAINT fk_mapping_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paper_caps_constraints (
  constraint_id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  section_id INT NOT NULL,
  caps_topic_id INT NOT NULL,
  min_items INT DEFAULT 1,
  max_items INT DEFAULT 10,
  min_marks INT DEFAULT 0,
  max_marks INT DEFAULT 50,
  required_cognitive_level VARCHAR(20) DEFAULT NULL,
  required_difficulty VARCHAR(20) DEFAULT NULL,
  required_item_type VARCHAR(20) DEFAULT NULL,
  is_mandatory TINYINT(1) DEFAULT 0,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_template_section_topic (template_id, section_id, caps_topic_id),
  KEY idx_template_id (template_id),
  KEY idx_section_id (section_id),
  KEY idx_caps_topic_id (caps_topic_id),
  CONSTRAINT fk_constraint_template FOREIGN KEY (template_id) REFERENCES paper_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT fk_constraint_section FOREIGN KEY (section_id) REFERENCES paper_template_sections(section_id) ON DELETE CASCADE,
  CONSTRAINT fk_constraint_caps_topic FOREIGN KEY (caps_topic_id) REFERENCES lookup_caps_topics(topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW vw_curriculum_coverage AS
SELECT 
  t.subject_official_code,
  t.grade_id,
  t.strand,
  t.term,
  t.topic_code,
  t.topic_name,
  t.topic_weighting,
  t.paper_no,
  t.time_weeks,
  COUNT(DISTINCT s.subtopic_id) AS subtopic_count,
  COUNT(DISTINCT m.item_id) AS item_count,
  COUNT(DISTINCT CASE WHEN im.status = 'published' THEN m.item_id END) AS published_item_count,
  COUNT(DISTINCT CASE WHEN im.status = 'draft' THEN m.item_id END) AS draft_item_count,
  COALESCE(SUM(im.marks), 0) AS total_marks_available,
  COALESCE(AVG(im.facility_value), 0) AS avg_facility_value,
  COALESCE(AVG(im.discrimination_index), 0) AS avg_discrimination,
  CASE 
    WHEN COUNT(DISTINCT m.item_id) = 0 THEN 'NO_ITEMS'
    WHEN COUNT(DISTINCT m.item_id) < 3 THEN 'INSUFFICIENT'
    WHEN COUNT(DISTINCT m.item_id) < 5 THEN 'ADEQUATE'
    ELSE 'WELL_COVERED'
  END AS coverage_status,
  ROUND(COUNT(DISTINCT m.item_id) * 100.0 / 
    (SELECT MAX(item_count) FROM (
      SELECT COUNT(DISTINCT m2.item_id) AS item_count
      FROM lookup_caps_topics t2
      LEFT JOIN item_caps_mapping m2 ON t2.topic_id = m2.topic_id
      WHERE t2.subject_official_code = t.subject_official_code AND t2.grade_id = t.grade_id
      GROUP BY t2.topic_id
    ) AS coverage_counts), 2) AS relative_coverage_percent
FROM lookup_caps_topics t
LEFT JOIN lookup_caps_subtopics s ON t.topic_id = s.topic_id
LEFT JOIN item_caps_mapping m ON t.topic_id = m.topic_id AND m.is_primary_mapping = 1
LEFT JOIN item_master im ON m.item_id = im.item_id AND im.is_retired = 0
GROUP BY t.topic_id
ORDER BY t.grade_id, t.display_order;

CREATE OR REPLACE VIEW vw_paper_structure_curriculum AS
SELECT 
  pes.year_id,
  pes.grade_id,
  pes.subject_id,
  pes.paper_id,
  pes.question_number,
  pes.section,
  pes.expected_marks,
  pes.sequence,
  pes.cognitive_level_id,
  ct.topic_code,
  ct.topic_name,
  ct.strand,
  ct.term,
  ct.paper_no AS caps_paper_no,
  ct.topic_weighting,
  cs.subtopic_code,
  cs.subtopic_name,
  cs.caps_reference,
  pes.caps_reference AS item_caps_reference,
  pes.assessment_verb,
  pes.cognitive_level_weighting,
  pes.is_anchor_item,
  pes.exposure_limit,
  pes.last_used_year,
  pes.topic_coverage_required
FROM parse_expected_structure pes
LEFT JOIN lookup_caps_topics ct ON pes.caps_topic_id = ct.topic_id
LEFT JOIN lookup_caps_subtopics cs ON pes.caps_subtopic_id = cs.subtopic_id
ORDER BY pes.year_id, pes.grade_id, pes.paper_id, pes.sequence;

CREATE OR REPLACE VIEW vw_item_bank_caps_analysis AS
SELECT 
  im.item_id,
  im.item_code,
  im.question_number,
  im.question_text,
  im.marks,
  im.status,
  im.cognitive_level_id,
  im.difficulty_id,
  im.item_type_id,
  im.exposure_count,
  im.last_used_date,
  im.facility_value,
  im.discrimination_index,
  ct.topic_code AS caps_topic_code,
  ct.topic_name AS caps_topic_name,
  ct.grade_id AS caps_grade,
  ct.strand AS caps_strand,
  ct.term AS caps_term,
  ct.paper_no AS caps_paper,
  ct.topic_weighting AS caps_weighting,
  cs.subtopic_code AS caps_subtopic_code,
  cs.subtopic_name AS caps_subtopic_name,
  cs.caps_reference,
  m.mapping_confidence,
  m.mapped_at,
  m.notes AS mapping_notes
FROM item_master im
LEFT JOIN item_caps_mapping m ON im.item_id = m.item_id AND m.is_primary_mapping = 1
LEFT JOIN lookup_caps_topics ct ON m.topic_id = ct.topic_id
LEFT JOIN lookup_caps_subtopics cs ON m.subtopic_id = cs.subtopic_id
WHERE im.is_retired = 0
ORDER BY ct.grade_id, ct.display_order, im.question_number;

CREATE OR REPLACE VIEW vw_curriculum_gaps AS
SELECT 
  t.subject_official_code,
  t.grade_id,
  t.strand,
  t.term,
  t.topic_code,
  t.topic_name,
  t.topic_weighting,
  t.paper_no,
  COUNT(DISTINCT s.subtopic_id) AS expected_subtopics,
  COUNT(DISTINCT m.subtopic_id) AS covered_subtopics,
  COUNT(DISTINCT m.item_id) AS total_items,
  COALESCE(SUM(CASE WHEN im.status = 'published' THEN im.marks ELSE 0 END), 0) AS published_marks,
  COALESCE(SUM(CASE WHEN im.status = 'draft' THEN im.marks ELSE 0 END), 0) AS draft_marks,
  CASE 
    WHEN COUNT(DISTINCT m.item_id) = 0 THEN 'CRITICAL_GAP'
    WHEN COUNT(DISTINCT m.subtopic_id) < COUNT(DISTINCT s.subtopic_id) * 0.5 THEN 'PARTIAL_GAP'
    WHEN COUNT(DISTINCT m.item_id) < 5 THEN 'NEEDS_ITEMS'
    ELSE 'ADEQUATE'
  END AS gap_status,
  ROUND((COUNT(DISTINCT s.subtopic_id) - COUNT(DISTINCT m.subtopic_id)) * 100.0 / COUNT(DISTINCT s.subtopic_id), 2) AS subtopic_gap_percent
FROM lookup_caps_topics t
LEFT JOIN lookup_caps_subtopics s ON t.topic_id = s.topic_id
LEFT JOIN item_caps_mapping m ON t.topic_id = m.topic_id
LEFT JOIN item_master im ON m.item_id = im.item_id AND im.is_retired = 0
GROUP BY t.topic_id
HAVING gap_status != 'ADEQUATE' OR subtopic_gap_percent > 25
ORDER BY 
  CASE gap_status 
    WHEN 'CRITICAL_GAP' THEN 1 
    WHEN 'PARTIAL_GAP' THEN 2 
    WHEN 'NEEDS_ITEMS' THEN 3 
    ELSE 4 
  END,
  t.grade_id, 
  t.display_order;

-- ============================================================
-- PART 2: LINK ALL ITEMS BY QUESTION NUMBER (NO paper_code FILTER)
-- ============================================================

-- Section A: MCQ (1.1.1 - 1.1.10)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_3_A'),
    caps_reference = 'LIFE 2.5.1',
    cognitive_level_weighting = 'remember',
    assessment_verb = 'state',
    source_topic = 'Responding to the Environment: Humans',
    source_subtopic = 'Human Nervous System',
    topic_coverage_required = 1
WHERE question_number IN ('1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_3_A'),
    caps_reference = 'LIFE 2.6.1',
    cognitive_level_weighting = 'remember',
    assessment_verb = 'identify',
    source_topic = 'Human Endocrine System',
    source_subtopic = 'Endocrine Glands',
    topic_coverage_required = 1
WHERE question_number IN ('1.1.6', '1.1.7');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_2_D'),
    caps_reference = 'LIFE 2.4.4',
    cognitive_level_weighting = 'understand',
    assessment_verb = 'explain',
    source_topic = 'Human Reproduction',
    source_subtopic = 'Menstrual Cycle',
    topic_coverage_required = 1
WHERE question_number IN ('1.1.8', '1.1.9');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_4_B'),
    caps_reference = 'LIFE 2.7.2',
    cognitive_level_weighting = 'apply',
    assessment_verb = 'demonstrate',
    source_topic = 'Homeostasis in Humans',
    source_subtopic = 'Thermoregulation',
    topic_coverage_required = 1
WHERE question_number = '1.1.10';

-- Section A: Short Answer (1.2.1 - 1.2.8)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_1_A'),
    caps_reference = 'LIFE 2.1.1',
    cognitive_level_weighting = 'remember',
    assessment_verb = 'name',
    source_topic = 'DNA: Code of Life',
    source_subtopic = 'DNA Structure and Discovery',
    topic_coverage_required = 1
WHERE question_number IN ('1.2.1', '1.2.2');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_2'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_2_A'),
    caps_reference = 'LIFE 2.2.1',
    cognitive_level_weighting = 'understand',
    assessment_verb = 'describe',
    source_topic = 'Meiosis',
    source_subtopic = 'Process of Meiosis',
    topic_coverage_required = 1
WHERE question_number IN ('1.2.3', '1.2.4');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_1'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_1_A'),
    caps_reference = 'LIFE 2.3.1',
    cognitive_level_weighting = 'remember',
    assessment_verb = 'list',
    source_topic = 'Reproduction in Vertebrates',
    source_subtopic = 'Reproductive Strategies',
    topic_coverage_required = 1
WHERE question_number IN ('1.2.5', '1.2.6');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_5_B'),
    caps_reference = 'LIFE 2.8.2',
    cognitive_level_weighting = 'apply',
    assessment_verb = 'predict',
    source_topic = 'Responding to the Environment: Plants',
    source_subtopic = 'Tropisms',
    topic_coverage_required = 1
WHERE question_number IN ('1.2.7', '1.2.8');

-- Section A: Matching (1.3.1 - 1.3.3)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_3_B'),
    caps_reference = 'LIFE 2.5.2',
    cognitive_level_weighting = 'understand',
    assessment_verb = 'match',
    source_topic = 'Responding to the Environment: Humans',
    source_subtopic = 'The Eye',
    topic_coverage_required = 1
WHERE question_number = '1.3.1';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_3_B'),
    caps_reference = 'LIFE 2.6.2',
    cognitive_level_weighting = 'understand',
    assessment_verb = 'compare',
    source_topic = 'Human Endocrine System',
    source_subtopic = 'Negative Feedback',
    topic_coverage_required = 1
WHERE question_number = '1.3.2';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_4_C'),
    caps_reference = 'LIFE 2.7.3',
    cognitive_level_weighting = 'apply',
    assessment_verb = 'classify',
    source_topic = 'Homeostasis in Humans',
    source_subtopic = 'Water and Salt Balance',
    topic_coverage_required = 1
WHERE question_number = '1.3.3';

-- Section A: Diagrams (1.4.1 - 1.4.3, 1.5.1 - 1.5.4)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_3_A'),
    caps_reference = 'LIFE 2.5.1',
    cognitive_level_weighting = 'analyse',
    assessment_verb = 'label',
    source_topic = 'Responding to the Environment: Humans',
    source_subtopic = 'Human Nervous System',
    topic_coverage_required = 1
WHERE question_number IN ('1.4.1', '1.4.2', '1.4.3');

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_2_A'),
    caps_reference = 'LIFE 2.4.1',
    cognitive_level_weighting = 'analyse',
    assessment_verb = 'identify',
    source_topic = 'Human Reproduction',
    source_subtopic = 'Male Reproductive System',
    topic_coverage_required = 1
WHERE question_number IN ('1.5.1', '1.5.2', '1.5.3', '1.5.4');

-- Section B: Extended Questions (2.1 - 2.5)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_3_D'),
    caps_reference = 'LIFE 2.5.4',
    cognitive_level_weighting = 'analyse',
    assessment_verb = 'analyse',
    source_topic = 'Responding to the Environment: Humans',
    source_subtopic = 'Receptors',
    is_anchor_item = 1,
    exposure_limit = 3,
    topic_coverage_required = 1
WHERE question_number = '2.1';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_3_C'),
    caps_reference = 'LIFE 2.6.3',
    cognitive_level_weighting = 'evaluate',
    assessment_verb = 'evaluate',
    source_topic = 'Human Endocrine System',
    source_subtopic = 'Diabetes',
    is_anchor_item = 1,
    exposure_limit = 3,
    topic_coverage_required = 1
WHERE question_number = '2.2';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_2_E'),
    caps_reference = 'LIFE 2.4.5',
    cognitive_level_weighting = 'analyse',
    assessment_verb = 'discuss',
    source_topic = 'Human Reproduction',
    source_subtopic = 'Fertilisation and Development',
    is_anchor_item = 1,
    exposure_limit = 3,
    topic_coverage_required = 1
WHERE question_number = '2.3';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_4'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_4_A'),
    caps_reference = 'LIFE 2.7.1',
    cognitive_level_weighting = 'apply',
    assessment_verb = 'explain',
    source_topic = 'Homeostasis in Humans',
    source_subtopic = 'Homeostasis Concepts',
    topic_coverage_required = 1
WHERE question_number = '2.4';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_5'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_5_A'),
    caps_reference = 'LIFE 2.8.1',
    cognitive_level_weighting = 'evaluate',
    assessment_verb = 'compare',
    source_topic = 'Responding to the Environment: Plants',
    source_subtopic = 'Plant Hormones',
    is_anchor_item = 1,
    exposure_limit = 3,
    topic_coverage_required = 1
WHERE question_number = '2.5';

-- Section C: Extended Questions (3.1 - 3.5)
UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_3_E'),
    caps_reference = 'LIFE 2.5.5',
    cognitive_level_weighting = 'evaluate',
    assessment_verb = 'evaluate',
    source_topic = 'Responding to the Environment: Humans',
    source_subtopic = 'Drugs and Effects',
    is_anchor_item = 1,
    exposure_limit = 2,
    topic_coverage_required = 1
WHERE question_number = '3.1';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_1'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_1_D'),
    caps_reference = 'LIFE 2.1.4',
    cognitive_level_weighting = 'analyse',
    assessment_verb = 'analyse',
    source_topic = 'DNA: Code of Life',
    source_subtopic = 'Transcription and Translation',
    is_anchor_item = 1,
    exposure_limit = 2,
    topic_coverage_required = 1
WHERE question_number = '3.2';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_1_2'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_1_2_B'),
    caps_reference = 'LIFE 2.2.2',
    cognitive_level_weighting = 'apply',
    assessment_verb = 'predict',
    source_topic = 'Meiosis',
    source_subtopic = 'Genetic Variation',
    topic_coverage_required = 1
WHERE question_number = '3.3';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_2'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_2_F'),
    caps_reference = 'LIFE 2.4.6',
    cognitive_level_weighting = 'evaluate',
    assessment_verb = 'justify',
    source_topic = 'Human Reproduction',
    source_subtopic = 'Contraception',
    is_anchor_item = 1,
    exposure_limit = 2,
    topic_coverage_required = 1
WHERE question_number = '3.4';

UPDATE parse_expected_structure 
SET caps_topic_id = (SELECT topic_id FROM lookup_caps_topics WHERE topic_code = 'LIFE_12_2_3'),
    caps_subtopic_id = (SELECT subtopic_id FROM lookup_caps_subtopics WHERE subtopic_code = 'LIFE_12_2_3_F'),
    caps_reference = 'LIFE 2.5.6',
    cognitive_level_weighting = 'evaluate',
    assessment_verb = 'suggest',
    source_topic = 'Responding to the Environment: Humans',
    source_subtopic = 'Disorders and Injuries',
    is_anchor_item = 1,
    exposure_limit = 2,
    topic_coverage_required = 1
WHERE question_number = '3.5';

-- ============================================================
-- PART 3: VERIFY LINKING
-- ============================================================

SELECT '=== LINKED ITEMS ===' as status;
SELECT COUNT(*) as linked_items FROM parse_expected_structure WHERE caps_topic_id IS NOT NULL;
SELECT '=== TOPICS COVERED ===' as status;
SELECT COUNT(DISTINCT caps_topic_id) as topics_covered FROM parse_expected_structure WHERE caps_topic_id IS NOT NULL;
SELECT '=== SUBTOPICS COVERED ===' as status;
SELECT COUNT(DISTINCT caps_subtopic_id) as subtopics_covered FROM parse_expected_structure WHERE caps_subtopic_id IS NOT NULL;
SELECT '=== UNLINKED ITEMS ===' as status;
SELECT question_number, expected_marks FROM parse_expected_structure WHERE caps_topic_id IS NULL ORDER BY sequence;

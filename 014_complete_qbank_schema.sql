-- ============================================================
-- QBank Corporate System - Complete Schema Migration 014
-- Date: 2026-06-09
-- Status: Phase 2 Implementation
-- Approach: Create new 34 tables, keep old tables as legacy
-- ============================================================

-- ============================================================
-- 1. CORE DIMENSION LOOKUP TABLES (6 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS lookup_years (
  year_id INT AUTO_INCREMENT PRIMARY KEY,
  year_value INT NOT NULL,
  year_label VARCHAR(20) NOT NULL,
  is_current TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_year_value (year_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_years (year_value, year_label, is_current, is_active) VALUES
(2020, '2020', 0, 1),
(2021, '2021', 0, 1),
(2022, '2022', 0, 1),
(2023, '2023', 0, 1),
(2024, '2024', 0, 1),
(2025, '2025', 1, 1),
(2026, '2026', 0, 1),
(2027, '2027', 0, 1),
(2028, '2028', 0, 1),
(2029, '2029', 0, 1),
(2030, '2030', 0, 1);

CREATE TABLE IF NOT EXISTS lookup_grades (
  grade_id INT AUTO_INCREMENT PRIMARY KEY,
  grade_value INT NOT NULL,
  grade_label VARCHAR(20) NOT NULL,
  grade_code VARCHAR(10) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grade_value (grade_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_grades (grade_value, grade_label, grade_code, is_active) VALUES
(10, 'Grade 10', 'G10', 1),
(11, 'Grade 11', 'G11', 1),
(12, 'Grade 12', 'G12', 1);

CREATE TABLE IF NOT EXISTS lookup_subjects (
  subject_id INT AUTO_INCREMENT PRIMARY KEY,
  subject_official_code VARCHAR(20) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  subject_alpha_code VARCHAR(10) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_subject_official_code (subject_official_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOTE: lookup_subjects will be synced from nsc_registration_v3.lookup_subjects
-- Run this after migration:
-- INSERT INTO lookup_subjects (subject_official_code, subject_name, subject_alpha_code, is_active)
-- SELECT subject_alpha_code, subject_name, subject_alpha_code, 1 FROM nsc_registration_v3.lookup_subjects;

CREATE TABLE IF NOT EXISTS lookup_papers (
  paper_id INT AUTO_INCREMENT PRIMARY KEY,
  paper_code VARCHAR(10) NOT NULL,
  paper_name VARCHAR(50) NOT NULL,
  paper_type VARCHAR(20) NOT NULL,
  duration_minutes INT DEFAULT 180,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paper_code (paper_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_papers (paper_code, paper_name, paper_type, duration_minutes, is_active, display_order) VALUES
('P1', 'Paper 1', 'written', 180, 1, 1),
('P2', 'Paper 2', 'written', 180, 1, 2),
('P3', 'Paper 3', 'written', 180, 1, 3),
('PRAC', 'Practical', 'practical', 120, 1, 4),
('PAT', 'PAT', 'practical', 120, 1, 5),
('ORAL', 'Oral', 'oral', 60, 1, 6),
('SBA', 'SBA', 'assessment', 60, 1, 7);

CREATE TABLE IF NOT EXISTS lookup_assessment_types (
  assessment_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_code VARCHAR(20) NOT NULL,
  type_name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_assessment_types (type_code, type_name, description, is_active) VALUES
('EXAM', 'Examination', 'Final examination', 1),
('TEST', 'Test', 'Class test or controlled test', 1),
('SBA', 'School-Based Assessment', 'Internal school assessment', 1),
('PAT', 'Practical Assessment Task', 'Practical assessment', 1),
('TRIAL', 'Trial Exam', 'Preliminary examination', 1),
('DIAGNOSTIC', 'Diagnostic', 'Diagnostic assessment', 1),
('BASELINE', 'Baseline', 'Baseline assessment', 1);

CREATE TABLE IF NOT EXISTS lookup_assessment_bodies (
  assessment_body_id INT AUTO_INCREMENT PRIMARY KEY,
  body_code VARCHAR(20) NOT NULL,
  body_name VARCHAR(100) NOT NULL,
  body_full_name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_body_code (body_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_assessment_bodies (body_code, body_name, body_full_name, is_active) VALUES
('DBE', 'DBE', 'Department of Basic Education', 1),
('IEB', 'IEB', 'Independent Examinations Board', 1),
('SACAI', 'SACAI', 'SACAI', 1),
('NSC', 'NSC', 'National Senior Certificate', 1);

-- ============================================================
-- 2. SECONDARY DIMENSION LOOKUP TABLES (6 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS lookup_cognitive_levels (
  cognitive_level_id INT AUTO_INCREMENT PRIMARY KEY,
  level_code VARCHAR(20) NOT NULL,
  level_name VARCHAR(50) NOT NULL,
  bloom_level INT NOT NULL,
  caps_weighting DECIMAL(5,2) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_level_code (level_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_cognitive_levels (level_code, level_name, bloom_level, caps_weighting, description, is_active) VALUES
('REMEMBER', 'Remember', 1, 40.00, 'Retrieve relevant knowledge from long-term memory', 1),
('UNDERSTAND', 'Understand', 2, 25.00, 'Construct meaning from instructional messages', 1),
('APPLY', 'Apply', 3, 20.00, 'Carry out or use a procedure in a given situation', 1),
('ANALYSE', 'Analyse', 4, 15.00, 'Break material into constituent parts and determine how parts relate to one another', 1),
('EVALUATE', 'Evaluate', 5, 0.00, 'Make judgments based on criteria and standards', 1),
('CREATE', 'Create', 6, 0.00, 'Put elements together to form a coherent or functional whole', 1);

CREATE TABLE IF NOT EXISTS lookup_difficulty_levels (
  difficulty_id INT AUTO_INCREMENT PRIMARY KEY,
  difficulty_code VARCHAR(20) NOT NULL,
  difficulty_name VARCHAR(50) NOT NULL,
  p_value_min DECIMAL(5,2) DEFAULT NULL,
  p_value_max DECIMAL(5,2) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_difficulty_code (difficulty_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_difficulty_levels (difficulty_code, difficulty_name, p_value_min, p_value_max, description, is_active) VALUES
('EASY', 'Easy', 70.00, 100.00, '70-100% of learners answer correctly', 1),
('MEDIUM', 'Medium', 40.00, 69.99, '40-69% of learners answer correctly', 1),
('HARD', 'Hard', 0.00, 39.99, '0-39% of learners answer correctly', 1);

CREATE TABLE IF NOT EXISTS lookup_item_types (
  item_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_code VARCHAR(20) NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  type_category VARCHAR(50) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_item_types (type_code, type_name, type_category, description, is_active) VALUES
('MCQ', 'Multiple Choice', 'selected_response', 'Selected response item with options A-D', 1),
('SHORT', 'Short Answer', 'constructed_response', 'Brief constructed response (1-2 sentences)', 1),
('MEDIUM', 'Medium Response', 'constructed_response', 'Medium constructed response (3-5 sentences)', 1),
('EXTENDED', 'Extended Response', 'constructed_response', 'Long constructed response (paragraph+)', 1),
('ESSAY', 'Essay', 'constructed_response', 'Essay response', 1),
('DIAGRAM', 'Diagram', 'visual', 'Diagram-based item requiring labelling or drawing', 1),
('MATCHING', 'Matching', 'selected_response', 'Matching columns item', 1),
('PRACTICAL', 'Practical', 'practical', 'Practical or experimental task', 1),
('SOURCE', 'Source-Based', 'constructed_response', 'Source material based response', 1);

CREATE TABLE IF NOT EXISTS lookup_languages (
  language_id INT AUTO_INCREMENT PRIMARY KEY,
  language_code VARCHAR(10) NOT NULL,
  language_name VARCHAR(50) NOT NULL,
  is_official TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_language_code (language_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_languages (language_code, language_name, is_official, is_active) VALUES
('EN', 'English', 1, 1),
('AF', 'Afrikaans', 1, 1),
('ZU', 'isiZulu', 1, 1),
('XH', 'isiXhosa', 1, 1),
('ST', 'Sesotho', 1, 1),
('TN', 'Setswana', 1, 1),
('NS', 'siSwati', 1, 1),
('ND', 'isiNdebele', 1, 1),
('TS', 'Xitsonga', 1, 1),
('VE', 'Tshivenda', 1, 1);

CREATE TABLE IF NOT EXISTS lookup_exam_sessions (
  exam_session_id INT AUTO_INCREMENT PRIMARY KEY,
  session_code VARCHAR(20) NOT NULL,
  session_name VARCHAR(50) NOT NULL,
  session_month INT DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_session_code (session_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_exam_sessions (session_code, session_name, session_month, description, is_active) VALUES
('JUNE', 'June', 6, 'June examination session', 1),
('NOV', 'November', 11, 'November examination session', 1),
('TRIAL', 'Trial', 8, 'Trial examination', 1),
('BASELINE', 'Baseline', 2, 'Baseline assessment', 1),
('MIDYEAR', 'Mid-Year', 5, 'Mid-year examination', 1);

CREATE TABLE IF NOT EXISTS lookup_marking_schemes (
  marking_scheme_id INT AUTO_INCREMENT PRIMARY KEY,
  scheme_code VARCHAR(20) NOT NULL,
  scheme_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_scheme_code (scheme_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_marking_schemes (scheme_code, scheme_name, description, is_active) VALUES
('HOLISTIC', 'Holistic', 'Overall impression marking', 1),
('ANALYTIC', 'Analytic', 'Marking by individual criteria', 1),
('RUBRIC', 'Rubric', 'Rubric-based marking', 1),
('KEYWORD', 'Keyword', 'Marking by key words or phrases', 1),
('METHOD', 'Method', 'Marking by method or procedure', 1);


-- ============================================================
-- 3. CURRICULUM LOOKUP TABLES - CAPS (2 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS lookup_caps_topics (
  topic_id INT AUTO_INCREMENT PRIMARY KEY,
  subject_official_code VARCHAR(20) NOT NULL,
  grade_id INT NOT NULL,
  strand VARCHAR(50) NOT NULL,
  term VARCHAR(10) NOT NULL,
  topic_code VARCHAR(20) NOT NULL,
  topic_name VARCHAR(255) NOT NULL,
  topic_weighting DECIMAL(5,2) DEFAULT NULL,
  time_weeks DECIMAL(4,1) DEFAULT NULL,
  paper_no INT DEFAULT 1,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_subject_grade_topic (subject_official_code, grade_id, topic_code),
  KEY idx_subject_grade (subject_official_code, grade_id),
  KEY idx_strand (strand),
  KEY idx_term (term)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grade 12 Life Sciences Topics (from CAPS document)
INSERT INTO lookup_caps_topics (subject_official_code, grade_id, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, display_order) VALUES
('LIFE_SC', 12, 'Strand 1: Life at Molecular, Cellular and Tissue Level', 'T1', 'LIFE_12_1_1', 'DNA: Code of Life', 19.0, 2.5, 2, 'DNA structure, RNA, protein synthesis, genetic code', 1),
('LIFE_SC', 12, 'Strand 1: Life at Molecular, Cellular and Tissue Level', 'T1', 'LIFE_12_1_2', 'Meiosis', 7.0, 1.0, 1, 'Process of reduction division, genetic variation', 2),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T1', 'LIFE_12_2_1', 'Reproduction in Vertebrates', 4.0, 0.5, 1, 'Diversity of reproductive strategies', 3),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T1', 'LIFE_12_2_2', 'Human Reproduction', 21.0, 3.0, 1, 'Male/female systems, hormonal control, pregnancy', 4),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_3', 'Responding to the Environment: Humans', 30.0, 4.0, 1, 'Nervous system, senses, endocrine system, homeostasis', 5),
('LIFE_SC', 12, 'Strand 1: Life at Molecular, Cellular and Tissue Level', 'T2', 'LIFE_12_1_3', 'Human Endocrine System', 15.0, 1.5, 1, 'Hormones, feedback mechanisms, diabetes', 6),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_4', 'Homeostasis in Humans', 7.0, 1.0, 1, 'Temperature regulation, water balance', 7),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_5', 'Responding to the Environment: Plants', 7.0, 1.0, 1, 'Plant hormones, tropisms, defence mechanisms', 8),
('LIFE_SC', 12, 'Strand 4: Diversity, Change and Continuity', 'T3', 'LIFE_12_4_1', 'Evolution by Natural Selection', 15.0, 2.0, 2, 'Darwinism, speciation, evidence for evolution', 9),
('LIFE_SC', 12, 'Strand 4: Diversity, Change and Continuity', 'T3', 'LIFE_12_4_2', 'Human Evolution', 15.0, 2.0, 2, 'Hominid evolution, fossil evidence, Out of Africa', 10),
('LIFE_SC', 12, 'Strand 3: Environmental Studies', 'T4', 'LIFE_12_3_1', 'Human Impact on the Environment', 17.0, 2.5, 1, 'Population growth, pollution, sustainability, biodiversity loss', 11);

CREATE TABLE IF NOT EXISTS lookup_caps_subtopics (
  subtopic_id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT NOT NULL,
  subtopic_code VARCHAR(20) NOT NULL,
  subtopic_name VARCHAR(255) NOT NULL,
  caps_reference VARCHAR(30) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_topic_subtopic (topic_id, subtopic_code),
  KEY idx_caps_reference (caps_reference),
  CONSTRAINT fk_subtopic_topic FOREIGN KEY (topic_id) REFERENCES lookup_caps_topics(topic_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. TAXONOMY LOOKUP TABLE (1 table)
-- ============================================================

CREATE TABLE IF NOT EXISTS lookup_tag_taxonomy (
  tag_id INT AUTO_INCREMENT PRIMARY KEY,
  tag_code VARCHAR(50) NOT NULL,
  tag_name VARCHAR(255) NOT NULL,
  parent_tag_id INT DEFAULT NULL,
  tag_level VARCHAR(20) NOT NULL,
  tag_category VARCHAR(30) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  requires_approval TINYINT(1) DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tag_code (tag_code),
  KEY idx_tag_level (tag_level),
  KEY idx_tag_category (tag_category),
  CONSTRAINT fk_tag_parent FOREIGN KEY (parent_tag_id) REFERENCES lookup_tag_taxonomy(tag_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lookup_tag_taxonomy (tag_code, tag_name, tag_level, tag_category, description, is_active) VALUES
('COG_REMEMBER', 'Remember', 'cognitive_level', 'assessment', 'Bloom level 1: Retrieve knowledge', 1),
('COG_UNDERSTAND', 'Understand', 'cognitive_level', 'assessment', 'Bloom level 2: Construct meaning', 1),
('COG_APPLY', 'Apply', 'cognitive_level', 'assessment', 'Bloom level 3: Use procedures', 1),
('COG_ANALYSE', 'Analyse', 'cognitive_level', 'assessment', 'Bloom level 4: Break into parts', 1),
('COG_EVALUATE', 'Evaluate', 'cognitive_level', 'assessment', 'Bloom level 5: Make judgments', 1),
('COG_CREATE', 'Create', 'cognitive_level', 'assessment', 'Bloom level 6: Put together', 1),
('DIFF_EASY', 'Easy', 'difficulty', 'assessment', '70-100% correct', 1),
('DIFF_MEDIUM', 'Medium', 'difficulty', 'assessment', '40-69% correct', 1),
('DIFF_HARD', 'Hard', 'difficulty', 'assessment', '0-39% correct', 1),
('TYPE_MCQ', 'Multiple Choice', 'item_type', 'assessment', 'Selected response item', 1),
('TYPE_SHORT', 'Short Answer', 'item_type', 'assessment', 'Brief constructed response', 1),
('TYPE_EXTENDED', 'Extended Response', 'item_type', 'assessment', 'Long constructed response', 1),
('TYPE_DIAGRAM', 'Diagram', 'item_type', 'assessment', 'Diagram-based item', 1),
('TYPE_MATCHING', 'Matching', 'item_type', 'assessment', 'Matching columns item', 1),
('TYPE_ESSAY', 'Essay', 'item_type', 'assessment', 'Essay response', 1),
('TYPE_SOURCE', 'Source-Based', 'item_type', 'assessment', 'Source material based', 1),
('SRC_DBE', 'DBE', 'source', 'administrative', 'Department of Basic Education', 1),
('SRC_IEB', 'IEB', 'source', 'administrative', 'Independent Examinations Board', 1),
('SRC_SACAI', 'SACAI', 'source', 'administrative', 'SACAI', 1),
('SESS_JUNE', 'June', 'source', 'administrative', 'June examination session', 1),
('SESS_NOV', 'November', 'source', 'administrative', 'November examination session', 1),
('SESS_TRIAL', 'Trial', 'source', 'administrative', 'Trial examination', 1);


-- ============================================================
-- 5. MASTER DATA TABLES - ITEMS (10 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS item_master (
  item_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  parent_question VARCHAR(20) DEFAULT NULL,
  is_sub_part TINYINT(1) DEFAULT 0,
  stimulus_text TEXT,
  stimulus_id CHAR(36) DEFAULT NULL,
  question_text TEXT NOT NULL,
  question_text_afr TEXT DEFAULT NULL,
  item_type_id INT NOT NULL,
  cognitive_level_id INT NOT NULL,
  difficulty_id INT NOT NULL,
  language_id INT NOT NULL DEFAULT 1,
  marking_scheme_id INT DEFAULT NULL,
  marks INT NOT NULL,
  marks_allocated INT NOT NULL,
  caps_subtopic_id INT DEFAULT NULL,
  caps_reference VARCHAR(30) DEFAULT NULL,
  source_year INT DEFAULT NULL,
  source_paper_code VARCHAR(50) DEFAULT NULL,
  source_question_number VARCHAR(20) DEFAULT NULL,
  status ENUM('draft','pending_review','revision_required','peer_approved','expert_approved','moderated','published','archived') DEFAULT 'draft',
  review_status VARCHAR(20) DEFAULT 'draft',
  current_version INT DEFAULT 1,
  exposure_count INT DEFAULT 0,
  last_used_date DATE DEFAULT NULL,
  facility_value DECIMAL(5,3) DEFAULT NULL,
  discrimination_index DECIMAL(5,3) DEFAULT NULL,
  is_retired TINYINT(1) DEFAULT 0,
  retired_reason VARCHAR(255) DEFAULT NULL,
  retired_at TIMESTAMP NULL DEFAULT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_item_code (item_code),
  KEY idx_year_grade_subject (year_id, grade_id, subject_id),
  KEY idx_paper_assessment (paper_id, assessment_type_id),
  KEY idx_assessment_body (assessment_body_id),
  KEY idx_cognitive_level (cognitive_level_id),
  KEY idx_difficulty (difficulty_id),
  KEY idx_item_type (item_type_id),
  KEY idx_caps_subtopic (caps_subtopic_id),
  KEY idx_status (status),
  KEY idx_source_paper (source_paper_code),
  KEY idx_exposure (exposure_count),
  KEY idx_is_retired (is_retired),
  CONSTRAINT fk_item_year FOREIGN KEY (year_id) REFERENCES lookup_years(year_id),
  CONSTRAINT fk_item_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id),
  CONSTRAINT fk_item_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_item_paper FOREIGN KEY (paper_id) REFERENCES lookup_papers(paper_id),
  CONSTRAINT fk_item_assessment_type FOREIGN KEY (assessment_type_id) REFERENCES lookup_assessment_types(assessment_type_id),
  CONSTRAINT fk_item_assessment_body FOREIGN KEY (assessment_body_id) REFERENCES lookup_assessment_bodies(assessment_body_id),
  CONSTRAINT fk_item_item_type FOREIGN KEY (item_type_id) REFERENCES lookup_item_types(item_type_id),
  CONSTRAINT fk_item_cognitive FOREIGN KEY (cognitive_level_id) REFERENCES lookup_cognitive_levels(cognitive_level_id),
  CONSTRAINT fk_item_difficulty FOREIGN KEY (difficulty_id) REFERENCES lookup_difficulty_levels(difficulty_id),
  CONSTRAINT fk_item_language FOREIGN KEY (language_id) REFERENCES lookup_languages(language_id),
  CONSTRAINT fk_item_marking_scheme FOREIGN KEY (marking_scheme_id) REFERENCES lookup_marking_schemes(marking_scheme_id),
  CONSTRAINT fk_item_caps_subtopic FOREIGN KEY (caps_subtopic_id) REFERENCES lookup_caps_subtopics(subtopic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_mcq_options (
  option_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  option_label VARCHAR(5) NOT NULL,
  option_text TEXT NOT NULL,
  option_text_afr TEXT DEFAULT NULL,
  is_correct TINYINT(1) DEFAULT 0,
  display_order INT DEFAULT 0,
  selection_count INT DEFAULT NULL,
  selection_percent DECIMAL(5,2) DEFAULT NULL,
  is_distractor_valid TINYINT(1) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_item_option (item_id, option_label),
  KEY idx_item_id (item_id),
  CONSTRAINT fk_mcq_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_memos (
  memo_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_id CHAR(36) NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  answer_text TEXT,
  answer_text_afr TEXT DEFAULT NULL,
  marks INT NOT NULL,
  marking_guideline TEXT,
  marking_scheme_id INT DEFAULT NULL,
  cognitive_level_id INT DEFAULT NULL,
  has_sub_parts TINYINT(1) DEFAULT 0,
  version_number INT DEFAULT 1,
  is_current TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_item_id (item_id),
  KEY idx_question_number (question_number),
  CONSTRAINT fk_memo_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_memo_marking_scheme FOREIGN KEY (marking_scheme_id) REFERENCES lookup_marking_schemes(marking_scheme_id),
  CONSTRAINT fk_memo_cognitive FOREIGN KEY (cognitive_level_id) REFERENCES lookup_cognitive_levels(cognitive_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_memo_subparts (
  subpart_id INT AUTO_INCREMENT PRIMARY KEY,
  memo_id CHAR(36) NOT NULL,
  subpart_number VARCHAR(10) NOT NULL,
  marks INT NOT NULL,
  answer_text TEXT,
  marking_guideline TEXT,
  cognitive_level_id INT DEFAULT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_memo_subpart (memo_id, subpart_number),
  KEY idx_memo_id (memo_id),
  CONSTRAINT fk_subpart_memo FOREIGN KEY (memo_id) REFERENCES item_memos(memo_id) ON DELETE CASCADE,
  CONSTRAINT fk_subpart_cognitive FOREIGN KEY (cognitive_level_id) REFERENCES lookup_cognitive_levels(cognitive_level_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_stimuli (
  stimulus_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,
  stimulus_type ENUM('text','diagram','graph','table','case_study','data_set','image','map','cartoon','quote') NOT NULL,
  stimulus_text TEXT,
  attachment_id INT DEFAULT NULL,
  source_year INT,
  source_paper_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dimensions (year_id, grade_id, subject_id, paper_id, assessment_type_id),
  CONSTRAINT fk_stimulus_year FOREIGN KEY (year_id) REFERENCES lookup_years(year_id),
  CONSTRAINT fk_stimulus_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id),
  CONSTRAINT fk_stimulus_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_stimulus_paper FOREIGN KEY (paper_id) REFERENCES lookup_papers(paper_id),
  CONSTRAINT fk_stimulus_assessment_type FOREIGN KEY (assessment_type_id) REFERENCES lookup_assessment_types(assessment_type_id),
  CONSTRAINT fk_stimulus_assessment_body FOREIGN KEY (assessment_body_id) REFERENCES lookup_assessment_bodies(assessment_body_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_attachments (
  attachment_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  stimulus_id CHAR(36) DEFAULT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  description VARCHAR(255),
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_item_id (item_id),
  KEY idx_stimulus_id (stimulus_id),
  CONSTRAINT fk_attach_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_attach_stimulus FOREIGN KEY (stimulus_id) REFERENCES item_stimuli(stimulus_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_tags (
  item_id CHAR(36) NOT NULL,
  tag_id INT NOT NULL,
  tag_value VARCHAR(150) NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 1.00,
  tagged_by INT DEFAULT NULL,
  tagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, tag_id),
  KEY idx_tag_id (tag_id),
  KEY idx_tagged_by (tagged_by),
  CONSTRAINT fk_tag_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_tag_taxonomy FOREIGN KEY (tag_id) REFERENCES lookup_tag_taxonomy(tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_versions (
  version_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  version_number INT NOT NULL,
  question_text TEXT,
  question_text_afr TEXT,
  marks INT,
  cognitive_level_id INT,
  difficulty_id INT,
  change_type ENUM('create','update','review','rollback','publish') DEFAULT 'update',
  change_reason VARCHAR(255),
  changed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_item_version (item_id, version_number),
  KEY idx_item_id (item_id),
  CONSTRAINT fk_version_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_version_cognitive FOREIGN KEY (cognitive_level_id) REFERENCES lookup_cognitive_levels(cognitive_level_id),
  CONSTRAINT fk_version_difficulty FOREIGN KEY (difficulty_id) REFERENCES lookup_difficulty_levels(difficulty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  parent_review_id INT DEFAULT NULL,
  reviewer_id INT NOT NULL,
  reviewer_role ENUM('peer_reviewer','subject_expert','moderator','admin') NOT NULL,
  review_type ENUM('accuracy','clarity','curriculum','bias','technical','general','marking') DEFAULT 'general',
  comment TEXT NOT NULL,
  status ENUM('open','resolved','dismissed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_item_id (item_id),
  KEY idx_reviewer (reviewer_id),
  KEY idx_parent (parent_review_id),
  CONSTRAINT fk_review_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_workflow (
  workflow_id INT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  current_state ENUM('draft','pending_review','revision_required','peer_approved','expert_approved','moderated','published','archived') DEFAULT 'draft',
  previous_state VARCHAR(50) DEFAULT NULL,
  changed_by INT NOT NULL,
  changed_by_role ENUM('developer','peer_reviewer','subject_expert','moderator','admin') NOT NULL,
  transition_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_item_id (item_id),
  KEY idx_current_state (current_state),
  CONSTRAINT fk_workflow_item FOREIGN KEY (item_id) REFERENCES item_master(item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 6. PAPER ASSEMBLY TABLES (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS paper_templates (
  template_id INT AUTO_INCREMENT PRIMARY KEY,
  template_code VARCHAR(50) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,
  total_marks INT NOT NULL,
  total_items INT NOT NULL,
  duration_minutes INT DEFAULT 180,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_template_code (template_code),
  KEY idx_dimensions (year_id, grade_id, subject_id, paper_id),
  CONSTRAINT fk_template_year FOREIGN KEY (year_id) REFERENCES lookup_years(year_id),
  CONSTRAINT fk_template_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id),
  CONSTRAINT fk_template_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_template_paper FOREIGN KEY (paper_id) REFERENCES lookup_papers(paper_id),
  CONSTRAINT fk_template_assessment_type FOREIGN KEY (assessment_type_id) REFERENCES lookup_assessment_types(assessment_type_id),
  CONSTRAINT fk_template_assessment_body FOREIGN KEY (assessment_body_id) REFERENCES lookup_assessment_bodies(assessment_body_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS paper_template_sections (
  section_id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  section_name VARCHAR(50) NOT NULL,
  section_order INT NOT NULL,
  total_marks INT NOT NULL,
  item_count INT NOT NULL,
  item_type_id INT NOT NULL,
  topic_distribution JSON,
  difficulty_distribution JSON,
  cognitive_distribution JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_template_id (template_id),
  KEY idx_section_order (section_order),
  CONSTRAINT fk_section_template FOREIGN KEY (template_id) REFERENCES paper_templates(template_id) ON DELETE CASCADE,
  CONSTRAINT fk_section_item_type FOREIGN KEY (item_type_id) REFERENCES lookup_item_types(item_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generated_papers (
  paper_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  template_id INT NOT NULL,
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id_lookup INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,
  paper_title VARCHAR(200) NOT NULL,
  total_marks INT NOT NULL,
  status ENUM('draft','assembled','reviewed','approved','published','archived') DEFAULT 'draft',
  assembled_by INT NOT NULL,
  assembled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_template_id (template_id),
  KEY idx_dimensions (year_id, grade_id, subject_id),
  CONSTRAINT fk_gen_paper_template FOREIGN KEY (template_id) REFERENCES paper_templates(template_id),
  CONSTRAINT fk_gen_paper_year FOREIGN KEY (year_id) REFERENCES lookup_years(year_id),
  CONSTRAINT fk_gen_paper_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id),
  CONSTRAINT fk_gen_paper_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_gen_paper_paper FOREIGN KEY (paper_id_lookup) REFERENCES lookup_papers(paper_id),
  CONSTRAINT fk_gen_paper_assessment_type FOREIGN KEY (assessment_type_id) REFERENCES lookup_assessment_types(assessment_type_id),
  CONSTRAINT fk_gen_paper_assessment_body FOREIGN KEY (assessment_body_id) REFERENCES lookup_assessment_bodies(assessment_body_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generated_paper_items (
  paper_item_id INT AUTO_INCREMENT PRIMARY KEY,
  paper_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  section_id INT NOT NULL,
  display_order INT NOT NULL,
  marks_as_allocated INT NOT NULL,
  is_anchor_item TINYINT(1) DEFAULT 0,
  is_randomized TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paper_item_section (paper_id, item_id, section_id),
  KEY idx_paper_id (paper_id),
  KEY idx_item_id (item_id),
  CONSTRAINT fk_paper_item_paper FOREIGN KEY (paper_id) REFERENCES generated_papers(paper_id) ON DELETE CASCADE,
  CONSTRAINT fk_paper_item_item FOREIGN KEY (item_id) REFERENCES item_master(item_id),
  CONSTRAINT fk_paper_item_section FOREIGN KEY (section_id) REFERENCES paper_template_sections(section_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. PARSER & COMPARISON TABLES (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS parse_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  parser_version VARCHAR(20) DEFAULT '1.0',
  total_items_found INT,
  total_marks_parser INT,
  total_marks_expected INT,
  total_marks_corrected INT,
  auto_corrected_count INT DEFAULT 0,
  manual_review_count INT DEFAULT 0,
  missing_count INT DEFAULT 0,
  status ENUM('parsing','comparing','auto_corrected','reviewing','completed','failed') DEFAULT 'parsing',
  error_message TEXT,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dimensions (year_id, grade_id, subject_id, paper_id),
  CONSTRAINT fk_parse_year FOREIGN KEY (year_id) REFERENCES lookup_years(year_id),
  CONSTRAINT fk_parse_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id),
  CONSTRAINT fk_parse_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_parse_paper FOREIGN KEY (paper_id) REFERENCES lookup_papers(paper_id),
  CONSTRAINT fk_parse_assessment_type FOREIGN KEY (assessment_type_id) REFERENCES lookup_assessment_types(assessment_type_id),
  CONSTRAINT fk_parse_assessment_body FOREIGN KEY (assessment_body_id) REFERENCES lookup_assessment_bodies(assessment_body_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parse_expected_structure (
  structure_id INT AUTO_INCREMENT PRIMARY KEY,
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  question_type_id INT NOT NULL,
  section VARCHAR(20) NOT NULL,
  expected_marks INT NOT NULL,
  sequence INT NOT NULL,
  parent_question VARCHAR(20) DEFAULT NULL,
  is_sub_part TINYINT(1) DEFAULT 0,
  cognitive_level_id INT DEFAULT NULL,
  caps_subtopic_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_dimensions_question (year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, question_number),
  KEY idx_dimensions (year_id, grade_id, subject_id, paper_id),
  CONSTRAINT fk_expected_year FOREIGN KEY (year_id) REFERENCES lookup_years(year_id),
  CONSTRAINT fk_expected_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id),
  CONSTRAINT fk_expected_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_expected_paper FOREIGN KEY (paper_id) REFERENCES lookup_papers(paper_id),
  CONSTRAINT fk_expected_assessment_type FOREIGN KEY (assessment_type_id) REFERENCES lookup_assessment_types(assessment_type_id),
  CONSTRAINT fk_expected_assessment_body FOREIGN KEY (assessment_body_id) REFERENCES lookup_assessment_bodies(assessment_body_id),
  CONSTRAINT fk_expected_question_type FOREIGN KEY (question_type_id) REFERENCES lookup_item_types(item_type_id),
  CONSTRAINT fk_expected_cognitive FOREIGN KEY (cognitive_level_id) REFERENCES lookup_cognitive_levels(cognitive_level_id),
  CONSTRAINT fk_expected_caps_subtopic FOREIGN KEY (caps_subtopic_id) REFERENCES lookup_caps_subtopics(subtopic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parse_results (
  result_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  question_text TEXT,
  parsed_type_id INT DEFAULT NULL,
  parsed_section VARCHAR(20),
  parser_extracted_marks INT,
  expected_marks INT NOT NULL,
  auto_corrected_marks INT,
  correction_status ENUM('auto_corrected','manual_review','validated','parser_missing') DEFAULT 'auto_corrected',
  variance INT GENERATED ALWAYS AS (parser_extracted_marks - expected_marks) STORED,
  is_red_flag TINYINT(1) GENERATED ALWAYS AS (CASE WHEN ABS(parser_extracted_marks - expected_marks) > expected_marks THEN 1 ELSE 0 END) STORED,
  user_corrected_marks INT,
  reviewer_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_session_id (session_id),
  KEY idx_question_number (question_number),
  KEY idx_correction_status (correction_status),
  CONSTRAINT fk_result_session FOREIGN KEY (session_id) REFERENCES parse_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_result_type FOREIGN KEY (parsed_type_id) REFERENCES lookup_item_types(item_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. USER & ADMIN TABLES (2 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS qbank_users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('Examiner','Chief Examiner','Moderator','Admin','Developer','Peer_Reviewer','Subject_Expert') DEFAULT 'Examiner',
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_subject_assignments (
  assignment_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject_id INT NOT NULL,
  grade_id INT DEFAULT NULL,
  is_primary_expert TINYINT(1) DEFAULT 0,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_subject_grade (user_id, subject_id, grade_id),
  CONSTRAINT fk_assign_user FOREIGN KEY (user_id) REFERENCES qbank_users(user_id),
  CONSTRAINT fk_assign_subject FOREIGN KEY (subject_id) REFERENCES lookup_subjects(subject_id),
  CONSTRAINT fk_assign_grade FOREIGN KEY (grade_id) REFERENCES lookup_grades(grade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. PARSE EXPECTED STRUCTURE SEED DATA - Life Sciences Grade 12 Paper 1
-- ============================================================

-- NOTE: This requires lookup_subjects to be synced from nsc_registration_v3 first
-- Life Sciences subject_id = 1 (after sync)
-- year_id = 6 for 2025, grade_id = 3 for Grade 12, paper_id = 1 for P1
-- assessment_type_id = 1 for EXAM, assessment_body_id = 1 for DBE

INSERT INTO parse_expected_structure (year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, question_number, question_type_id, section, expected_marks, sequence, parent_question, is_sub_part, cognitive_level_id) VALUES
-- Section A: MCQs (1.1.1 - 1.1.10, 2 marks each = 20)
(6, 3, 1, 1, 1, 1, '1.1.1', 1, 'A', 2, 1, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.2', 1, 'A', 2, 2, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.3', 1, 'A', 2, 3, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.4', 1, 'A', 2, 4, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.5', 1, 'A', 2, 5, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.6', 1, 'A', 2, 6, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.7', 1, 'A', 2, 7, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.8', 1, 'A', 2, 8, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.9', 1, 'A', 2, 9, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.1.10', 1, 'A', 2, 10, NULL, 0, 1),

-- Section A: Short Answer (1.2.1 - 1.2.8, 1 mark each = 8)
(6, 3, 1, 1, 1, 1, '1.2.1', 2, 'A', 1, 11, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.2', 2, 'A', 1, 12, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.3', 2, 'A', 1, 13, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.4', 2, 'A', 1, 14, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.5', 2, 'A', 1, 15, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.6', 2, 'A', 1, 16, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.7', 2, 'A', 1, 17, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.8', 2, 'A', 1, 18, NULL, 0, 1),

-- Section A: Matching (1.3.1 - 1.3.3, 2 marks each = 6)
(6, 3, 1, 1, 1, 1, '1.3.1', 7, 'A', 2, 19, NULL, 0, 2),
(6, 3, 1, 1, 1, 1, '1.3.2', 7, 'A', 2, 20, NULL, 0, 2),
(6, 3, 1, 1, 1, 1, '1.3.3', 7, 'A', 2, 21, NULL, 0, 2),

-- Section A: Diagrams (1.4.1 - 1.4.3, 8 marks total)
(6, 3, 1, 1, 1, 1, '1.4.1', 6, 'A', 3, 22, '1.4', 1, 3),
(6, 3, 1, 1, 1, 1, '1.4.2', 6, 'A', 3, 23, '1.4', 1, 3),
(6, 3, 1, 1, 1, 1, '1.4.3', 6, 'A', 2, 24, '1.4', 1, 3),

-- Section A: Diagrams (1.5.1 - 1.5.4, 8 marks total)
(6, 3, 1, 1, 1, 1, '1.5.1', 6, 'A', 2, 25, '1.5', 1, 3),
(6, 3, 1, 1, 1, 1, '1.5.2', 6, 'A', 2, 26, '1.5', 1, 3),
(6, 3, 1, 1, 1, 1, '1.5.3', 6, 'A', 2, 27, '1.5', 1, 3),
(6, 3, 1, 1, 1, 1, '1.5.4', 6, 'A', 2, 28, '1.5', 1, 3),

-- Section B: Extended (2.1 - 2.5, 50 marks total)
(6, 3, 1, 1, 1, 1, '2.1', 4, 'B', 8, 29, NULL, 0, 4),
(6, 3, 1, 1, 1, 1, '2.2', 4, 'B', 11, 30, NULL, 0, 4),
(6, 3, 1, 1, 1, 1, '2.3', 4, 'B', 14, 31, NULL, 0, 4),
(6, 3, 1, 1, 1, 1, '2.4', 4, 'B', 6, 32, NULL, 0, 3),
(6, 3, 1, 1, 1, 1, '2.5', 4, 'B', 11, 33, NULL, 0, 4),

-- Section C: Extended (3.1 - 3.5, 50 marks total)
(6, 3, 1, 1, 1, 1, '3.1', 4, 'C', 8, 34, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.2', 4, 'C', 13, 35, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.3', 4, 'C', 5, 36, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.4', 4, 'C', 14, 37, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.5', 4, 'C', 10, 38, NULL, 0, 5);

-- ============================================================
-- END OF MIGRATION 014
-- ============================================================

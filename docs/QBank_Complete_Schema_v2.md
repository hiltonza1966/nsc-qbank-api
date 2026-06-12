# QBank Complete Schema & Seed Data Guide v2.0
**Date:** 12 June 2026
**Updated:** Document Synchronization — Complete Schema with All 34 Tables
**Database:** nsc_qbank (MySQL 8.0.45)
**Total Tables:** 34 (15 lookup + 19 transactional)
**Character Set:** utf8mb4 COLLATE utf8mb4_unicode_ci
**Engine:** InnoDB

---

## TABLE OF CONTENTS

1. Core Dimension Lookup Tables (6 tables)
2. Secondary Dimension Lookup Tables (6 tables)
3. Curriculum Lookup Tables — CAPS (2 tables)
4. Taxonomy Lookup Table (1 table)
5. Master Data Tables — Items (10 tables)
6. Paper Assembly Tables (4 tables)
7. Parser & Comparison Tables (3 tables)
8. User & Admin Tables (2 tables)
9. Life Sciences CAPS Seed Data
10. Complete Table Count & Relationships
11. Key Design Principles

---

## 1. CORE DIMENSION LOOKUP TABLES (6 tables)

### 1.1 lookup_years (Academic Years)

```sql
CREATE TABLE lookup_years (
  year_id INT AUTO_INCREMENT PRIMARY KEY,
  year_value INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_year_value (year_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_years (year_value, is_active) VALUES
(2020, 1), (2021, 1), (2022, 1), (2023, 1), (2024, 1),
(2025, 1), (2026, 1), (2027, 1), (2028, 1), (2029, 1), (2030, 1);
```

### 1.2 lookup_grades (Grade Levels)

```sql
CREATE TABLE lookup_grades (
  grade_id INT AUTO_INCREMENT PRIMARY KEY,
  grade_number INT NOT NULL,
  grade_name VARCHAR(50) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grade_number (grade_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_grades (grade_number, grade_name, is_active) VALUES
(10, 'Grade 10', 1), (11, 'Grade 11', 1), (12, 'Grade 12', 1);
```

### 1.3 lookup_subjects (NSC Subjects)

```sql
CREATE TABLE lookup_subjects (
  subject_id INT AUTO_INCREMENT PRIMARY KEY,
  subject_official_code VARCHAR(20) NOT NULL,
  subject_alpha_code VARCHAR(20) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  subject_name_afr VARCHAR(255) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_subject_official_code (subject_official_code),
  UNIQUE KEY uk_subject_alpha_code (subject_alpha_code),
  KEY idx_subject_name (subject_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:** Synced from `nsc_registration_v3.lookup_subjects` via stored procedure `sync_lookup_subjects()`.
**Count:** 123 subjects as of 2026-06-09.
**Key subjects:**
- `LIFE_SC` — Life Sciences
- `MATH` — Mathematics
- `MATH_LIT` — Mathematical Literacy
- `PHYS` — Physical Sciences
- `CHEM` — Chemistry
- `GEOGRAPHY` — Geography
- `HISTORY` — History
- `ACCOUNTING` — Accounting
- `BUSINESS_STUDIES` — Business Studies
- `ECONOMICS` — Economics
- `ENGLISH_FAL` — English First Additional Language
- `ENGLISH_HL` — English Home Language
- `AFRIKAANS_FAL` — Afrikaans First Additional Language
- `AFRIKAANS_HL` — Afrikaans Home Language
- (Plus 109 more subjects)

### 1.4 lookup_papers (Paper Types)

```sql
CREATE TABLE lookup_papers (
  paper_id INT AUTO_INCREMENT PRIMARY KEY,
  paper_no INT NOT NULL,
  paper_name VARCHAR(100) NOT NULL,
  paper_name_afr VARCHAR(100) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paper_no (paper_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_papers (paper_no, paper_name, paper_name_afr, description, is_active) VALUES
(1, 'Paper 1', 'Vraestel 1', 'First examination paper', 1),
(2, 'Paper 2', 'Vraestel 2', 'Second examination paper', 1),
(3, 'Paper 3', 'Vraestel 3', 'Third examination paper', 1),
(4, 'Practical', 'Prakties', 'Practical examination', 1),
(5, 'PAT', 'PAT', 'Practical Assessment Task', 1),
(6, 'Oral', 'Mondelig', 'Oral examination', 1),
(7, 'SBA', 'SBA', 'School-Based Assessment', 1);
```

### 1.5 lookup_assessment_types (Assessment Types)

```sql
CREATE TABLE lookup_assessment_types (
  assessment_type_id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_type_code VARCHAR(20) NOT NULL,
  assessment_type_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assessment_type_code (assessment_type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_assessment_types (assessment_type_code, assessment_type_name, description, is_active) VALUES
('EXAM', 'Examination', 'Final examination', 1),
('TEST', 'Test', 'Class test', 1),
('SBA', 'School-Based Assessment', 'Continuous assessment', 1),
('PAT', 'Practical Assessment Task', 'Practical task', 1),
('TRIAL', 'Trial Examination', 'Preliminary examination', 1),
('DIAGNOSTIC', 'Diagnostic Assessment', 'Diagnostic test', 1),
('BASELINE', 'Baseline Assessment', 'Baseline test', 1);
```

### 1.6 lookup_assessment_bodies (Assessment Bodies)

```sql
CREATE TABLE lookup_assessment_bodies (
  assessment_body_id INT AUTO_INCREMENT PRIMARY KEY,
  assessment_origin VARCHAR(50) NOT NULL,
  assessment_body_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assessment_origin (assessment_origin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_assessment_bodies (assessment_origin, assessment_body_name, description, is_active) VALUES
('DBE', 'Department of Basic Education', 'National Department of Basic Education', 1),
('IEB', 'Independent Examinations Board', 'Independent Examinations Board', 1),
('SACAI', 'SACAI', 'South African Comprehensive Assessment Institute', 1),
('NSC', 'National Senior Certificate', 'National Senior Certificate', 1);
```

---

## 2. SECONDARY DIMENSION LOOKUP TABLES (6 tables)

### 2.1 lookup_cognitive_levels (Bloom's Taxonomy)

```sql
CREATE TABLE lookup_cognitive_levels (
  cognitive_level_id INT AUTO_INCREMENT PRIMARY KEY,
  level_code VARCHAR(20) NOT NULL,
  level_name VARCHAR(100) NOT NULL,
  level_name_afr VARCHAR(100) DEFAULT NULL,
  bloom_level INT NOT NULL,
  caps_weighting DECIMAL(5,2) DEFAULT NULL,
  description TEXT,
  example_verbs TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_level_code (level_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_cognitive_levels (level_code, level_name, bloom_level, caps_weighting, description, example_verbs, is_active) VALUES
('REMEMBER', 'Remember', 1, 40.00, 'Retrieve relevant knowledge from long-term memory', 'define, list, identify, name, recall, state', 1),
('UNDERSTAND', 'Understand', 2, 25.00, 'Construct meaning from instructional messages', 'explain, describe, classify, summarize, interpret', 1),
('APPLY', 'Apply', 3, 20.00, 'Carry out or use a procedure in a given situation', 'calculate, solve, demonstrate, use, perform', 1),
('ANALYSE', 'Analyse', 4, 10.00, 'Break material into constituent parts and determine relationships', 'analyse, compare, contrast, differentiate, examine', 1),
('EVALUATE', 'Evaluate', 5, 3.75, 'Make judgments based on criteria and standards', 'evaluate, justify, judge, recommend, critique', 1),
('CREATE', 'Create', 6, 1.25, 'Put elements together to form a coherent whole', 'design, construct, develop, formulate, invent', 1);
```

### 2.2 lookup_difficulty_levels (Item Difficulty)

```sql
CREATE TABLE lookup_difficulty_levels (
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
```

**Seed Data:**
```sql
INSERT INTO lookup_difficulty_levels (difficulty_code, difficulty_name, p_value_min, p_value_max, description, is_active) VALUES
('EASY', 'Easy', 0.70, 1.00, '70-100% of learners answer correctly', 1),
('MEDIUM', 'Medium', 0.40, 0.69, '40-69% of learners answer correctly', 1),
('HARD', 'Hard', 0.00, 0.39, '0-39% of learners answer correctly', 1);
```

### 2.3 lookup_item_types (Item Types)

```sql
CREATE TABLE lookup_item_types (
  item_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_code VARCHAR(20) NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  type_name_afr VARCHAR(100) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_item_types (type_code, type_name, description, is_active) VALUES
('MCQ', 'Multiple Choice', 'Selected response item with 4 options', 1),
('SHORT', 'Short Answer', 'Brief constructed response (1-2 sentences)', 1),
('MEDIUM', 'Medium Response', 'Medium constructed response (3-5 sentences)', 1),
('EXTENDED', 'Extended Response', 'Long constructed response (paragraph+)', 1),
('ESSAY', 'Essay', 'Extended written response', 1),
('DIAGRAM', 'Diagram', 'Diagram-based or labeling item', 1),
('MATCHING', 'Matching', 'Matching columns or pairing item', 1),
('PRACTICAL', 'Practical', 'Practical or laboratory-based item', 1),
('SOURCE', 'Source-Based', 'Source material based item', 1);
```

### 2.4 lookup_languages (Official Languages)

```sql
CREATE TABLE lookup_languages (
  language_id INT AUTO_INCREMENT PRIMARY KEY,
  language_code VARCHAR(10) NOT NULL,
  language_name VARCHAR(100) NOT NULL,
  is_official TINYINT(1) DEFAULT 1,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_language_code (language_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_languages (language_code, language_name, is_official, is_active) VALUES
('EN', 'English', 1, 1),
('AF', 'Afrikaans', 1, 1),
('ZU', 'isiZulu', 1, 1),
('XH', 'isiXhosa', 1, 1),
('ST', 'Sesotho', 1, 1),
('TN', 'Setswana', 1, 1),
('NS', 'isiNdebele', 1, 1),
('SS', 'siSwati', 1, 1),
('TS', 'Xitsonga', 1, 1),
('VE', 'Tshivenda', 1, 1),
('NR', 'Sepedi', 1, 1);
```

### 2.5 lookup_exam_sessions (Examination Sessions)

```sql
CREATE TABLE lookup_exam_sessions (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  session_code VARCHAR(20) NOT NULL,
  session_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_session_code (session_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_exam_sessions (session_code, session_name, description, is_active) VALUES
('JUNE', 'June', 'June examination session', 1),
('NOV', 'November', 'November examination session', 1),
('TRIAL', 'Trial', 'Trial examination', 1),
('BASELINE', 'Baseline', 'Baseline assessment', 1),
('MIDYEAR', 'Mid-Year', 'Mid-year examination', 1);
```

### 2.6 lookup_marking_schemes (Marking Schemes)

```sql
CREATE TABLE lookup_marking_schemes (
  marking_scheme_id INT AUTO_INCREMENT PRIMARY KEY,
  scheme_code VARCHAR(20) NOT NULL,
  scheme_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_scheme_code (scheme_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Seed Data:**
```sql
INSERT INTO lookup_marking_schemes (scheme_code, scheme_name, description, is_active) VALUES
('HOLISTIC', 'Holistic', 'Overall impression marking', 1),
('ANALYTIC', 'Analytic', 'Mark per criterion or component', 1),
('RUBRIC', 'Rubric', 'Pre-defined performance levels', 1),
('KEYWORD', 'Keyword', 'Specific words or phrases required', 1),
('METHOD', 'Method', 'Method marks + accuracy marks', 1);
```

---

## 3. CURRICULUM LOOKUP TABLES — CAPS (2 tables)

### 3.1 lookup_caps_topics (CAPS Topics per Subject-Grade)

```sql
CREATE TABLE lookup_caps_topics (
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
```

### 3.2 lookup_caps_subtopics (CAPS Subtopics per Topic)

```sql
CREATE TABLE lookup_caps_subtopics (
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
```

---

## 4. TAXONOMY LOOKUP TABLE

### 4.1 lookup_tag_taxonomy (Controlled Vocabulary for Tags)

```sql
CREATE TABLE lookup_tag_taxonomy (
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
```

**Seed Data:**
```sql
INSERT INTO lookup_tag_taxonomy (tag_code, tag_name, tag_level, tag_category, description, is_active) VALUES
-- Cognitive Levels
('COG_REMEMBER', 'Remember', 'cognitive_level', 'assessment', 'Bloom level 1: Retrieve knowledge', 1),
('COG_UNDERSTAND', 'Understand', 'cognitive_level', 'assessment', 'Bloom level 2: Construct meaning', 1),
('COG_APPLY', 'Apply', 'cognitive_level', 'assessment', 'Bloom level 3: Use procedures', 1),
('COG_ANALYSE', 'Analyse', 'cognitive_level', 'assessment', 'Bloom level 4: Break into parts', 1),
('COG_EVALUATE', 'Evaluate', 'cognitive_level', 'assessment', 'Bloom level 5: Make judgments', 1),
('COG_CREATE', 'Create', 'cognitive_level', 'assessment', 'Bloom level 6: Put together', 1),

-- Difficulty Levels
('DIFF_EASY', 'Easy', 'difficulty', 'assessment', '70-100% correct', 1),
('DIFF_MEDIUM', 'Medium', 'difficulty', 'assessment', '40-69% correct', 1),
('DIFF_HARD', 'Hard', 'difficulty', 'assessment', '0-39% correct', 1),

-- Item Types
('TYPE_MCQ', 'Multiple Choice', 'item_type', 'assessment', 'Selected response item', 1),
('TYPE_SHORT', 'Short Answer', 'item_type', 'assessment', 'Brief constructed response', 1),
('TYPE_EXTENDED', 'Extended Response', 'item_type', 'assessment', 'Long constructed response', 1),
('TYPE_DIAGRAM', 'Diagram', 'item_type', 'assessment', 'Diagram-based item', 1),
('TYPE_MATCHING', 'Matching', 'item_type', 'assessment', 'Matching columns item', 1),
('TYPE_ESSAY', 'Essay', 'item_type', 'assessment', 'Essay response', 1),
('TYPE_SOURCE', 'Source-Based', 'item_type', 'assessment', 'Source material based', 1),

-- Sources
('SRC_DBE', 'DBE', 'source', 'administrative', 'Department of Basic Education', 1),
('SRC_IEB', 'IEB', 'source', 'administrative', 'Independent Examinations Board', 1),
('SRC_SACAI', 'SACAI', 'source', 'administrative', 'SACAI', 1),

-- Exam Sessions
('SESS_JUNE', 'June', 'source', 'administrative', 'June examination session', 1),
('SESS_NOV', 'November', 'source', 'administrative', 'November examination session', 1),
('SESS_TRIAL', 'Trial', 'source', 'administrative', 'Trial examination', 1);
```

---

## 5. MASTER DATA TABLES — ITEMS (10 tables)

### 5.1 item_master (The Core Item Table)

```sql
CREATE TABLE item_master (
  item_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- Core Dimensions (ALL link to lookup tables)
  year_id INT NOT NULL,
  grade_id INT NOT NULL,
  subject_id INT NOT NULL,
  paper_id INT NOT NULL,
  assessment_type_id INT NOT NULL,
  assessment_body_id INT NOT NULL,

  -- Item Identification
  item_code VARCHAR(50) NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  parent_question VARCHAR(20) DEFAULT NULL,
  is_sub_part TINYINT(1) DEFAULT 0,

  -- Item Content
  stimulus_text TEXT,
  stimulus_id CHAR(36) DEFAULT NULL,
  question_text TEXT NOT NULL,
  question_text_afr TEXT DEFAULT NULL,

  -- Classification (ALL link to lookup tables)
  item_type_id INT NOT NULL,
  cognitive_level_id INT NOT NULL,
  difficulty_id INT NOT NULL,
  language_id INT NOT NULL DEFAULT 1,
  marking_scheme_id INT DEFAULT NULL,

  -- Scoring
  marks INT NOT NULL,
  marks_allocated INT NOT NULL,

  -- Curriculum Alignment
  caps_subtopic_id INT DEFAULT NULL,
  caps_reference VARCHAR(30) DEFAULT NULL,

  -- Source/Provenance
  source_year INT DEFAULT NULL,
  source_paper_code VARCHAR(50) DEFAULT NULL,
  source_question_number VARCHAR(20) DEFAULT NULL,

  -- Status & Workflow
  status ENUM('draft','pending_review','revision_required','peer_approved','expert_approved','moderated','published','archived') DEFAULT 'draft',
  review_status VARCHAR(20) DEFAULT 'draft',
  current_version INT DEFAULT 1,

  -- Psychometrics
  exposure_count INT DEFAULT 0,
  last_used_date DATE DEFAULT NULL,
  facility_value DECIMAL(5,3) DEFAULT NULL,
  discrimination_index DECIMAL(5,3) DEFAULT NULL,
  is_retired TINYINT(1) DEFAULT 0,
  retired_reason VARCHAR(255) DEFAULT NULL,
  retired_at TIMESTAMP NULL DEFAULT NULL,

  -- Administration
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
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

  -- Foreign Keys
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
```

### 5.2 item_mcq_options (MCQ Options)

```sql
CREATE TABLE item_mcq_options (
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
```

### 5.3 item_memos (Marking Guidelines)

```sql
CREATE TABLE item_memos (
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
```

### 5.4 item_memo_subparts (Detailed Marking Rubrics)

```sql
CREATE TABLE item_memo_subparts (
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
```

### 5.5 item_stimuli (Shared Stimuli)

```sql
CREATE TABLE item_stimuli (
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
```

### 5.6 item_attachments (Images/Diagrams)

```sql
CREATE TABLE item_attachments (
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
```

### 5.7 item_tags (Item Tagging)

```sql
CREATE TABLE item_tags (
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
```

### 5.8 item_versions (Audit Trail)

```sql
CREATE TABLE item_versions (
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
```

### 5.9 item_reviews (Review Workflow)

```sql
CREATE TABLE item_reviews (
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
```

### 5.10 review_workflow (State Machine Transitions)

```sql
CREATE TABLE review_workflow (
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
```

---

## 6. PAPER ASSEMBLY TABLES (4 tables)

### 6.1 paper_templates (Paper Blueprints)

```sql
CREATE TABLE paper_templates (
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
```

### 6.2 paper_template_sections (Template Sections)

```sql
CREATE TABLE paper_template_sections (
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
```

### 6.3 generated_papers (Assembled Papers)

```sql
CREATE TABLE generated_papers (
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
```

### 6.4 generated_paper_items (Items in Assembled Papers)

```sql
CREATE TABLE generated_paper_items (
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
```

---

## 7. PARSER & COMPARISON TABLES (3 tables)

### 7.1 parse_sessions (Parser Audit Trail)

```sql
CREATE TABLE parse_sessions (
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
```

### 7.2 parse_expected_structure (Gold Standard)

```sql
CREATE TABLE parse_expected_structure (
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
```

**NOTE:** Migration 015 adds `paper_code VARCHAR(50)` column to this table. Status: CREATED but NOT APPLIED.

### 7.3 parse_results (Parser Output)

```sql
CREATE TABLE parse_results (
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
```

**NOTE:** Migration 015 adds `paper_code VARCHAR(50)` column to this table. Status: CREATED but NOT APPLIED.

---

## 8. USER & ADMIN TABLES (2 tables)

### 8.1 qbank_users (System Users)

```sql
CREATE TABLE qbank_users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('Examiner','Chief Examiner','Moderator','Admin','Developer','Peer_Reviewer','Subject_Expert') DEFAULT 'Examiner',
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8.2 user_subject_assignments (Subject Expert Assignments)

```sql
CREATE TABLE user_subject_assignments (
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
```

---

## 9. LIFE SCIENCES CAPS SEED DATA

### 9.1 Grade 12 CAPS Topics (from CAPS document pages 59-70) — ✅ SEEDED

```sql
-- Grade 12 Life Sciences Topics
INSERT INTO lookup_caps_topics (subject_official_code, grade_id, strand, term, topic_code, topic_name, topic_weighting, time_weeks, paper_no, description, display_order) VALUES
-- TERM 1: Strand 1 + Strand 2
('LIFE_SC', 12, 'Strand 1: Life at Molecular, Cellular and Tissue Level', 'T1', 'LIFE_12_1_1', 'DNA: Code of Life', 19.0, 2.5, 2, 'DNA structure, RNA, protein synthesis, genetic code', 1),
('LIFE_SC', 12, 'Strand 1: Life at Molecular, Cellular and Tissue Level', 'T1', 'LIFE_12_1_2', 'Meiosis', 7.0, 1.0, 1, 'Process of reduction division, genetic variation', 2),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T1', 'LIFE_12_2_1', 'Reproduction in Vertebrates', 4.0, 0.5, 1, 'Diversity of reproductive strategies', 3),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T1', 'LIFE_12_2_2', 'Human Reproduction', 21.0, 3.0, 1, 'Male/female systems, hormonal control, pregnancy', 4),

-- TERM 2: Strand 2 + Strand 1
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_3', 'Responding to the Environment: Humans', 30.0, 4.0, 1, 'Nervous system, senses, endocrine system, homeostasis', 5),
('LIFE_SC', 12, 'Strand 1: Life at Molecular, Cellular and Tissue Level', 'T2', 'LIFE_12_1_3', 'Human Endocrine System', 15.0, 1.5, 1, 'Hormones, feedback mechanisms, diabetes', 6),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_4', 'Homeostasis in Humans', 7.0, 1.0, 1, 'Temperature regulation, water balance', 7),
('LIFE_SC', 12, 'Strand 2: Life Processes in Plants and Animals', 'T2', 'LIFE_12_2_5', 'Responding to the Environment: Plants', 7.0, 1.0, 1, 'Plant hormones, tropisms, defence mechanisms', 8),

-- TERM 3: Strand 4
('LIFE_SC', 12, 'Strand 4: Diversity, Change and Continuity', 'T3', 'LIFE_12_4_1', 'Evolution by Natural Selection', 15.0, 2.0, 2, 'Darwinism, speciation, evidence for evolution', 9),
('LIFE_SC', 12, 'Strand 4: Diversity, Change and Continuity', 'T3', 'LIFE_12_4_2', 'Human Evolution', 15.0, 2.0, 2, 'Hominid evolution, fossil evidence, Out of Africa', 10),

-- TERM 4: Strand 3 (examined from Grade 11)
('LIFE_SC', 12, 'Strand 3: Environmental Studies', 'T4', 'LIFE_12_3_1', 'Human Impact on the Environment', 17.0, 2.5, 1, 'Population growth, pollution, sustainability, biodiversity loss', 11);
```

### 9.2 Grade 12 Paper Structure (from CAPS page 78) — ✅ POPULATED in parse_expected_structure

**Paper 1 (2½ hours, 150 marks):**
| Section | Question | Type | Marks | Cognitive Level |
|---------|----------|------|-------|-----------------|
| A | 1.1.1-1.1.10 | MCQ | 2 each = 20 | Remember/Understand |
| A | 1.2.1-1.2.8 | Short | 1 each = 8 | Remember/Understand |
| A | 1.3.1-1.3.3 | Matching | 2 each = 6 | Understand/Apply |
| A | 1.4.1-1.4.3 | Diagram | 8 total | Apply/Analyse |
| A | 1.5.1-1.5.4 | Diagram | 8 total | Apply/Analyse |
| B | 2.1 | Extended | 8 | Analyse/Evaluate |
| B | 2.2 | Extended | 11 | Analyse/Evaluate |
| B | 2.3 | Extended | 14 | Analyse/Evaluate |
| B | 2.4 | Extended | 6 | Apply/Analyse |
| B | 2.5 | Extended | 11 | Analyse/Evaluate |
| C | 3.1 | Extended | 8 | Evaluate/Create |
| C | 3.2 | Extended | 13 | Evaluate/Create |
| C | 3.3 | Extended | 5 | Evaluate/Create |
| C | 3.4 | Extended | 14 | Evaluate/Create |
| C | 3.5 | Extended | 10 | Evaluate/Create |
| **Total** | **38 items** | | **150 marks** | |

**Paper 2 (2½ hours, 150 marks):**
| Section | Content | Marks |
|---------|---------|-------|
| T1 | DNA: Code of Life | 27 |
| T1 | Meiosis | 12 |
| T2 | Genetics & Inheritance | 45 |
| T3 | Evolution through Natural Selection | 23 |
| T3/T4 | Human Evolution | 43 |
| **Total** | | **150** |

### 9.3 parse_expected_structure Seed Data (LIFE_SC P1 Nov 2025) — ✅ POPULATED

```sql
-- Paper 1 Expected Structure (Grade 12 November 2025)
-- year_id=6 (2025), grade_id=3 (Grade 12), subject_id=1 (Life Sciences), paper_id=1 (Paper 1), assessment_type_id=1 (EXAM), assessment_body_id=1 (DBE)
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
(6, 3, 1, 1, 1, 1, '1.2.1', 4, 'A', 1, 11, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.2', 4, 'A', 1, 12, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.3', 4, 'A', 1, 13, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.4', 4, 'A', 1, 14, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.5', 4, 'A', 1, 15, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.6', 4, 'A', 1, 16, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.7', 4, 'A', 1, 17, NULL, 0, 1),
(6, 3, 1, 1, 1, 1, '1.2.8', 4, 'A', 1, 18, NULL, 0, 1),

-- Section A: Matching (1.3.1 - 1.3.3, 2 marks each = 6)
(6, 3, 1, 1, 1, 1, '1.3.1', 2, 'A', 2, 19, NULL, 0, 2),
(6, 3, 1, 1, 1, 1, '1.3.2', 2, 'A', 2, 20, NULL, 0, 2),
(6, 3, 1, 1, 1, 1, '1.3.3', 2, 'A', 2, 21, NULL, 0, 2),

-- Section A: Diagrams (1.4.1 - 1.4.3, 8 marks total)
(6, 3, 1, 1, 1, 1, '1.4.1', 8, 'A', 3, 22, '1.4', 1, 3),
(6, 3, 1, 1, 1, 1, '1.4.2', 8, 'A', 3, 23, '1.4', 1, 3),
(6, 3, 1, 1, 1, 1, '1.4.3', 8, 'A', 2, 24, '1.4', 1, 3),

-- Section A: Diagrams (1.5.1 - 1.5.4, 8 marks total)
(6, 3, 1, 1, 1, 1, '1.5.1', 8, 'A', 2, 25, '1.5', 1, 3),
(6, 3, 1, 1, 1, 1, '1.5.2', 8, 'A', 2, 26, '1.5', 1, 3),
(6, 3, 1, 1, 1, 1, '1.5.3', 8, 'A', 2, 27, '1.5', 1, 3),
(6, 3, 1, 1, 1, 1, '1.5.4', 8, 'A', 2, 28, '1.5', 1, 3),

-- Section B: Extended (2.1 - 2.5, 50 marks total)
(6, 3, 1, 1, 1, 1, '2.1', 6, 'B', 8, 29, NULL, 0, 4),
(6, 3, 1, 1, 1, 1, '2.2', 6, 'B', 11, 30, NULL, 0, 4),
(6, 3, 1, 1, 1, 1, '2.3', 6, 'B', 14, 31, NULL, 0, 4),
(6, 3, 1, 1, 1, 1, '2.4', 6, 'B', 6, 32, NULL, 0, 3),
(6, 3, 1, 1, 1, 1, '2.5', 6, 'B', 11, 33, NULL, 0, 4),

-- Section C: Extended (3.1 - 3.5, 50 marks total)
(6, 3, 1, 1, 1, 1, '3.1', 6, 'C', 8, 34, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.2', 6, 'C', 13, 35, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.3', 6, 'C', 5, 36, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.4', 6, 'C', 14, 37, NULL, 0, 5),
(6, 3, 1, 1, 1, 1, '3.5', 6, 'C', 10, 38, NULL, 0, 5);
```

---

## 10. COMPLETE TABLE COUNT & RELATIONSHIPS

### 10.1 Table Summary

| Category | Count | Tables |
|----------|-------|--------|
| **Core Dimension Lookups** | 6 | lookup_years, lookup_grades, lookup_subjects, lookup_papers, lookup_assessment_types, lookup_assessment_bodies |
| **Secondary Dimension Lookups** | 6 | lookup_cognitive_levels, lookup_difficulty_levels, lookup_item_types, lookup_languages, lookup_exam_sessions, lookup_marking_schemes |
| **Curriculum Lookups (CAPS)** | 2 | lookup_caps_topics, lookup_caps_subtopics |
| **Taxonomy Lookups** | 1 | lookup_tag_taxonomy |
| **Master Data (Items)** | 10 | item_master, item_mcq_options, item_memos, item_memo_subparts, item_stimuli, item_attachments, item_tags, item_versions, item_reviews, review_workflow |
| **Paper Assembly** | 4 | paper_templates, paper_template_sections, generated_papers, generated_paper_items |
| **Parser/Comparison** | 3 | parse_sessions, parse_expected_structure, parse_results |
| **User/Admin** | 2 | qbank_users, user_subject_assignments |
| **TOTAL** | **34** | |

### 10.2 Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL REFERENCES                              │
│  nsc_registration_v3.subject_structure  │  nsc_registration_v3.lookup_subjects │
│  (subject_official_code, paper_no)    │  (subject_alpha_code)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CORE DIMENSION LOOKUPS                            │
│  lookup_years ←── lookup_grades ←── lookup_subjects ←── lookup_papers  │
│       │                │                  │                    │         │
│       └────────────────┴──────────────────┴────────────────────┘         │
│                              │                                          │
│  lookup_assessment_types ←── lookup_assessment_bodies                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SECONDARY DIMENSION LOOKUPS                        │
│  lookup_cognitive_levels  lookup_difficulty_levels  lookup_item_types  │
│  lookup_languages         lookup_exam_sessions       lookup_marking_schemes│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CURRICULUM LOOKUPS (CAPS)                         │
│  lookup_caps_topics ←── lookup_caps_subtopics                            │
│       │                                                                │
│       └──────────────────────────────────────────────────────────────┐   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MASTER DATA TABLES                               │
│  item_master (core)                                                     │
│       ├── item_mcq_options                                              │
│       ├── item_memos → item_memo_subparts                               │
│       ├── item_stimuli → item_attachments                               │
│       ├── item_tags (→ lookup_tag_taxonomy)                             │
│       ├── item_versions                                                 │
│       ├── item_reviews (threaded)                                       │
│       └── review_workflow (state machine)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PAPER ASSEMBLY TABLES                             │
│  paper_templates → paper_template_sections                               │
│       │                                                                │
│       └── generated_papers → generated_paper_items                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PARSER & COMPARISON TABLES                          │
│  parse_sessions → parse_expected_structure (gold standard)               │
│       │                                                                │
│       └── parse_results (auto-correct + RED flags)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER & ADMIN TABLES                              │
│  qbank_users → user_subject_assignments                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. KEY DESIGN PRINCIPLES

1. **Every item links to 6 core dimensions:** Year, Grade, Subject, Paper, Assessment Type, Assessment Body
2. **All classification uses lookup tables:** No free-text enums — everything references a lookup table
3. **CAPS curriculum is pre-populated:** Topics and subtopics loaded from official CAPS documents per subject-grade
4. **Taxonomy is controlled:** Tags come from lookup_tag_taxonomy, not free text
5. **Psychometrics are tracked:** exposure_count, facility_value, discrimination_index on item_master
6. **Versioning is built-in:** Every change creates a version record
7. **Audit trail is complete:** parse_sessions, review_workflow, item_versions track everything
8. **Multi-language support:** question_text_afr, option_text_afr for bilingual papers
9. **Shared stimuli supported:** item_stimuli table for case study / data response sets
10. **Sub-part marking:** item_memo_subparts for detailed rubrics on extended questions
11. **Paper assembly with constraints:** Templates enforce topic, difficulty, cognitive level distributions
12. **Parallel paper generation:** Anchor items + randomized items for equivalent forms

---

## 12. MIGRATION 015: paper_code FIX (NOT YET APPLIED)

```sql
-- Migration 015: Add paper_code to parser tables
-- Status: CREATED but NOT APPLIED as of 2026-06-12
-- File: database/migrations/015_fix_paper_code.sql

ALTER TABLE parse_expected_structure ADD COLUMN paper_code VARCHAR(50) AFTER assessment_body_id;
ALTER TABLE parse_results ADD COLUMN paper_code VARCHAR(50) AFTER session_id;

-- Add index for performance
CREATE INDEX idx_paper_code_expected ON parse_expected_structure(paper_code);
CREATE INDEX idx_paper_code_results ON parse_results(paper_code);
```

---

*End of Complete QBank Schema & Seed Data Guide v2.0*
*34 tables total: 15 lookup tables (pre-populated) + 19 transactional tables*
*All items linked by Year, Grade, Subject, Paper, Assessment Type, Assessment Body*
*Life Sciences CAPS Grade 12 data fully extracted and structured*
*Date: 2026-06-12 08:11*

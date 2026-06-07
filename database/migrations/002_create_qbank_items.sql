-- ============================================
-- Migration 002: Create qbank_items
-- Date: 2026-06-05
-- Purpose: Item banking core table
-- References: TOR 2016 Section 3.1.1, Concept v3 Phase 2-3
-- ============================================

USE nsc_registration_v3;

CREATE TABLE IF NOT EXISTS qbank_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Link to subject_structure (FACTUAL FK)
  subject_official_code VARCHAR(20) NOT NULL COMMENT 'From subject_structure',
  paper_no INT NOT NULL COMMENT 'From subject_structure',

  -- Item identification
  item_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Auto-generated: SUBJ-PAPER-YEAR-NNN',
  item_number VARCHAR(20) COMMENT 'e.g., 1.1, 2.3.1',

  -- Content (bilingual)
  question_text LONGTEXT NOT NULL,
  question_text_afr LONGTEXT,
  question_images JSON DEFAULT NULL,

  -- Marks and time
  marks INT NOT NULL,
  estimated_time DECIMAL(4,1) COMMENT 'minutes',

  -- MANDATORY TAGGING (TOR requirement)
  cognitive_level ENUM('Remember','Understand','Apply','Analyse','Evaluate','Create') NOT NULL,
  difficulty_level ENUM('Easy','Medium','Hard') NOT NULL,
  caps_topic VARCHAR(100) NOT NULL,
  caps_subtopic VARCHAR(100),
  item_type ENUM('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') NOT NULL,

  -- Language
  language ENUM('EN','AF','Both') DEFAULT 'EN',

  -- Workflow status (Concept Document)
  status ENUM('Draft','Submitted','Under_Review','Accepted','Provisionally_Accepted','Accepted_with_Corrections','Rejected') DEFAULT 'Draft',

  -- Audit trail
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  reviewed_by INT DEFAULT NULL,
  reviewed_at TIMESTAMP NULL,
  review_comments TEXT,

  -- Psychometrics (after field testing - TOR 3.1.3)
  p_value DECIMAL(4,3) DEFAULT NULL COMMENT 'Proportion correct',
  discrimination_index DECIMAL(4,3) DEFAULT NULL,
  times_used INT DEFAULT 0,
  last_used_year YEAR DEFAULT NULL,

  -- Metadata
  source_reference VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (subject_official_code, paper_no)
    REFERENCES subject_structure(subject_official_code, paper_no),
  INDEX idx_subject_paper (subject_official_code, paper_no),
  INDEX idx_status (status),
  INDEX idx_cognitive (cognitive_level),
  INDEX idx_difficulty (difficulty_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Item bank - core table for question storage';

SELECT 'Migration 002 completed' AS status;

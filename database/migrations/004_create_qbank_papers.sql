-- ============================================
-- Migration 004: Create qbank_papers
-- Date: 2026-06-05
-- Purpose: Assembled exam papers
-- References: Concept v3 Phase 3
-- ============================================

USE nsc_registration_v3;

CREATE TABLE IF NOT EXISTS qbank_papers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subject_official_code VARCHAR(20) NOT NULL,
  paper_no INT NOT NULL,
  year YEAR NOT NULL,
  exam_period ENUM('May/June','Oct/Nov','Supplementary','Trial') NOT NULL DEFAULT 'Oct/Nov',
  paper_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'e.g., AGRM-P1-2026',
  version INT DEFAULT 1,
  total_marks INT NOT NULL,
  duration DECIMAL(3,1) COMMENT 'hours',
  status ENUM('Draft','Under_Moderation','Moderated','Approved','Printed','Archived') DEFAULT 'Draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  moderated_by INT DEFAULT NULL,
  moderated_at TIMESTAMP NULL,
  approved_by INT DEFAULT NULL,
  approved_at TIMESTAMP NULL,
  notes TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_papers_subject
    FOREIGN KEY (subject_official_code, paper_no)
    REFERENCES subject_structure(subject_official_code, paper_no)
    ON DELETE RESTRICT,
  UNIQUE KEY uk_paper_version (subject_official_code, paper_no, year, exam_period, version),
  INDEX idx_subject_year (subject_official_code, paper_no, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Assembled papers from item bank';

SELECT 'Migration 004 completed' AS status;

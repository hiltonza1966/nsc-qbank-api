-- ============================================
-- Migration 001: Create qbank_paper_specs
-- Date: 2026-06-05
-- Purpose: Paper generation specifications
-- ============================================

USE nsc_registration_v3;

CREATE TABLE IF NOT EXISTS qbank_paper_specs (
  subject_official_code VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  paper_no INT NOT NULL,
  cognitive_weighting JSON COMMENT 'Bloom taxonomy: {"Remember":20,"Understand":30,"Apply":30,"Analyse":10,"Evaluate":5,"Create":5}',
  difficulty_weighting JSON COMMENT '{"Easy":30,"Medium":50,"Hard":20}',
  topic_weighting JSON COMMENT 'CAPS topic distribution',
  rubric_template VARCHAR(50) DEFAULT 'Analytic',
  calculator_allowed BOOLEAN DEFAULT FALSE,
  formula_sheet_provided BOOLEAN DEFAULT FALSE,
  sections_config JSON COMMENT '[{"name":"A","compulsory":true,"marks":50}]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subject_official_code, paper_no),
  CONSTRAINT fk_paper_specs_subject
    FOREIGN KEY (subject_official_code, paper_no)
    REFERENCES subject_structure(subject_official_code, paper_no)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Paper generation specs for item banking';

SELECT 'Migration 001 completed' AS status;

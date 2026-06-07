-- ============================================
-- Migration 001: Create qbank_paper_specs
-- Date: 2026-06-05
-- Author: Hilton Visagie
-- Purpose: Store paper generation specifications
-- References: TOR 2016 Section 3.1, Concept v3
-- ============================================

USE nsc_registration_v3;

CREATE TABLE IF NOT EXISTS qbank_paper_specs (
  subject_official_code VARCHAR(20) NOT NULL COMMENT 'FK to subject_structure',
  paper_no INT NOT NULL COMMENT 'FK to subject_structure',
  
  -- Cognitive levels (Bloom's Taxonomy) - Concept Document requirement
  cognitive_weighting JSON DEFAULT NULL COMMENT '{"Remember":20,"Understand":30,"Apply":30,"Analyse":10,"Evaluate":5,"Create":5}',
  
  -- Difficulty distribution - TOR requirement
  difficulty_weighting JSON DEFAULT NULL COMMENT '{"Easy":30,"Medium":50,"Hard":20}',
  
  -- CAPS topic weightings
  topic_weighting JSON DEFAULT NULL COMMENT 'CAPS content distribution',
  
  -- Marking and rubrics
  rubric_template VARCHAR(50) DEFAULT 'DBE_Standard' COMMENT 'Analytic, Holistic, Checklist',
  marking_guideline_template TEXT,
  
  -- Paper construction
  num_sections TINYINT DEFAULT 2,
  sections_config JSON DEFAULT NULL COMMENT '[{"name":"A","type":"compulsory","marks":50}]',
  
  -- QA requirements
  calculator_allowed BOOLEAN DEFAULT FALSE,
  calculator_type VARCHAR(50) DEFAULT NULL,
  formula_sheet_provided BOOLEAN DEFAULT FALSE,
  open_book BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (subject_official_code, paper_no),
  CONSTRAINT fk_paper_specs_structure 
    FOREIGN KEY (subject_official_code, paper_no) 
    REFERENCES subject_structure(subject_official_code, paper_no)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Paper generation specifications for item banking - links to subject_structure';

-- Indexes
CREATE INDEX idx_paper_specs_lookup ON qbank_paper_specs(subject_official_code);

-- Insert sample data for AGRM (from your subject_structure sample)
INSERT INTO qbank_paper_specs (subject_official_code, paper_no, cognitive_weighting, difficulty_weighting) VALUES
('10351024', 1, '{"Remember":25,"Understand":35,"Apply":25,"Analyse":10,"Evaluate":5,"Create":0}', '{"Easy":30,"Medium":50,"Hard":20}'),
('10351024', 2, '{"Remember":20,"Understand":30,"Apply":40,"Analyse":10,"Evaluate":0,"Create":0}', '{"Easy":40,"Medium":40,"Hard":20}'),
('10351024', 3, '{"Remember":30,"Understand":40,"Apply":20,"Analyse":10,"Evaluate":0,"Create":0}', '{"Easy":50,"Medium":40,"Hard":10}')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Verify
SELECT 'Migration 001 completed' AS status;
SELECT COUNT(*) AS specs_created FROM qbank_paper_specs;

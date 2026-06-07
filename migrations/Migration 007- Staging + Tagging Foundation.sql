-- ============================================
-- Migration 007: Staging + Tagging Foundation (MySQL 5.7/8.0 compatible)
-- Date: 2026-06-06
-- ============================================
USE nsc_registration_v3;

-- 1. Create staging as exact clone
DROP TABLE IF EXISTS qbank_items_staging;
CREATE TABLE qbank_items_staging LIKE qbank_items;

-- Make mandatory fields nullable for draft import
ALTER TABLE qbank_items_staging 
  MODIFY item_code VARCHAR(50) NULL,
  MODIFY caps_topic VARCHAR(100) NULL,
  MODIFY item_type ENUM('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') NULL,
  MODIFY cognitive_level ENUM('Remember','Understand','Apply','Analyse','Evaluate','Create') NULL,
  MODIFY difficulty_level ENUM('Easy','Medium','Hard') NULL,
  MODIFY marks INT NULL;

-- Add import tracking
ALTER TABLE qbank_items_staging
  ADD COLUMN staging_batch VARCHAR(50) NULL AFTER id,
  ADD COLUMN imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER staging_batch;

-- 2. Add content hash for deduplication
ALTER TABLE qbank_items ADD COLUMN content_hash CHAR(40) AS (SHA1(TRIM(question_text))) STORED;
ALTER TABLE qbank_items_staging ADD COLUMN content_hash CHAR(40) AS (SHA1(TRIM(question_text))) STORED;

-- Add unique keys
ALTER TABLE qbank_items ADD UNIQUE KEY uq_item (subject_official_code, paper_no, source_year, source_exam_board, source_paper_code, content_hash);
ALTER TABLE qbank_items_staging ADD UNIQUE KEY uq_item (subject_official_code, paper_no, source_year, source_exam_board, source_paper_code, content_hash);

-- 3. Tagging tables (live)
CREATE TABLE IF NOT EXISTS qbank_item_tags (
  item_id BIGINT NOT NULL,
  tag_type ENUM('topic','subtopic','skill','outcome','language','source') NOT NULL,
  tag_value VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, tag_type, tag_value),
  CONSTRAINT fk_tags_item FOREIGN KEY (item_id) REFERENCES qbank_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qbank_item_curriculum (
  item_id BIGINT NOT NULL,
  caps_code VARCHAR(30) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.00,
  PRIMARY KEY (item_id, caps_code),
  CONSTRAINT fk_curr_item FOREIGN KEY (item_id) REFERENCES qbank_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Staging tagging tables (created without FKs)
CREATE TABLE IF NOT EXISTS qbank_items_staging_tags (
  item_id BIGINT NOT NULL,
  tag_type ENUM('topic','subtopic','skill','outcome','language','source') NOT NULL,
  tag_value VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, tag_type, tag_value)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qbank_items_staging_curriculum (
  item_id BIGINT NOT NULL,
  caps_code VARCHAR(30) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.00,
  PRIMARY KEY (item_id, caps_code)
) ENGINE=InnoDB;

SELECT 'Migration 007 completed' AS status;
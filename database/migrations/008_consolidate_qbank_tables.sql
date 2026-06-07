-- ============================================
-- Migration 008: Consolidate QBank Tables into nsc_qbank
-- Date: 2026-06-07
-- Purpose: All QBank tables in nsc_qbank. Only subject_structure remains in nsc_registration_v3.
-- IMPORTANT: No columns are dropped. We only ADD missing columns.
-- ============================================

USE nsc_qbank;
SET @db_name = DATABASE();

-- ============================================
-- Helper procedure to add column if not exists (preserves existing data)
-- ============================================
DELIMITER //

DROP PROCEDURE IF EXISTS SafeAddColumn//

CREATE PROCEDURE SafeAddColumn(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db_name AND table_name = p_table AND column_name = p_column);

  IF @col_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
    SELECT CONCAT('Added column ', p_column, ' to ', p_table) AS message;
  ELSE
    SELECT CONCAT('Column ', p_column, ' already exists in ', p_table) AS message;
  END IF;
END //

DELIMITER ;

-- ============================================
-- 1. Create qbank_items_staging if not exists (with ALL columns)
-- ============================================
CREATE TABLE IF NOT EXISTS qbank_items_staging (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  item_id CHAR(36) DEFAULT NULL,
  subject_official_code VARCHAR(10) DEFAULT NULL,
  paper_no TINYINT DEFAULT NULL,
  question_text TEXT DEFAULT NULL,
  marks SMALLINT DEFAULT NULL,
  topic VARCHAR(100) DEFAULT NULL,
  cognitive_level VARCHAR(50) DEFAULT NULL,
  difficulty ENUM('Easy','Medium','Hard') DEFAULT NULL,
  source_year SMALLINT DEFAULT NULL,
  source_exam_board VARCHAR(20) DEFAULT NULL,
  source_paper_code VARCHAR(20) DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'Draft',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Staging-specific fields (all essential, none dropped)
  item_code VARCHAR(50) DEFAULT NULL,
  caps_topic VARCHAR(100) DEFAULT NULL,
  item_type ENUM('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') DEFAULT NULL,
  difficulty_level ENUM('Easy','Medium','Hard') DEFAULT NULL,
  caps_subtopic VARCHAR(100) DEFAULT NULL,
  source_reference VARCHAR(200) DEFAULT NULL,
  staging_batch VARCHAR(50) DEFAULT NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  content_hash CHAR(40) AS (SHA1(TRIM(question_text))) STORED,
  UNIQUE KEY uq_staging_item (subject_official_code, paper_no, source_year, source_exam_board, source_paper_code, content_hash)
) ENGINE=InnoDB;

SELECT 'qbank_items_staging ready' AS message;

-- ============================================
-- 2. Add missing columns to existing qbank_items_staging (if it was created before)
-- ============================================
CALL SafeAddColumn('qbank_items_staging', 'item_code', "VARCHAR(50) DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'caps_topic', "VARCHAR(100) DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'item_type', "ENUM('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'difficulty_level', "ENUM('Easy','Medium','Hard') DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'caps_subtopic', "VARCHAR(100) DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'source_reference', "VARCHAR(200) DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'staging_batch', "VARCHAR(50) DEFAULT NULL");
CALL SafeAddColumn('qbank_items_staging', 'imported_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
CALL SafeAddColumn('qbank_items_staging', 'content_hash', "CHAR(40) AS (SHA1(TRIM(question_text))) STORED");

-- ============================================
-- 3. Create tagging tables (live) in nsc_qbank - only if not exist
-- ============================================
CREATE TABLE IF NOT EXISTS qbank_item_tags (
  item_id CHAR(36) NOT NULL,
  tag_type ENUM('topic','subtopic','skill','outcome','language','source') NOT NULL,
  tag_value VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id, tag_type, tag_value),
  CONSTRAINT fk_tags_item FOREIGN KEY (item_id) REFERENCES qbank_items(item_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qbank_item_curriculum (
  item_id CHAR(36) NOT NULL,
  caps_code VARCHAR(30) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.00,
  PRIMARY KEY (item_id, caps_code),
  CONSTRAINT fk_curr_item FOREIGN KEY (item_id) REFERENCES qbank_items(item_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 4. Create staging tagging tables in nsc_qbank - only if not exist
-- ============================================
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

-- ============================================
-- 5. Ensure qbank_items has all essential columns (no drops, only adds)
-- ============================================
CALL SafeAddColumn('qbank_items', 'item_code', "VARCHAR(50) DEFAULT NULL");
CALL SafeAddColumn('qbank_items', 'caps_topic', "VARCHAR(100) DEFAULT NULL");
CALL SafeAddColumn('qbank_items', 'item_type', "ENUM('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') DEFAULT NULL");
CALL SafeAddColumn('qbank_items', 'difficulty_level', "ENUM('Easy','Medium','Hard') DEFAULT NULL");
CALL SafeAddColumn('qbank_items', 'caps_subtopic', "VARCHAR(100) DEFAULT NULL");
CALL SafeAddColumn('qbank_items', 'source_reference', "VARCHAR(200) DEFAULT NULL");
CALL SafeAddColumn('qbank_items', 'updated_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

-- Cleanup
DROP PROCEDURE IF EXISTS SafeAddColumn;

-- NOTE: subject_structure remains in nsc_registration_v3 - cross-reference only when needed

SELECT 'Migration 008 completed: All QBank tables consolidated into nsc_qbank (no columns dropped)' AS status;

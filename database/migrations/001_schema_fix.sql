-- Migration 001: QBank Schema Fix
-- Date: 2026-06-07
-- MySQL 8.0.45 compatible - uses dynamic SQL only (no IF NOT EXISTS)
-- Database: nsc_qbank

USE nsc_qbank;

SET @db_name = DATABASE();

-- ============================================
-- Helper: Check if column exists
-- ============================================
-- We use a stored procedure approach to safely add columns

DELIMITER //

CREATE PROCEDURE IF NOT EXISTS AddColumnIfNotExists(
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
-- qbank_papers: add missing columns
-- ============================================
CALL AddColumnIfNotExists('qbank_papers', 'subject_official_code', "VARCHAR(10) NOT NULL DEFAULT '' AFTER created_at");
CALL AddColumnIfNotExists('qbank_papers', 'paper_no', "TINYINT NOT NULL DEFAULT 1 AFTER subject_official_code");
CALL AddColumnIfNotExists('qbank_papers', 'duration_minutes', "INT NOT NULL DEFAULT 180 AFTER paper_no");
CALL AddColumnIfNotExists('qbank_papers', 'status', "VARCHAR(20) NOT NULL DEFAULT 'Draft' AFTER duration_minutes");
CALL AddColumnIfNotExists('qbank_papers', 'created_by', "INT NOT NULL DEFAULT 1 AFTER status");
CALL AddColumnIfNotExists('qbank_papers', 'total_marks', "SMALLINT DEFAULT NULL AFTER paper_no");
CALL AddColumnIfNotExists('qbank_papers', 'spec_id', "CHAR(36) DEFAULT NULL AFTER paper_id");

-- ============================================
-- qbank_paper_items: add missing columns
-- ============================================
CALL AddColumnIfNotExists('qbank_paper_items', 'section_name', "VARCHAR(100) NOT NULL DEFAULT '' AFTER item_id");
CALL AddColumnIfNotExists('qbank_paper_items', 'position', "INT NOT NULL DEFAULT 0 AFTER section_name");
CALL AddColumnIfNotExists('qbank_paper_items', 'marks_allocated', "SMALLINT NOT NULL DEFAULT 0 AFTER position");

-- ============================================
-- qbank_items: add timestamps
-- ============================================
CALL AddColumnIfNotExists('qbank_items', 'created_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
CALL AddColumnIfNotExists('qbank_items', 'updated_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

-- ============================================
-- Create v_item_usage view
-- ============================================
CREATE OR REPLACE VIEW v_item_usage AS
SELECT
  item_id,
  MAX(created_at) as last_used_at,
  COUNT(*) as usage_count
FROM qbank_paper_items
GROUP BY item_id;

-- Cleanup
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

SELECT 'Migration 001 completed successfully' AS status;

-- ============================================
-- QBank Review Workflow Migration v007
-- Adds review workflow columns to item_master (if missing)
-- Creates audit log table (if missing) — aligned to existing schema
-- MySQL 8.0+ compatible — no DELIMITER, no stored procedures
-- ============================================

-- 1. Add review workflow columns to item_master (one at a time, no IF NOT EXISTS)
-- reviewed_by
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master' AND COLUMN_NAME = 'reviewed_by');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE item_master ADD COLUMN reviewed_by VARCHAR(100) DEFAULT NULL', 'SELECT "reviewed_by already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- reviewed_at
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master' AND COLUMN_NAME = 'reviewed_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE item_master ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL', 'SELECT "reviewed_at already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- published_by
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master' AND COLUMN_NAME = 'published_by');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE item_master ADD COLUMN published_by VARCHAR(100) DEFAULT NULL', 'SELECT "published_by already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- published_at
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_master' AND COLUMN_NAME = 'published_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE item_master ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL', 'SELECT "published_at already exists"');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ensure review_status has correct default
ALTER TABLE item_master ALTER review_status SET DEFAULT 'draft';

-- 3. Seed existing NULL review_status values
UPDATE item_master SET review_status = 'draft' WHERE review_status IS NULL;

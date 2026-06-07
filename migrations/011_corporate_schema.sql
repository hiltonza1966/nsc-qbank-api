-- Migration 011: Corporate Schema - Attachments & Item Type
-- Date: 7 June 2026
-- Purpose: Add image attachment support and item_type to staging

-- Add item_type to qbank_items_staging if not exists
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'qbank_items_staging' AND column_name = 'item_type');

SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE qbank_items_staging ADD COLUMN item_type ENUM("MCQ","Short","Medium","Extended","Source-based","Practical","Essay") DEFAULT "Extended"',
  'SELECT "item_type column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create qbank_item_attachments table
CREATE TABLE IF NOT EXISTS qbank_item_attachments (
  attachment_id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NULL,
  staging_item_id CHAR(36) NULL,
  attachment_type ENUM('image','diagram','audio','video','document') DEFAULT 'image',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50),
  file_size INT,
  caption VARCHAR(255),
  page_number INT,
  coordinates JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item (item_id),
  INDEX idx_staging (staging_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add review_status to qbank_items_staging if not exists
SET @col_exists2 = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'qbank_items_staging' AND column_name = 'review_status');

SET @sql2 = IF(@col_exists2 = 0, 
  'ALTER TABLE qbank_items_staging ADD COLUMN review_status VARCHAR(20) DEFAULT "Draft"',
  'SELECT "review_status column already exists" AS message');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Add review_comments to qbank_items_staging if not exists
SET @col_exists3 = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'qbank_items_staging' AND column_name = 'review_comments');

SET @sql3 = IF(@col_exists3 = 0, 
  'ALTER TABLE qbank_items_staging ADD COLUMN review_comments TEXT',
  'SELECT "review_comments column already exists" AS message');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- Add live_item_id to qbank_item_memos if not exists
SET @col_exists4 = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'qbank_item_memos' AND column_name = 'live_item_id');

SET @sql4 = IF(@col_exists4 = 0, 
  'ALTER TABLE qbank_item_memos ADD COLUMN live_item_id CHAR(36) NULL',
  'SELECT "live_item_id column already exists" AS message');
PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

-- Add version_number to qbank_item_memos if not exists
SET @col_exists5 = (SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = DATABASE() AND table_name = 'qbank_item_memos' AND column_name = 'version_number');

SET @sql5 = IF(@col_exists5 = 0, 
  'ALTER TABLE qbank_item_memos ADD COLUMN version_number INT DEFAULT 1',
  'SELECT "version_number column already exists" AS message');
PREPARE stmt5 FROM @sql5;
EXECUTE stmt5;
DEALLOCATE PREPARE stmt5;

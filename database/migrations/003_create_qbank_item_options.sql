-- ============================================
-- Migration 003: Create qbank_item_options
-- Date: 2026-06-05
-- Purpose: MCQ options storage
-- References: TOR 2016 Section 3.1.1
-- ============================================

USE nsc_registration_v3;

CREATE TABLE IF NOT EXISTS qbank_item_options (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT NOT NULL COMMENT 'FK to qbank_items.id',
  option_label VARCHAR(5) NOT NULL COMMENT 'A, B, C, D',
  option_text LONGTEXT NOT NULL,
  option_text_afr LONGTEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  option_order INT DEFAULT 1,
  explanation TEXT COMMENT 'Why this is correct/incorrect',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_options_item
    FOREIGN KEY (item_id)
    REFERENCES qbank_items(id)
    ON DELETE CASCADE,
  UNIQUE KEY uk_item_option (item_id, option_label),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='MCQ options for item bank';

SELECT 'Migration 003 completed' AS status;

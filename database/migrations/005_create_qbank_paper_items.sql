-- ============================================
-- Migration 005: Create qbank_paper_items
-- Date: 2026-06-05
-- Purpose: Link items to papers with sequencing
-- References: Concept v3 Phase 3
-- ============================================

USE nsc_registration_v3;

CREATE TABLE IF NOT EXISTS qbank_paper_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  paper_id BIGINT NOT NULL,
  item_id BIGINT NOT NULL,
  sequence_no INT NOT NULL COMMENT 'Order in paper',
  section_name VARCHAR(10) COMMENT 'A, B, C',
  marks_allocated INT COMMENT 'Override if different from item',
  page_number INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_paperitems_paper
    FOREIGN KEY (paper_id)
    REFERENCES qbank_papers(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_paperitems_item
    FOREIGN KEY (item_id)
    REFERENCES qbank_items(id)
    ON DELETE RESTRICT,
  UNIQUE KEY uk_paper_sequence (paper_id, sequence_no),
  UNIQUE KEY uk_paper_item (paper_id, item_id),
  INDEX idx_paper_id (paper_id),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Mapping of items to assembled papers';

SELECT 'Migration 005 completed' AS status;

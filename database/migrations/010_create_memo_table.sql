USE nsc_qbank;

-- Create memo table for marking guidelines
CREATE TABLE IF NOT EXISTS qbank_item_memos (
  memo_id CHAR(36) NOT NULL PRIMARY KEY,
  question_number VARCHAR(20) NOT NULL,
  answer_text TEXT,
  marks SMALLINT,
  source_year SMALLINT,
  source_exam_board VARCHAR(20),
  source_paper_code VARCHAR(20),
  subject_official_code VARCHAR(10),
  paper_no TINYINT,
  status VARCHAR(20) DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_memo_natural (
    subject_official_code, paper_no, source_year, 
    source_exam_board, source_paper_code, question_number
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add question_number to qbank_items_staging if not exists
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_schema = 'nsc_qbank' 
  AND table_name = 'qbank_items_staging' 
  AND column_name = 'question_number'
);

SET @sql = IF(@col_exists = 0, 
  'ALTER TABLE nsc_qbank.qbank_items_staging ADD COLUMN question_number VARCHAR(20) NULL AFTER item_code',
  'SELECT "Column already exists" as msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

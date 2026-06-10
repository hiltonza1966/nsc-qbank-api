-- Migration: Add is_memo flag to track memo uploads
-- Date: 2026-06-10
-- MySQL 8.0.45 compatible

-- Add is_memo to parse_sessions
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'parse_sessions'
     AND table_schema = DATABASE()
     AND column_name = 'is_memo') > 0,
    'SELECT 1',
    'ALTER TABLE parse_sessions ADD COLUMN is_memo TINYINT(1) DEFAULT 0'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_memo to parse_results
SET @s2 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_name = 'parse_results'
     AND table_schema = DATABASE()
     AND column_name = 'is_memo') > 0,
    'SELECT 1',
    'ALTER TABLE parse_results ADD COLUMN is_memo TINYINT(1) DEFAULT 0'
));
PREPARE stmt2 FROM @s2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Add index for efficient memo queries
DROP INDEX IF EXISTS idx_is_memo ON parse_sessions;
CREATE INDEX idx_is_memo ON parse_sessions(is_memo);

-- Update existing sessions that are memos (based on file_name)
UPDATE parse_sessions 
SET is_memo = 1 
WHERE file_name LIKE '%MG%' 
   OR file_name LIKE '%memo%' 
   OR file_name LIKE '%Marking%' 
   OR file_name LIKE '%memo%';

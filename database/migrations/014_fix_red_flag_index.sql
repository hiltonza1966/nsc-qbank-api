-- Migration 014: Fix QB_parsed_results schema
-- Remove invalid idx_red_flag index that references non-existent column
-- is_red_flag is calculated in application code, not stored in DB
-- Date: 2026-06-08

-- Drop the invalid index if it exists
DROP INDEX IF EXISTS idx_red_flag ON QB_parsed_results;

-- Verify
SHOW INDEX FROM QB_parsed_results;

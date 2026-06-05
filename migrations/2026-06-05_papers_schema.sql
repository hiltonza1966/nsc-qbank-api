-- 2026-06-05: papers.js schema alignment
-- Run this against nsc_qbank database
ALTER TABLE qbank_papers 
ADD COLUMN subject_official_code VARCHAR(10) NOT NULL DEFAULT '' AFTER created_at,
ADD COLUMN paper_no TINYINT NOT NULL DEFAULT 1 AFTER subject_official_code,
ADD COLUMN duration_minutes INT NOT NULL DEFAULT 180 AFTER paper_no,
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Draft' AFTER duration_minutes,
ADD COLUMN created_by INT NOT NULL DEFAULT 1 AFTER status;

ALTER TABLE qbank_paper_items 
ADD COLUMN section_name VARCHAR(100) NOT NULL DEFAULT '' AFTER item_id,
ADD COLUMN position INT NOT NULL DEFAULT 0 AFTER section_name,
ADD COLUMN marks_allocated SMALLINT NOT NULL DEFAULT 0 AFTER position;

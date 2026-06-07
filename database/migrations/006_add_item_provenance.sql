USE nsc_registration_v3;

ALTER TABLE qbank_items
  ADD COLUMN source_year YEAR NULL AFTER source_reference,
  ADD COLUMN source_exam_board VARCHAR(20) NULL,
  ADD COLUMN source_paper_code VARCHAR(20) NULL,
  ADD INDEX idx_source_year (source_year);
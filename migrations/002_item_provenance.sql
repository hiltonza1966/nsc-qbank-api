-- 2026-06-06: add provenance and usage view
ALTER TABLE qbank_items
  ADD COLUMN source_year SMALLINT NULL AFTER difficulty,
  ADD COLUMN source_exam_board VARCHAR(20) NULL AFTER source_year,
  ADD COLUMN source_paper_code VARCHAR(20) NULL AFTER source_exam_board;

CREATE OR REPLACE VIEW v_item_usage AS
SELECT pi.item_id, MAX(p.created_at) AS last_used_at
FROM qbank_paper_items pi
JOIN qbank_papers p ON pi.paper_id = p.paper_id
GROUP BY pi.item_id;

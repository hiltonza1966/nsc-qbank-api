-- 2026-06-06: seed specs for MATH P2, PHYS P1, PHYS P2
-- IMPORTANT: Fill in actual sections_config JSON before running
-- Example: '[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]'

-- Replace the '[]' below with real config
INSERT INTO qbank_paper_specs (subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES ('MATH', 2, 150, 180, '[]')
ON DUPLICATE KEY UPDATE sections_config=VALUES(sections_config);

INSERT INTO qbank_paper_specs (subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES ('PHYS', 1, 150, 180, '[]')
ON DUPLICATE KEY UPDATE sections_config=VALUES(sections_config);

INSERT INTO qbank_paper_specs (subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES ('PHYS', 2, 150, 180, '[]')
ON DUPLICATE KEY UPDATE sections_config=VALUES(sections_config);

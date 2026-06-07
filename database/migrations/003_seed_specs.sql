-- 2026-06-06: Seed specs for MATH P2, PHYS P1, PHYS P2
-- MySQL compatible - generates spec_id with UUID()

-- MATH Paper 2 (P2) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'MATH', 2, 150, 180, '[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

-- PHYS Paper 1 (P1) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'PHYS', 1, 150, 180, '[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

-- PHYS Paper 2 (P2) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'PHYS', 2, 150, 180, '[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

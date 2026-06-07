-- 2026-06-07: Seed specs for ALL papers (MATH P1/P2, PHYS P1/P2)
-- MySQL compatible - generates spec_id with UUID()

-- MATH Paper 1 (P1) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'MATH', 1, 150, 180, '[{"name":"Algebra","marks":50},{"name":"Calculus","marks":50},{"name":"Geometry","marks":50}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

-- MATH Paper 2 (P2) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'MATH', 2, 150, 180, '[{"name":"Statistics","marks":75},{"name":"Probability","marks":75}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

-- PHYS Paper 1 (P1) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'PHYS', 1, 150, 180, '[{"name":"Mechanics","marks":75},{"name":"Waves","marks":75}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

-- PHYS Paper 2 (P2) - Grade 12
INSERT INTO qbank_paper_specs (spec_id, subject_official_code, paper_no, total_marks, duration_minutes, sections_config)
VALUES (UUID(), 'PHYS', 2, 150, 180, '[{"name":"Electricity","marks":75},{"name":"Modern Physics","marks":75}]')
ON DUPLICATE KEY UPDATE
  total_marks = VALUES(total_marks),
  duration_minutes = VALUES(duration_minutes),
  sections_config = VALUES(sections_config);

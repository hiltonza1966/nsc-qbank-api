-- ============================================
-- CLEAR TABLES AND INSERT 63 ATOMIC ITEMS
-- Paper: LIFE_SC_P1_NOV_2025
-- Generated: 2026-06-08
-- Definition: Item = atomic, independently scorable unit
-- ============================================

-- Step 1: Clear all existing data for this paper
DELETE FROM QB_questionP_Structure WHERE paper_code = 'LIFE_SC_P1_NOV_2025';
DELETE FROM qbank_items WHERE paper_code = 'LIFE_SC_P1_NOV_2025';
DELETE FROM QB_parse_sessions WHERE paper_code = 'LIFE_SC_P1_NOV_2025';
DELETE FROM QB_parse_results WHERE session_id IN (
    SELECT id FROM QB_parse_sessions WHERE paper_code = 'LIFE_SC_P1_NOV_2025'
);

-- Step 2: Insert 63 atomic items from QP PDF (with Memo mark corrections)
-- SECTION A: 28 items, 50 marks

-- 1.1 MCQ: 10 items × 2 marks = 20 marks
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '1.1.1', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.2', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.3', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.4', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.5', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.6', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.7', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.8', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.9', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.1.10', '1.1', 'A', 'MCQ', 2, 2, 'QP', 'Auto');

-- 1.2 Short: 8 items × 1 mark = 8 marks
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '1.2.1', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.2', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.3', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.4', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.5', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.6', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.7', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.2.8', '1.2', 'A', 'Short', 1, 1, 'QP', 'Auto');

-- 1.3 Matching: 3 items × 2 marks = 6 marks
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '1.3.1', '1.3', 'A', 'Matching', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.3.2', '1.3', 'A', 'Matching', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.3.3', '1.3', 'A', 'Matching', 2, 2, 'QP', 'Auto');

-- 1.4 Diagram: 3 items = 8 marks (4+2+2)
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '1.4.1', '1.4', 'A', 'Diagram', 4, 4, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.4.2', '1.4', 'A', 'Diagram', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.4.3', '1.4', 'A', 'Diagram', 2, 2, 'QP', 'Auto');

-- 1.5 Diagram: 4 items = 8 marks (1+3+3+1)
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '1.5.1', '1.5', 'A', 'Diagram', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.5.2', '1.5', 'A', 'Diagram', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.5.3', '1.5', 'A', 'Diagram', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '1.5.4', '1.5', 'A', 'Diagram', 1, 1, 'QP', 'Auto');

-- SECTION B - QUESTION 2: 18 items, 50 marks
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '2.1.1', '2.1', 'B', 'Extended', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.1.2', '2.1', 'B', 'Extended', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.1.3', '2.1', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.2.1', '2.2', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.2.2', '2.2', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.2.3', '2.2', 'B', 'Extended', 5, 5, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.2.4', '2.2', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.3.1', '2.3', 'B', 'Extended', 5, 5, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.3.2', '2.3', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.3.3', '2.3', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.3.4', '2.3', 'B', 'Extended', 6, 6, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.4.1', '2.4', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.4.2', '2.4', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.4.3', '2.4', 'B', 'Extended', 4, 4, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.5.1', '2.5', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.5.2', '2.5', 'B', 'Extended', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.5.3', '2.5', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.5.4', '2.5', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '2.5.5', '2.5', 'B', 'Extended', 3, 3, 'QP', 'Auto');

-- SECTION B - QUESTION 3: 17 items, 50 marks
-- NOTE: 3.3 was missing from PDF extraction but confirmed by Memo
INSERT INTO QB_questionP_Structure (paper_code, question_number, parent_question, section, question_type, marks, expected_marks, source, status) VALUES 
('LIFE_SC_P1_NOV_2025', '3.1.1', '3.1', 'B', 'Extended', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.1.2', '3.1', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.1.3', '3.1', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.1.4', '3.1', 'B', 'Extended', 3, 3, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.2.1', '3.2', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.2.2', '3.2', 'B', 'Extended', 6, 6, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.2.3', '3.2', 'B', 'Extended', 6, 6, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.3', NULL, 'B', 'Extended', 5, 5, 'Memo', 'Auto'),  -- From Memo (missing in PDF extraction)
('LIFE_SC_P1_NOV_2025', '3.4.1', '3.4', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.4.2', '3.4', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.4.3', '3.4', 'B', 'Extended', 5, 5, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.4.4', '3.4', 'B', 'Extended', 5, 5, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.5.1', '3.5', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.5.2', '3.5', 'B', 'Extended', 1, 1, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.5.3', '3.5', 'B', 'Extended', 5, 5, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.5.4', '3.5', 'B', 'Extended', 2, 2, 'QP', 'Auto'),
('LIFE_SC_P1_NOV_2025', '3.5.5', '3.5', 'B', 'Extended', 1, 1, 'QP', 'Auto');

-- Step 3: Verify totals
SELECT 
    section,
    COUNT(*) as items,
    SUM(marks) as marks,
    SUM(expected_marks) as expected_marks
FROM QB_questionP_Structure 
WHERE paper_code = 'LIFE_SC_P1_NOV_2025'
GROUP BY section;

-- Grand total
SELECT 
    COUNT(*) as total_items,
    SUM(marks) as total_marks,
    SUM(expected_marks) as total_expected
FROM QB_questionP_Structure 
WHERE paper_code = 'LIFE_SC_P1_NOV_2025';

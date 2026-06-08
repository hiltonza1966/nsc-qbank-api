-- ============================================
-- CLEAR AND INSERT ITEMS - NO LIMITS
-- Handles any number of items from parser
-- ============================================

-- Clear existing data for this paper only
DELETE FROM QB_questionP_Structure WHERE paper_code = 'LIFE_SC_P1_NOV_2025';

-- ============================================
-- SECTION A: 28 atomic items
-- ============================================
INSERT INTO QB_questionP_Structure (paper_code, subject_name, paper_no, exam_year, exam_session, question_number, question_type, section, expected_marks, sequence, parent_question, is_sub_part) VALUES 
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.1', 'MCQ', 'A', 2, 1, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.2', 'MCQ', 'A', 2, 2, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.3', 'MCQ', 'A', 2, 3, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.4', 'MCQ', 'A', 2, 4, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.5', 'MCQ', 'A', 2, 5, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.6', 'MCQ', 'A', 2, 6, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.7', 'MCQ', 'A', 2, 7, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.8', 'MCQ', 'A', 2, 8, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.9', 'MCQ', 'A', 2, 9, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.1.10', 'MCQ', 'A', 2, 10, '1.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.1', 'Short', 'A', 1, 11, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.2', 'Short', 'A', 1, 12, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.3', 'Short', 'A', 1, 13, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.4', 'Short', 'A', 1, 14, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.5', 'Short', 'A', 1, 15, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.6', 'Short', 'A', 1, 16, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.7', 'Short', 'A', 1, 17, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.2.8', 'Short', 'A', 1, 18, '1.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.3.1', 'Matching', 'A', 2, 19, '1.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.3.2', 'Matching', 'A', 2, 20, '1.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.3.3', 'Matching', 'A', 2, 21, '1.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.4.1', 'Diagram', 'A', 4, 22, '1.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.4.2', 'Diagram', 'A', 2, 23, '1.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.4.3', 'Diagram', 'A', 2, 24, '1.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.5.1', 'Diagram', 'A', 1, 25, '1.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.5.2', 'Diagram', 'A', 3, 26, '1.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.5.3', 'Diagram', 'A', 3, 27, '1.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '1.5.4', 'Diagram', 'A', 1, 28, '1.5', 1);

-- ============================================
-- QUESTION 2: 18 atomic items
-- ============================================
INSERT INTO QB_questionP_Structure (paper_code, subject_name, paper_no, exam_year, exam_session, question_number, question_type, section, expected_marks, sequence, parent_question, is_sub_part) VALUES 
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.1.1', 'Extended', 'B', 3, 29, '2.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.1.2', 'Extended', 'B', 3, 30, '2.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.1.3', 'Extended', 'B', 2, 31, '2.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.2.1', 'Extended', 'B', 2, 32, '2.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.2.2', 'Extended', 'B', 2, 33, '2.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.2.3', 'Extended', 'B', 5, 34, '2.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.2.4', 'Extended', 'B', 2, 35, '2.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.3.1', 'Extended', 'B', 5, 36, '2.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.3.2', 'Extended', 'B', 2, 37, '2.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.3.3', 'Extended', 'B', 1, 38, '2.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.3.4', 'Extended', 'B', 6, 39, '2.3', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.4.1', 'Extended', 'B', 1, 40, '2.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.4.2', 'Extended', 'B', 1, 41, '2.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.4.3', 'Extended', 'B', 4, 42, '2.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.5.1', 'Extended', 'B', 1, 43, '2.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.5.2', 'Extended', 'B', 3, 44, '2.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.5.3', 'Extended', 'B', 2, 45, '2.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.5.4', 'Extended', 'B', 2, 46, '2.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '2.5.5', 'Extended', 'B', 3, 47, '2.5', 1);

-- ============================================
-- QUESTION 3: 17 atomic items (including 3.3 from Memo)
-- ============================================
INSERT INTO QB_questionP_Structure (paper_code, subject_name, paper_no, exam_year, exam_session, question_number, question_type, section, expected_marks, sequence, parent_question, is_sub_part) VALUES 
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.1.1', 'Extended', 'C', 3, 48, '3.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.1.2', 'Extended', 'C', 1, 49, '3.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.1.3', 'Extended', 'C', 1, 50, '3.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.1.4', 'Extended', 'C', 3, 51, '3.1', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.2.1', 'Extended', 'C', 1, 52, '3.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.2.2', 'Extended', 'C', 6, 53, '3.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.2.3', 'Extended', 'C', 6, 54, '3.2', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.3', 'Extended', 'C', 5, 55, NULL, 0),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.4.1', 'Extended', 'C', 2, 56, '3.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.4.2', 'Extended', 'C', 2, 57, '3.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.4.3', 'Extended', 'C', 5, 58, '3.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.4.4', 'Extended', 'C', 5, 59, '3.4', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.5.1', 'Extended', 'C', 1, 60, '3.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.5.2', 'Extended', 'C', 1, 61, '3.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.5.3', 'Extended', 'C', 5, 62, '3.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.5.4', 'Extended', 'C', 2, 63, '3.5', 1),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'November', '3.5.5', 'Extended', 'C', 1, 64, '3.5', 1);

-- ============================================
-- VERIFY TOTALS
-- ============================================
SELECT 
    section,
    COUNT(*) as items,
    SUM(expected_marks) as marks
FROM QB_questionP_Structure 
WHERE paper_code = 'LIFE_SC_P1_NOV_2025'
GROUP BY section;

-- Grand total
SELECT 
    COUNT(*) as total_items,
    SUM(expected_marks) as total_marks
FROM QB_questionP_Structure 
WHERE paper_code = 'LIFE_SC_P1_NOV_2025';

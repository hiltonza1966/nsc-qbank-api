-- Migration 012: QP Structure Tables for Comparison-Based Validation
-- Database: nsc_qbank
-- Date: 2026-06-08

-- ============================================================
-- Table: QB_questionP_Structure
-- Stores expected question structure for each paper
-- Used as the GOLD STANDARD for parser validation
-- ============================================================
CREATE TABLE IF NOT EXISTS QB_questionP_Structure (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_code VARCHAR(50) NOT NULL COMMENT 'e.g., LIFE_SC_P1_NOV_2025',
    subject_name VARCHAR(100) NOT NULL,
    paper_no VARCHAR(10) NOT NULL COMMENT 'P1, P2, etc.',
    exam_year INT NOT NULL,
    exam_session VARCHAR(20) NOT NULL COMMENT 'Nov, June, etc.',
    question_number VARCHAR(20) NOT NULL COMMENT 'e.g., 1.1.1, 2.1, 3.2.3',
    question_type ENUM('MCQ','Short','Matching','Diagram','Extended') NOT NULL,
    section VARCHAR(20) NOT NULL COMMENT 'A, B, C',
    expected_marks INT NOT NULL,
    sequence INT NOT NULL COMMENT 'Order within paper (1-38)',
    parent_question VARCHAR(20) DEFAULT NULL COMMENT 'e.g., 2.1 for sub-part 2.1.1',
    is_sub_part BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_paper_question (paper_code, question_number),
    INDEX idx_paper_code (paper_code),
    INDEX idx_section (section),
    INDEX idx_question_type (question_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Gold standard QP structure for parser validation';

-- ============================================================
-- Table: QB_parsed_results
-- Stores parser output with auto-correction tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS QB_parsed_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id INT NOT NULL COMMENT 'FK to qbank_papers or staging ID',
    parse_session_id VARCHAR(64) NOT NULL COMMENT 'UUID for this parse run',
    paper_code VARCHAR(50) NOT NULL,
    question_number VARCHAR(20) NOT NULL,
    question_text TEXT,
    parsed_type VARCHAR(20),
    parsed_section VARCHAR(20),
    parser_extracted_marks INT DEFAULT NULL COMMENT 'Raw marks from parser',
    expected_marks INT NOT NULL COMMENT 'From QB_questionP_Structure',
    auto_corrected_marks INT DEFAULT NULL COMMENT 'Marks after auto-correction',
    correction_status ENUM('auto_corrected','manual_review','validated','parser_missing') 
        DEFAULT 'auto_corrected',
    -- variance and is_red_flag calculated in application code
    -- not as DB generated columns for MySQL 5.6 compatibility
    user_corrected_marks INT DEFAULT NULL COMMENT 'Manual override by reviewer',
    reviewer_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_parse_question (parse_session_id, question_number),
    INDEX idx_paper_id (paper_id),
    INDEX idx_parse_session (parse_session_id),
    INDEX idx_red_flag (is_red_flag),
    INDEX idx_correction_status (correction_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Parser results with auto-correction audit trail';

-- ============================================================
-- Table: QB_parse_sessions
-- Tracks each parse run for audit purposes
-- ============================================================
CREATE TABLE IF NOT EXISTS QB_parse_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    paper_code VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 of uploaded file',
    parser_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    total_items_found INT DEFAULT NULL,
    total_marks_parser INT DEFAULT NULL,
    total_marks_expected INT DEFAULT NULL,
    total_marks_corrected INT DEFAULT NULL,
    auto_corrected_count INT DEFAULT 0,
    manual_review_count INT DEFAULT 0,
    missing_count INT DEFAULT 0,
    status ENUM('parsing','comparing','auto_corrected','reviewing','completed','failed') 
        DEFAULT 'parsing',
    error_message TEXT,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_paper_code (paper_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail for each parse and comparison session';

-- ============================================================
-- Insert Life Sciences P1 Nov 2025 Structure (38 items, 150 marks)
-- ============================================================
INSERT INTO QB_questionP_Structure 
(paper_code, subject_name, paper_no, exam_year, exam_session, question_number, question_type, section, expected_marks, sequence, parent_question, is_sub_part) 
VALUES
-- Section A: 28 items, 50 marks
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.1', 'MCQ', 'A', 2, 1, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.2', 'MCQ', 'A', 2, 2, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.3', 'MCQ', 'A', 2, 3, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.4', 'MCQ', 'A', 2, 4, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.5', 'MCQ', 'A', 2, 5, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.6', 'MCQ', 'A', 2, 6, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.7', 'MCQ', 'A', 2, 7, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.8', 'MCQ', 'A', 2, 8, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.9', 'MCQ', 'A', 2, 9, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.1.10', 'MCQ', 'A', 2, 10, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.1', 'Short', 'A', 1, 11, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.2', 'Short', 'A', 1, 12, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.3', 'Short', 'A', 1, 13, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.4', 'Short', 'A', 1, 14, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.5', 'Short', 'A', 1, 15, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.6', 'Short', 'A', 1, 16, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.7', 'Short', 'A', 1, 17, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.2.8', 'Short', 'A', 1, 18, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.3.1', 'Matching', 'A', 2, 19, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.3.2', 'Matching', 'A', 2, 20, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.3.3', 'Matching', 'A', 2, 21, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.4.1', 'Diagram', 'A', 3, 22, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.4.2', 'Diagram', 'A', 3, 23, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.4.3', 'Diagram', 'A', 2, 24, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.5.1', 'Diagram', 'A', 2, 25, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.5.2', 'Diagram', 'A', 2, 26, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.5.3', 'Diagram', 'A', 2, 27, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '1.5.4', 'Diagram', 'A', 2, 28, NULL, FALSE),

-- Section B: 10 items, 100 marks
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '2.1', 'Extended', 'B', 8, 29, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '2.2', 'Extended', 'B', 11, 30, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '2.3', 'Extended', 'B', 14, 31, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '2.4', 'Extended', 'B', 6, 32, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '2.5', 'Extended', 'B', 11, 33, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '3.1', 'Extended', 'B', 8, 34, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '3.2', 'Extended', 'B', 13, 35, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '3.3', 'Extended', 'B', 5, 36, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '3.4', 'Extended', 'B', 14, 37, NULL, FALSE),
('LIFE_SC_P1_NOV_2025', 'Life Sciences', 'P1', 2025, 'Nov', '3.5', 'Extended', 'B', 10, 38, NULL, FALSE);

-- Verify insert
SELECT section, COUNT(*) as item_count, SUM(expected_marks) as total_marks 
FROM QB_questionP_Structure 
WHERE paper_code = 'LIFE_SC_P1_NOV_2025'
GROUP BY section;

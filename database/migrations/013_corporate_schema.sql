-- Migration 013: Corporate Schema - Phase 2 Implementation
-- Database: nsc_qbank
-- Date: 2026-06-08
-- Includes: Attachments, Versions, Reviews, Workflow, Templates, Usage, Taxonomy

-- ============================================================
-- Table: qbank_item_attachments
-- Image/diagram storage references
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_item_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL COMMENT 'FK to qbank_items or qbank_items_staging',
    item_type ENUM('staging','live') DEFAULT 'staging',
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    description VARCHAR(255),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item (item_id, item_type),
    INDEX idx_file_path (file_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Image and diagram attachments for items';

-- ============================================================
-- Table: qbank_item_versions
-- Audit trail for item changes
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_item_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL COMMENT 'FK to qbank_items',
    version_number INT NOT NULL,
    question_text TEXT,
    memo_answer TEXT,
    marks INT,
    changed_by INT COMMENT 'User ID',
    change_reason VARCHAR(255),
    change_type ENUM('create','update','review','rollback') DEFAULT 'update',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_item_version (item_id, version_number),
    INDEX idx_item_id (item_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit trail for item versioning';

-- ============================================================
-- Table: qbank_item_reviews
-- Review comments with threading
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_item_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    parent_review_id INT DEFAULT NULL COMMENT 'For threaded replies',
    reviewer_id INT NOT NULL COMMENT 'User ID',
    reviewer_role ENUM('peer_reviewer','subject_expert','moderator','admin') NOT NULL,
    review_type ENUM('accuracy','clarity','curriculum','bias','technical','general') DEFAULT 'general',
    comment TEXT NOT NULL,
    status ENUM('open','resolved','dismissed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_item (item_id),
    INDEX idx_parent (parent_review_id),
    INDEX idx_reviewer (reviewer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Review comments with threading support';

-- ============================================================
-- Table: qbank_review_workflow
-- State machine for review workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_review_workflow (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    current_state ENUM('draft','pending_review','revision_required','peer_approved','expert_approved','moderated','published','archived') DEFAULT 'draft',
    previous_state VARCHAR(50),
    changed_by INT NOT NULL,
    changed_by_role ENUM('developer','peer_reviewer','subject_expert','moderator','admin') NOT NULL,
    transition_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item (item_id),
    INDEX idx_state (current_state),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Review workflow state machine audit trail';

-- ============================================================
-- Table: qbank_paper_templates
-- Paper blueprints for assembly
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_paper_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_code VARCHAR(50) NOT NULL UNIQUE,
    template_name VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    paper_no VARCHAR(10) NOT NULL,
    total_marks INT NOT NULL,
    total_items INT NOT NULL,
    duration_minutes INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subject (subject),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Paper assembly templates/blueprints';

-- ============================================================
-- Table: qbank_paper_template_sections
-- Sections within a template with constraints
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_paper_template_sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    section_name VARCHAR(50) NOT NULL,
    section_order INT NOT NULL,
    total_marks INT NOT NULL,
    item_count INT NOT NULL,
    item_type ENUM('MCQ','Short','Matching','Diagram','Extended') NOT NULL,
    topic_distribution JSON COMMENT 'JSON: {topic: percentage}',
    difficulty_distribution JSON COMMENT 'JSON: {easy:30, medium:50, hard:20}',
    cognitive_distribution JSON COMMENT 'JSON: {remember:20, understand:30, apply:30, evaluate:20}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_template (template_id),
    INDEX idx_section_order (section_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Template section definitions with distribution constraints';

-- ============================================================
-- Table: qbank_item_usage
-- Exposure tracking for items
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_item_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    paper_id INT NOT NULL,
    paper_code VARCHAR(50),
    exam_year INT,
    exam_session VARCHAR(20),
    usage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performance_stats JSON COMMENT 'JSON: {p_value:0.65, discrimination:0.42}',
    INDEX idx_item (item_id),
    INDEX idx_paper (paper_id),
    INDEX idx_year (exam_year),
    INDEX idx_usage (usage_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Item usage/exposure tracking with performance stats';

-- ============================================================
-- Table: qbank_tag_taxonomy
-- Controlled vocabulary for tags
-- ============================================================
CREATE TABLE IF NOT EXISTS qbank_tag_taxonomy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tag_code VARCHAR(50) NOT NULL UNIQUE,
    tag_name VARCHAR(255) NOT NULL,
    parent_tag_id INT DEFAULT NULL,
    tag_level ENUM('subject','topic','subtopic','cognitive_level','difficulty','item_type','caps_code','source','custom') NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_level (tag_level),
    INDEX idx_parent (parent_tag_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Controlled vocabulary tag taxonomy';

-- ============================================================
-- Modified: qbank_items - Add review and version fields
-- ============================================================
-- Note: If columns already exist, these will error. Run one at a time if needed.
ALTER TABLE qbank_items ADD COLUMN review_status ENUM('draft','pending_review','revision_required','peer_approved','expert_approved','moderated','published','archived') DEFAULT 'draft';
ALTER TABLE qbank_items ADD COLUMN current_version INT DEFAULT 1;
ALTER TABLE qbank_items ADD COLUMN exposure_count INT DEFAULT 0;
ALTER TABLE qbank_items ADD COLUMN last_used_date DATE;
ALTER TABLE qbank_items ADD COLUMN is_retired BOOLEAN DEFAULT FALSE;
ALTER TABLE qbank_items ADD COLUMN retired_reason VARCHAR(255);
ALTER TABLE qbank_items ADD COLUMN retired_at TIMESTAMP NULL;

-- Add indexes (idempotent - will error if already exist)
CREATE INDEX idx_review_status ON qbank_items(review_status);
CREATE INDEX idx_exposure ON qbank_items(exposure_count);
CREATE INDEX idx_retired ON qbank_items(is_retired);

-- ============================================================
-- Modified: qbank_item_memos - Add live item linkage
-- ============================================================
ALTER TABLE qbank_item_memos ADD COLUMN live_item_id INT;
ALTER TABLE qbank_item_memos ADD COLUMN version INT DEFAULT 1;
ALTER TABLE qbank_item_memos ADD COLUMN is_current BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_live_item ON qbank_item_memos(live_item_id);
CREATE INDEX idx_version ON qbank_item_memos(version);

-- ============================================================
-- Modified: qbank_items_staging - Add review fields
-- ============================================================
ALTER TABLE qbank_items_staging ADD COLUMN review_status ENUM('draft','pending_review','revision_required','peer_approved','expert_approved','moderated','published') DEFAULT 'draft';
ALTER TABLE qbank_items_staging ADD COLUMN reviewer_id INT;
ALTER TABLE qbank_items_staging ADD COLUMN review_notes TEXT;
ALTER TABLE qbank_items_staging ADD COLUMN reviewed_at TIMESTAMP NULL;

CREATE INDEX idx_review_status ON qbank_items_staging(review_status);
CREATE INDEX idx_reviewer ON qbank_items_staging(reviewer_id);

-- ============================================================
-- Seed: Default tag taxonomy for Life Sciences
-- ============================================================
INSERT INTO qbank_tag_taxonomy (tag_code, tag_name, tag_level, description, is_active) VALUES
('SUBJ_LIFE_SC', 'Life Sciences', 'subject', 'Life Sciences subject', TRUE),
('TOPIC_HUMAN_REPRO', 'Human Reproduction', 'topic', 'Human reproduction and development', TRUE),
('TOPIC_ENDOCRINE', 'Endocrine System', 'topic', 'Hormones and homeostasis', TRUE),
('TOPIC_NERVOUS', 'Nervous System', 'topic', 'Neurons, impulses, brain', TRUE),
('TOPIC_SENSORY', 'Sensory Systems', 'topic', 'Eye, ear, skin', TRUE),
('TOPIC_PLANT_HORM', 'Plant Hormones', 'topic', 'Auxins, gibberellins, abscisic acid', TRUE),
('COG_REMEMBER', 'Remember', 'cognitive_level', 'Recall facts and basic concepts', TRUE),
('COG_UNDERSTAND', 'Understand', 'cognitive_level', 'Explain ideas and concepts', TRUE),
('COG_APPLY', 'Apply', 'cognitive_level', 'Use information in new situations', TRUE),
('COG_ANALYZE', 'Analyze', 'cognitive_level', 'Draw connections among ideas', TRUE),
('COG_EVALUATE', 'Evaluate', 'cognitive_level', 'Justify a stand or decision', TRUE),
('COG_CREATE', 'Create', 'cognitive_level', 'Produce new or original work', TRUE),
('DIFF_EASY', 'Easy', 'difficulty', 'Most learners can answer correctly', TRUE),
('DIFF_MEDIUM', 'Medium', 'difficulty', 'Average difficulty', TRUE),
('DIFF_HARD', 'Hard', 'difficulty', 'Challenging for most learners', TRUE),
('TYPE_MCQ', 'Multiple Choice', 'item_type', 'MCQ with A-D options', TRUE),
('TYPE_SHORT', 'Short Answer', 'item_type', 'Brief written response', TRUE),
('TYPE_MATCH', 'Matching', 'item_type', 'Match columns I and II', TRUE),
('TYPE_DIAGRAM', 'Diagram', 'item_type', 'Label or annotate diagrams', TRUE),
('TYPE_EXTENDED', 'Extended', 'item_type', 'Longer written response', TRUE)
ON DUPLICATE KEY UPDATE tag_name=VALUES(tag_name), description=VALUES(description);

-- Verify
SELECT 'qbank_item_attachments' as table_name, COUNT(*) as rows FROM qbank_item_attachments
UNION ALL
SELECT 'qbank_item_versions', COUNT(*) FROM qbank_item_versions
UNION ALL
SELECT 'qbank_item_reviews', COUNT(*) FROM qbank_item_reviews
UNION ALL
SELECT 'qbank_review_workflow', COUNT(*) FROM qbank_review_workflow
UNION ALL
SELECT 'qbank_paper_templates', COUNT(*) FROM qbank_paper_templates
UNION ALL
SELECT 'qbank_item_usage', COUNT(*) FROM qbank_item_usage
UNION ALL
SELECT 'qbank_tag_taxonomy', COUNT(*) FROM qbank_tag_taxonomy;

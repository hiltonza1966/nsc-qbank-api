CREATE TABLE IF NOT EXISTS parser_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paper_code VARCHAR(50) NOT NULL,
  subject_id INT,
  grade_id INT,
  year INT,
  result_json LONGTEXT,
  status ENUM('pending_review', 'imported', 'rejected') DEFAULT 'pending_review',
  total_marks INT,
  target_marks INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_paper_code (paper_code),
  INDEX idx_status (status)
);

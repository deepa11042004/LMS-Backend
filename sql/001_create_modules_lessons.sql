USE lms_core_db;

CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  order_index INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_modules_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE,
  INDEX idx_modules_course_order (course_id, order_index)
);

CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  youtube_url VARCHAR(500) NULL,
  order_index INT NOT NULL DEFAULT 1,
  is_free_preview TINYINT(1) NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lessons_module
    FOREIGN KEY (module_id) REFERENCES modules(id)
    ON DELETE CASCADE,
  INDEX idx_lessons_module_order (module_id, order_index)
);

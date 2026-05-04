USE lms_core_db;

-- Ensure pricing fields exist for enrollment/payment decisions.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER thumbnail;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR' AFTER price;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_free TINYINT(1) NOT NULL DEFAULT 0 AFTER currency;

UPDATE courses
SET is_free = CASE
  WHEN COALESCE(price, 0) <= 0 OR COALESCE(is_paid, 1) = 0 THEN 1
  ELSE 0
END;

-- NOTE:
-- This migration assumes users live in bserc_core_db.users (default AUTH_DB_NAME).
-- If your auth schema name differs, update FK references below before running.
CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_enrollments_user
    FOREIGN KEY (user_id) REFERENCES bserc_core_db.users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE,
  UNIQUE KEY uq_enrollments_user_course (user_id, course_id),
  INDEX idx_enrollments_user_status (user_id, status),
  INDEX idx_enrollments_course_status (course_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  enrollment_id INT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  payment_provider VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  payment_id VARCHAR(120) NULL,
  order_id VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES bserc_core_db.users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payments_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payments_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
    ON DELETE SET NULL,
  UNIQUE KEY uq_payments_order_id (order_id),
  UNIQUE KEY uq_payments_payment_id (payment_id),
  UNIQUE KEY uq_payments_enrollment_id (enrollment_id),
  INDEX idx_payments_user_status (user_id, payment_status),
  INDEX idx_payments_course_status (course_id, payment_status)
) ENGINE=InnoDB;
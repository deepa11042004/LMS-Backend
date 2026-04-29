ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_published TINYINT(1) NOT NULL DEFAULT 0 AFTER certificate_available;

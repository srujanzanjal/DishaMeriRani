-- Migration: Admin panel schema extensions (2025-11-04)
-- Idempotent and backward-compatible where possible

START TRANSACTION;

-- Users: normalize role, add status and last_active
ALTER TABLE users
  MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user',
  ADD COLUMN status ENUM('active','locked','deleted') NOT NULL DEFAULT 'active' AFTER role,
  ADD COLUMN last_active TIMESTAMP NULL DEFAULT NULL AFTER created_at;

-- Documents: add metadata and status + indexes
ALTER TABLE documents
  ADD COLUMN mime_type VARCHAR(100) NULL AFTER filename,
  ADD COLUMN size_bytes BIGINT NULL AFTER mime_type,
  ADD COLUMN status ENUM('uploaded','processing','done','failed') NOT NULL DEFAULT 'uploaded' AFTER size_bytes,
  ADD INDEX idx_documents_user_status (user_id, status);

-- Profile versions table
CREATE TABLE IF NOT EXISTS profile_versions (
  user_id INT NOT NULL,
  version INT NOT NULL,
  profile_json JSON NULL,
  profile_html LONGTEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, version),
  CONSTRAINT fk_profile_versions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Extend user_profile to reference current version
ALTER TABLE user_profile
  ADD COLUMN current_version INT NULL AFTER user_id,
  ADD CONSTRAINT fk_user_profile_current_version FOREIGN KEY (user_id, current_version)
    REFERENCES profile_versions(user_id, version) ON DELETE SET NULL ON UPDATE CASCADE;

-- Admin audit events
CREATE TABLE IF NOT EXISTS admin_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  actor_user_id INT NOT NULL,
  target_user_id INT NOT NULL,
  action ENUM('LOCK','UNLOCK','REGENERATE','DELETE_FILE','REEXTRACT') NOT NULL,
  details JSON NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_events_actor (actor_user_id, created_at),
  INDEX idx_admin_events_target (target_user_id, created_at),
  CONSTRAINT fk_admin_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_admin_events_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Optional tagging tables
CREATE TABLE IF NOT EXISTS tags (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_tags (
  user_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (user_id, tag_id),
  CONSTRAINT fk_user_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_notes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  admin_user_id INT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_notes_user (user_id, created_at),
  CONSTRAINT fk_admin_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_admin_notes_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Optional: masked email view for list
CREATE OR REPLACE VIEW v_users_masked AS
SELECT 
  u.id,
  u.name,
  CONCAT(LEFT(u.email, 1), REPEAT('*', GREATEST(0, LOCATE('@', u.email) - 3)), SUBSTRING(u.email, LOCATE('@', u.email))) AS masked_email,
  u.role,
  u.status,
  u.created_at,
  u.last_active
FROM users u;

COMMIT;

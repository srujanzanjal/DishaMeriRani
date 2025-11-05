USE doclocker_db;

-- 1) Drop stray/unnecessary duplicate tables (with invisible unicode chars)
DROP TABLE IF EXISTS `⁠ documents ⁠`;
DROP TABLE IF EXISTS `⁠ user_profile ⁠`;
DROP TABLE IF EXISTS `⁠ users ⁠`;

-- 2) Temporarily disable FKs for clean truncation
SET FOREIGN_KEY_CHECKS = 0;

-- 3) Truncate all real tables
TRUNCATE TABLE admin_events;
TRUNCATE TABLE admin_notes;
TRUNCATE TABLE profile_versions;
TRUNCATE TABLE user_profile;
TRUNCATE TABLE user_tags;
TRUNCATE TABLE tags;
TRUNCATE TABLE documents;
TRUNCATE TABLE users;

-- 4) Re-enable FKs
SET FOREIGN_KEY_CHECKS = 1;

-- (Optional) Recreate masked view if needed (usually not required if it already exists)
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
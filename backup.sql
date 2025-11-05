-- Recreate schema for doclocker_db (MySQL 8.x) — structure only, no data
-- Safe defaults
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- Create database (if needed) and use it
CREATE DATABASE IF NOT EXISTS `doclocker_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE `doclocker_db`;

/* ------------------------
   Base tables (no FKs to others)
   ------------------------ */

-- users
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'user',
  `status` enum('active','locked','deleted') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_active` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- tags
DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ------------------------
   Dependent tables (FKs)
   ------------------------ */

-- admin_events (FK -> users)
DROP TABLE IF EXISTS `admin_events`;
CREATE TABLE `admin_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actor_user_id` int NOT NULL,
  `target_user_id` int NOT NULL,
  `action` enum('LOCK','UNLOCK','REGENERATE','DELETE_FILE','REEXTRACT') NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_events_actor` (`actor_user_id`,`created_at`),
  KEY `idx_admin_events_target` (`target_user_id`,`created_at`),
  CONSTRAINT `fk_admin_events_actor`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_admin_events_target`
    FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- admin_notes (FK -> users, users)
DROP TABLE IF EXISTS `admin_notes`;
CREATE TABLE `admin_notes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `admin_user_id` int NOT NULL,
  `note` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_notes_user` (`user_id`,`created_at`),
  KEY `fk_admin_notes_admin` (`admin_user_id`),
  CONSTRAINT `fk_admin_notes_admin`
    FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_admin_notes_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- documents (FK -> users)
DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `filename` varchar(255) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `size_bytes` bigint DEFAULT NULL,
  `status` enum('uploaded','processing','done','failed') NOT NULL DEFAULT 'uploaded',
  `filepath` varchar(500) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `extracted_text` longtext,
  PRIMARY KEY (`id`),
  KEY `idx_documents_user_id` (`user_id`),
  KEY `idx_documents_user_status` (`user_id`,`status`),
  CONSTRAINT `fk_documents_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- profile_versions (FK -> users)
DROP TABLE IF EXISTS `profile_versions`;
CREATE TABLE `profile_versions` (
  `user_id` int NOT NULL,
  `version` int NOT NULL,
  `profile_json` json DEFAULT NULL,
  `profile_html` longtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`version`),
  CONSTRAINT `fk_profile_versions_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- user_profile (FK -> users)
DROP TABLE IF EXISTS `user_profile`;
CREATE TABLE `user_profile` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `profile_json` json DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_profile_ibfk_1`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- user_tags (FK -> users, tags)
DROP TABLE IF EXISTS `user_tags`;
CREATE TABLE `user_tags` (
  `user_id` int NOT NULL,
  `tag_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`tag_id`),
  KEY `fk_user_tags_tag` (`tag_id`),
  CONSTRAINT `fk_user_tags_tag`
    FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_tags_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ------------------------
   View
   ------------------------ */

-- v_users_masked
DROP VIEW IF EXISTS `v_users_masked`;
CREATE VIEW `v_users_masked` AS
SELECT
  u.id AS id,
  u.name AS name,
  CONCAT(
    LEFT(u.email, 1),
    REPEAT('*', GREATEST(0, (LOCATE('@', u.email) - 3))),
    SUBSTR(u.email, LOCATE('@', u.email))
  ) AS masked_email,
  u.role AS role,
  u.status AS status,
  u.created_at AS created_at,
  u.last_active AS last_active
FROM `users` u;

-- Restore FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: fullcourt_database
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `fullcourt_database`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `fullcourt_database` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `fullcourt_database`;

--
-- Table structure for table `api_rate_limits`
--

DROP TABLE IF EXISTS `api_rate_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `api_rate_limits` (
  `bucket_key` char(64) NOT NULL,
  `action_name` varchar(50) NOT NULL,
  `window_started_at` datetime NOT NULL,
  `request_count` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`bucket_key`,`action_name`),
  KEY `idx_rate_window` (`window_started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_rate_limits`
--

LOCK TABLES `api_rate_limits` WRITE;
/*!40000 ALTER TABLE `api_rate_limits` DISABLE KEYS */;
INSERT INTO `api_rate_limits` VALUES ('010e8e2dd6058542d0884ecf0b93195fe390c5acc151bb3ff649cd3f0b90e21f','login','2026-08-23 17:04:52',10),('4186cc816247c19cece1af5504f6902a23e127098c15e1ad5a0514a72c8575dd','login','2026-08-23 19:02:56',1),('89bcb2e6b0ac5094e9baff0193910a92d53f1eba1b209ad47f14e9baa424913c','login','2026-08-17 12:01:52',3),('ac00dcede38239ee644aca88b0b02c56651b99c7a778d9c5a0dc582468dc8ce0','login','2026-08-17 12:01:53',3),('e61947606cd6122741b92cf4e6aa8d11936af6181630edaa5d398ada97f7c912','login','2026-08-23 19:04:21',10);
/*!40000 ALTER TABLE `api_rate_limits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,2,'CREATE_TOURNAMENT','TOURNAMENT_MGMT','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Created tournament \'Basketball sa Capstone\' (ID: 1).','2026-08-04 19:53:42'),(2,4,'REGISTER_TEAM','TEAM_MGMT','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Registered team \'MGA IT \' for tournament ID 1.','2026-08-04 19:57:44'),(3,4,'SUBMIT_PAYMENT','PAYMENTS','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Submitted GCash/Maya payment (Ref: s121212) for team ID 1.','2026-08-04 20:09:19'),(4,2,'VERIFY_PAYMENT','PAYMENTS','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Payment ID 1 marked as \'approved\'. Remarks: Verified by Finance Officer','2026-08-04 20:10:28'),(5,2,'AUTO_SCHEDULE','SCHEDULING','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-04 20:14:37'),(6,2,'AUTO_SCHEDULE','SCHEDULING','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-04 20:14:38'),(7,2,'AUTO_SCHEDULE','SCHEDULING','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-04 20:14:39'),(8,2,'AUTO_SCHEDULE','SCHEDULING','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-04 20:14:41'),(9,4,'ADD_PLAYER','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-PH) WindowsPowerShell/5.1.26100.8972','Added player ID 2 to team ID 1.','2026-08-04 20:18:23'),(10,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:20:53'),(11,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:20:57'),(12,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:21:06'),(13,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:21:34'),(14,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:23:07'),(15,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:23:17'),(16,4,'VERIFY_ELIGIBILITY','PLAYER_ELIGIBILITY','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Set player ID 1 status to \'verified\'. Remarks: ','2026-08-04 20:24:24'),(17,2,'AUTO_SCHEDULE','SCHEDULING','127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-PH) WindowsPowerShell/5.1.26100.8972','Generated conflict-free schedule for tournament ID 1.','2026-08-05 16:34:13'),(18,2,'AUTO_SCHEDULE','SCHEDULING','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-05 16:34:41'),(19,2,'AUTO_SCHEDULE','SCHEDULING','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-05 16:34:43'),(20,2,'AUTO_SCHEDULE','SCHEDULING','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Generated conflict-free schedule for tournament ID 1.','2026-08-05 16:34:47'),(21,1,'APPLY_ORGANIZATION','ORGANIZATIONS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Created organization application ID 1.','2026-08-17 03:44:19'),(22,1,'REVIEW_ORGANIZATION','ORGANIZATIONS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Set organization 1 to active.','2026-08-17 03:44:19'),(23,1,'GENERATE_PDF','REPORTS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Generated TOURNAMENT_REPORT for tournament 1.','2026-08-17 03:55:42'),(24,1,'FINALIZE_MATCH','LIVE_SCORING','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Finalized match ID 1. Winner: Team ID 1.','2026-08-17 04:01:54'),(25,1,'FINALIZE_MATCH','LIVE_SCORING','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Finalized match ID 1. Winner: Team ID 1.','2026-08-17 04:02:41'),(26,1,'REVIEW_SCORE_CORRECTION','GAME_OPERATIONS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Set correction 1 to approved.','2026-08-17 04:03:11'),(27,NULL,'GENERATE_PDF','REPORTS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Generated FIBA_SCORE_SHEET for tournament 1.','2026-08-17 04:03:13'),(28,1,'RECOMMEND_AWARDS','AWARDS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Rebuilt recommendations for tournament 1.','2026-08-23 09:14:29'),(29,1,'TEAM_QR_CHECKIN','ATTENDANCE','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Verified team QR for game 2.','2026-08-23 09:25:35'),(30,1,'ISSUE_GAME_ACCESS_QR','GAME_ACCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Issued official game access for assignment 2.','2026-08-23 09:25:35'),(31,1,'VALIDATE_GAME_ACCESS_QR','GAME_ACCESS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Granted official access for game 2.','2026-08-23 09:25:35'),(32,4,'GENERATE_PDF','REPORTS','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-PH) PowerShell/7.6.4','Generated TOURNAMENT_REPORT for tournament 1.','2026-08-23 11:34:24');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `award_categories`
--

DROP TABLE IF EXISTS `award_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `award_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `metric_key` varchar(50) DEFAULT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_award_category` (`tournament_id`,`name`),
  CONSTRAINT `award_categories_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `award_categories`
--

LOCK TABLES `award_categories` WRITE;
/*!40000 ALTER TABLE `award_categories` DISABLE KEYS */;
INSERT INTO `award_categories` VALUES (1,1,'Scoring Leader','points',0),(2,1,'Rebounding Leader','rebounds',0),(3,1,'Assist Leader','assists',0),(4,1,'Defensive Performer','defense',0);
/*!40000 ALTER TABLE `award_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `basketball_stat_events`
--

DROP TABLE IF EXISTS `basketball_stat_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `basketball_stat_events` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `event_uuid` char(36) NOT NULL,
  `match_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL,
  `team_player_id` int(11) DEFAULT NULL,
  `event_type` enum('2pt_made','2pt_missed','3pt_made','3pt_missed','ft_made','ft_missed','off_rebound','def_rebound','assist','steal','block','turnover','personal_foul','substitution','timeout') NOT NULL,
  `period` tinyint(4) NOT NULL DEFAULT 1,
  `game_clock_seconds` int(11) NOT NULL DEFAULT 600,
  `metadata_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata_json`)),
  `is_void` tinyint(1) NOT NULL DEFAULT 0,
  `recorded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_uuid` (`event_uuid`),
  KEY `idx_stat_match_time` (`match_id`,`period`,`game_clock_seconds`),
  KEY `idx_stat_player_type` (`team_player_id`,`event_type`),
  KEY `team_id` (`team_id`),
  KEY `recorded_by` (`recorded_by`),
  CONSTRAINT `basketball_stat_events_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `basketball_stat_events_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `basketball_stat_events_ibfk_3` FOREIGN KEY (`team_player_id`) REFERENCES `team_players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `basketball_stat_events_ibfk_4` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `basketball_stat_events`
--

LOCK TABLES `basketball_stat_events` WRITE;
/*!40000 ALTER TABLE `basketball_stat_events` DISABLE KEYS */;
INSERT INTO `basketball_stat_events` VALUES (3,'11111111-1111-4111-8111-111111111111',1,1,1,'3pt_made',1,540,'[]',0,2,'2026-08-17 04:02:40');
/*!40000 ALTER TABLE `basketball_stat_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bracket_nodes`
--

DROP TABLE IF EXISTS `bracket_nodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bracket_nodes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bracket_id` int(11) NOT NULL,
  `match_id` int(11) DEFAULT NULL,
  `round` int(11) NOT NULL,
  `position_in_round` int(11) NOT NULL,
  `parent_node_1_id` int(11) DEFAULT NULL,
  `parent_node_2_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bracket_id` (`bracket_id`),
  KEY `match_id` (`match_id`),
  CONSTRAINT `bracket_nodes_ibfk_1` FOREIGN KEY (`bracket_id`) REFERENCES `brackets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bracket_nodes_ibfk_2` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bracket_nodes`
--

LOCK TABLES `bracket_nodes` WRITE;
/*!40000 ALTER TABLE `bracket_nodes` DISABLE KEYS */;
/*!40000 ALTER TABLE `bracket_nodes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `brackets`
--

DROP TABLE IF EXISTS `brackets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `brackets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `format` enum('single_elimination','double_elimination','round_robin','group_stage','league') NOT NULL,
  `total_rounds` int(11) NOT NULL DEFAULT 1,
  `total_teams` int(11) NOT NULL DEFAULT 2,
  `seeding_type` enum('automatic','manual') DEFAULT 'automatic',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tournament_id` (`tournament_id`),
  CONSTRAINT `brackets_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `brackets`
--

LOCK TABLES `brackets` WRITE;
/*!40000 ALTER TABLE `brackets` DISABLE KEYS */;
/*!40000 ALTER TABLE `brackets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `courts`
--

DROP TABLE IF EXISTS `courts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `courts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `venue_id` int(11) NOT NULL,
  `court_name` varchar(50) NOT NULL,
  `sport_id` int(11) DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `venue_id` (`venue_id`),
  KEY `sport_id` (`sport_id`),
  CONSTRAINT `courts_ibfk_1` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `courts_ibfk_2` FOREIGN KEY (`sport_id`) REFERENCES `sports` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `courts`
--

LOCK TABLES `courts` WRITE;
/*!40000 ALTER TABLE `courts` DISABLE KEYS */;
INSERT INTO `courts` VALUES (1,1,'Gym Court A (Basketball)',1,1),(2,1,'Gym Court B (Volleyball)',2,1),(3,2,'Outdoor Futsal Field',7,1),(4,3,'Esports Arena Hub',5,1);
/*!40000 ALTER TABLE `courts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `divisions`
--

DROP TABLE IF EXISTS `divisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `divisions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `age_group` varchar(50) DEFAULT NULL,
  `gender_category` enum('mens','womens','mixed','open') NOT NULL DEFAULT 'open',
  `format` enum('round_robin','single_elimination','group_playoffs') NOT NULL DEFAULT 'round_robin',
  `min_age` int(11) DEFAULT NULL,
  `max_age` int(11) DEFAULT NULL,
  `max_roster_size` int(11) NOT NULL DEFAULT 15,
  `eligibility_requirements` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tournament_division` (`tournament_id`,`name`),
  CONSTRAINT `divisions_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `divisions`
--

LOCK TABLES `divisions` WRITE;
/*!40000 ALTER TABLE `divisions` DISABLE KEYS */;
/*!40000 ALTER TABLE `divisions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `eligibility_documents`
--

DROP TABLE IF EXISTS `eligibility_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `eligibility_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `team_player_id` int(11) NOT NULL,
  `document_type` varchar(80) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  `review_notes` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_eligibility_documents_review` (`status`,`team_player_id`),
  KEY `team_player_id` (`team_player_id`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `eligibility_documents_ibfk_1` FOREIGN KEY (`team_player_id`) REFERENCES `team_players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `eligibility_documents_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `eligibility_documents`
--

LOCK TABLES `eligibility_documents` WRITE;
/*!40000 ALTER TABLE `eligibility_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `eligibility_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `eligibility_logs`
--

DROP TABLE IF EXISTS `eligibility_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `eligibility_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `team_player_id` int(11) NOT NULL,
  `action_by` int(11) NOT NULL,
  `status` enum('pending','verified','rejected') NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `team_player_id` (`team_player_id`),
  KEY `action_by` (`action_by`),
  CONSTRAINT `eligibility_logs_ibfk_1` FOREIGN KEY (`team_player_id`) REFERENCES `team_players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `eligibility_logs_ibfk_2` FOREIGN KEY (`action_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `eligibility_logs`
--

LOCK TABLES `eligibility_logs` WRITE;
/*!40000 ALTER TABLE `eligibility_logs` DISABLE KEYS */;
INSERT INTO `eligibility_logs` VALUES (1,1,4,'verified','','2026-08-04 20:20:53'),(2,1,4,'verified','','2026-08-04 20:20:57'),(3,1,4,'verified','','2026-08-04 20:21:06'),(4,1,4,'verified','','2026-08-04 20:21:34'),(5,1,4,'verified','','2026-08-04 20:23:07'),(6,1,4,'verified','','2026-08-04 20:23:17'),(7,1,4,'verified','','2026-08-04 20:24:24');
/*!40000 ALTER TABLE `eligibility_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_verifications`
--

DROP TABLE IF EXISTS `email_verifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `email_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `purpose` enum('registration','password_reset') NOT NULL,
  `code_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email_purpose` (`email`,`purpose`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_verifications`
--

LOCK TABLES `email_verifications` WRITE;
/*!40000 ALTER TABLE `email_verifications` DISABLE KEYS */;
INSERT INTO `email_verifications` VALUES (1,'ken.repollo@evsu.edu.ph','registration','$2y$10$zEM5HnidXBlHMB/nV6BUuuZvgDcwEaZbOWZB82GuRIqsDVp05rpNy','2026-08-04 23:29:52','2026-08-04 23:21:23','2026-08-04 15:19:52'),(15,'organizer@evsu.edu.ph','password_reset','$2y$10$d0LC9uL9i9RNtnr98VbMJOGtxe53tmefg.3QnLdHUidabf5SMeX2W','2026-08-06 01:37:29',NULL,'2026-08-05 17:27:29'),(16,'ken.repollo@evsu.edu.ph','password_reset','$2y$10$IVVhx9ucFi8W7PHo1Ej3.upyfGv5Ma3jRjFaMTeyAhCzvIivx.fjG','2026-08-06 01:38:40',NULL,'2026-08-05 17:28:40'),(22,'vivian.cabato@evsu.edu.ph','registration','$2y$10$F5RLmx6qX5/x.n1NvlnSku4rYxNR/AOswV5saxE/iYkN5LFZ5m54i','2026-08-06 01:41:01',NULL,'2026-08-05 17:38:01');
/*!40000 ALTER TABLE `email_verifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_categories`
--

DROP TABLE IF EXISTS `event_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `event_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sport_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `gender` enum('mens','womens','mixed','open') NOT NULL DEFAULT 'open',
  `player_count` int(11) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_event_category_sport_name` (`sport_id`,`name`),
  CONSTRAINT `event_categories_ibfk_1` FOREIGN KEY (`sport_id`) REFERENCES `sports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_categories`
--

LOCK TABLES `event_categories` WRITE;
/*!40000 ALTER TABLE `event_categories` DISABLE KEYS */;
INSERT INTO `event_categories` VALUES (1,3,'Men\'s Singles','mens',1,1,'2026-08-06 17:24:15'),(2,3,'Women\'s Singles','womens',1,2,'2026-08-06 17:24:15'),(3,3,'Men\'s Doubles','mens',2,3,'2026-08-06 17:24:15'),(4,3,'Women\'s Doubles','womens',2,4,'2026-08-06 17:24:15'),(5,3,'Mixed Doubles','mixed',2,5,'2026-08-06 17:24:15'),(6,1,'Men\'s Team','mens',5,1,'2026-08-06 17:24:15'),(7,1,'Women\'s Team','womens',5,2,'2026-08-06 17:24:15'),(8,1,'3x3 Basketball','open',3,3,'2026-08-06 17:24:15'),(9,2,'Men\'s Team','mens',6,1,'2026-08-06 17:24:15'),(10,2,'Women\'s Team','womens',6,2,'2026-08-06 17:24:15'),(11,4,'Men\'s Open','mens',1,1,'2026-08-06 17:24:15'),(12,4,'Women\'s Open','womens',1,2,'2026-08-06 17:24:15'),(13,4,'Mixed Rapid','mixed',1,3,'2026-08-06 17:24:15'),(14,5,'Mobile Legends 5v5','open',5,1,'2026-08-06 17:24:15'),(15,5,'Valorant 5v5','open',5,2,'2026-08-06 17:24:15'),(16,6,'Men\'s 11-a-side','mens',11,1,'2026-08-06 17:24:15'),(17,6,'Women\'s 11-a-side','womens',11,2,'2026-08-06 17:24:15'),(18,7,'Men\'s Futsal','mens',5,1,'2026-08-06 17:24:15'),(19,7,'Women\'s Futsal','womens',5,2,'2026-08-06 17:24:15');
/*!40000 ALTER TABLE `event_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_assignments`
--

DROP TABLE IF EXISTS `game_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `game_assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `match_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `assignment_role` enum('referee','scorer','statistician') NOT NULL,
  `status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `qr_token_hash` char(64) DEFAULT NULL,
  `qr_expires_at` datetime DEFAULT NULL,
  `qr_used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_game_assignment` (`match_id`,`user_id`,`assignment_role`),
  KEY `idx_assignment_user_status` (`user_id`,`status`),
  CONSTRAINT `game_assignments_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `game_assignments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_assignments`
--

LOCK TABLES `game_assignments` WRITE;
/*!40000 ALTER TABLE `game_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `game_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `game_lineups`
--

DROP TABLE IF EXISTS `game_lineups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `game_lineups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `match_id` int(11) NOT NULL,
  `team_player_id` int(11) NOT NULL,
  `is_present` tinyint(1) NOT NULL DEFAULT 1,
  `is_starter` tinyint(1) NOT NULL DEFAULT 0,
  `confirmed_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_game_lineup_player` (`match_id`,`team_player_id`),
  KEY `team_player_id` (`team_player_id`),
  KEY `confirmed_by` (`confirmed_by`),
  CONSTRAINT `game_lineups_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `game_lineups_ibfk_2` FOREIGN KEY (`team_player_id`) REFERENCES `team_players` (`id`) ON DELETE CASCADE,
  CONSTRAINT `game_lineups_ibfk_3` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `game_lineups`
--

LOCK TABLES `game_lineups` WRITE;
/*!40000 ALTER TABLE `game_lineups` DISABLE KEYS */;
/*!40000 ALTER TABLE `game_lineups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_scores`
--

DROP TABLE IF EXISTS `match_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `match_scores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `match_id` int(11) NOT NULL,
  `team1_score` int(11) DEFAULT 0,
  `team2_score` int(11) DEFAULT 0,
  `current_period` varchar(50) DEFAULT 'Q1',
  `timer_seconds` int(11) DEFAULT 600,
  `is_timer_running` tinyint(1) DEFAULT 0,
  `detailed_data_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`detailed_data_json`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `match_id` (`match_id`),
  CONSTRAINT `match_scores_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_scores`
--

LOCK TABLES `match_scores` WRITE;
/*!40000 ALTER TABLE `match_scores` DISABLE KEYS */;
INSERT INTO `match_scores` VALUES (1,1,4,2,'Q1',600,0,NULL,'2026-08-17 04:03:07');
/*!40000 ALTER TABLE `match_scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `matches`
--

DROP TABLE IF EXISTS `matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `matches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `division_id` int(11) DEFAULT NULL,
  `round_number` int(11) NOT NULL DEFAULT 1,
  `match_number` int(11) NOT NULL DEFAULT 1,
  `stage_name` varchar(50) DEFAULT 'Regular Match',
  `team1_id` int(11) DEFAULT NULL,
  `team2_id` int(11) DEFAULT NULL,
  `winner_team_id` int(11) DEFAULT NULL,
  `court_id` int(11) DEFAULT NULL,
  `scheduled_start_time` datetime DEFAULT NULL,
  `scheduled_end_time` datetime DEFAULT NULL,
  `actual_start_time` datetime DEFAULT NULL,
  `actual_end_time` datetime DEFAULT NULL,
  `lineups_confirmed_at` datetime DEFAULT NULL,
  `reminder_30_sent_at` datetime DEFAULT NULL,
  `rest_time_mins` int(11) DEFAULT 15,
  `status` enum('scheduled','in_progress','completed','postponed','cancelled') NOT NULL DEFAULT 'scheduled',
  `schedule_status` enum('draft','published') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `team1_id` (`team1_id`),
  KEY `team2_id` (`team2_id`),
  KEY `winner_team_id` (`winner_team_id`),
  KEY `court_id` (`court_id`),
  KEY `idx_matches_division` (`division_id`),
  CONSTRAINT `fk_matches_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `matches_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `matches_ibfk_2` FOREIGN KEY (`team1_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `matches_ibfk_3` FOREIGN KEY (`team2_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `matches_ibfk_4` FOREIGN KEY (`winner_team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `matches_ibfk_5` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `matches`
--

LOCK TABLES `matches` WRITE;
/*!40000 ALTER TABLE `matches` DISABLE KEYS */;
INSERT INTO `matches` VALUES (1,1,NULL,1,1,'Opening Game',1,2,1,1,'2026-08-18 12:01:33','2026-08-17 13:01:33',NULL,'2026-08-17 12:02:41',NULL,NULL,15,'completed','published','2026-08-17 04:01:33','2026-08-17 04:02:41');
/*!40000 ALTER TABLE `matches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `news` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sport_id` int(11) DEFAULT NULL,
  `title` varchar(160) NOT NULL,
  `slug` varchar(190) NOT NULL,
  `summary` varchar(500) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `cover_url` varchar(255) DEFAULT NULL,
  `author_id` int(11) DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `published_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_news_published` (`is_published`,`published_at`),
  KEY `idx_news_sport` (`sport_id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `news_ibfk_1` FOREIGN KEY (`sport_id`) REFERENCES `sports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `news_ibfk_2` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `notification_type` varchar(60) NOT NULL,
  `title` varchar(180) NOT NULL,
  `message` text NOT NULL,
  `action_url` varchar(255) DEFAULT NULL,
  `dedupe_key` varchar(120) DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_notification_dedupe` (`dedupe_key`),
  KEY `idx_notifications_user_unread` (`user_id`,`read_at`,`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organization_members`
--

DROP TABLE IF EXISTS `organization_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `organization_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `role` enum('organization_admin','organizer','coach','player','official','statistician') NOT NULL,
  `status` enum('invited','active','declined','suspended') NOT NULL DEFAULT 'invited',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_org_member_role` (`organization_id`,`user_id`,`role`),
  KEY `idx_org_members_user` (`user_id`,`status`),
  CONSTRAINT `organization_members_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organization_members`
--

LOCK TABLES `organization_members` WRITE;
/*!40000 ALTER TABLE `organization_members` DISABLE KEYS */;
INSERT INTO `organization_members` VALUES (1,1,1,'organization_admin','active','2026-08-17 03:44:19');
/*!40000 ALTER TABLE `organization_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organizations`
--

DROP TABLE IF EXISTS `organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `organizations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `organization_type` enum('lgu','barangay','school','sports_club','community_league','commercial_organizer','other') NOT NULL,
  `slug` varchar(160) NOT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `primary_color` char(7) NOT NULL DEFAULT '#F97316',
  `secondary_color` char(7) NOT NULL DEFAULT '#18181B',
  `tagline` varchar(200) DEFAULT NULL,
  `status` enum('pending','active','suspended','rejected') NOT NULL DEFAULT 'pending',
  `public_scores` tinyint(1) NOT NULL DEFAULT 1,
  `public_player_profiles` tinyint(1) NOT NULL DEFAULT 0,
  `application_notes` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_organizations_status` (`status`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `organizations_ibfk_1` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `organizations_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizations`
--

LOCK TABLES `organizations` WRITE;
/*!40000 ALTER TABLE `organizations` DISABLE KEYS */;
INSERT INTO `organizations` VALUES (1,'Barangay Linaw Basketball League','barangay','barangay-linaw',NULL,'#F97316','#18181B','One barangay. One court. One community.','active',1,0,'Approved local basketball demo organization.',1,'2026-08-17 11:44:19',1,'2026-08-17 03:44:19','2026-08-17 03:44:19');
/*!40000 ALTER TABLE `organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `team_id` int(11) NOT NULL,
  `tournament_id` int(11) NOT NULL,
  `payment_method` enum('gcash','maya','cash') NOT NULL DEFAULT 'gcash',
  `reference_number` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `receipt_photo_url` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `verified_by` int(11) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `team_id` (`team_id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `verified_by` (`verified_by`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,1,1,'gcash','s121212',100.00,NULL,'approved',2,'Verified by Finance Officer','2026-08-05 04:10:28','2026-08-04 20:09:19');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `player_awards`
--

DROP TABLE IF EXISTS `player_awards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_awards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `award_category_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `status` enum('recommended','confirmed') NOT NULL DEFAULT 'recommended',
  `confirmed_by` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_player_award` (`award_category_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `confirmed_by` (`confirmed_by`),
  CONSTRAINT `player_awards_ibfk_1` FOREIGN KEY (`award_category_id`) REFERENCES `award_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `player_awards_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `player_awards_ibfk_3` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `player_awards`
--

LOCK TABLES `player_awards` WRITE;
/*!40000 ALTER TABLE `player_awards` DISABLE KEYS */;
INSERT INTO `player_awards` VALUES (1,1,7,'recommended',NULL,NULL),(2,2,7,'recommended',NULL,NULL),(3,3,7,'recommended',NULL,NULL),(4,4,7,'recommended',NULL,NULL);
/*!40000 ALTER TABLE `player_awards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `player_game_minutes`
--

DROP TABLE IF EXISTS `player_game_minutes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_game_minutes` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `match_id` int(11) NOT NULL,
  `team_player_id` int(11) NOT NULL,
  `seconds_played` int(11) NOT NULL DEFAULT 0,
  `last_entered_elapsed_seconds` int(11) DEFAULT NULL,
  `is_on_court` tinyint(1) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_match_player_minutes` (`match_id`,`team_player_id`),
  KEY `idx_minutes_match_court` (`match_id`,`is_on_court`),
  KEY `fk_minutes_player` (`team_player_id`),
  CONSTRAINT `fk_minutes_match` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_minutes_player` FOREIGN KEY (`team_player_id`) REFERENCES `team_players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `player_game_minutes`
--

LOCK TABLES `player_game_minutes` WRITE;
/*!40000 ALTER TABLE `player_game_minutes` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_game_minutes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `player_profiles`
--

DROP TABLE IF EXISTS `player_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `player_profiles` (
  `user_id` int(11) NOT NULL,
  `first_name` varchar(80) DEFAULT NULL,
  `last_name` varchar(80) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `height_cm` decimal(5,2) DEFAULT NULL,
  `primary_position` enum('PG','SG','SF','PF','C') DEFAULT NULL,
  `guardian_name` varchar(150) DEFAULT NULL,
  `guardian_contact` varchar(50) DEFAULT NULL,
  `guardian_consented_at` datetime DEFAULT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `player_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `player_profiles`
--

LOCK TABLES `player_profiles` WRITE;
/*!40000 ALTER TABLE `player_profiles` DISABLE KEYS */;
/*!40000 ALTER TABLE `player_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qr_attendance`
--

DROP TABLE IF EXISTS `qr_attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `qr_attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sync_uuid` char(36) DEFAULT NULL,
  `match_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `qr_hash` varchar(64) NOT NULL,
  `attendance_type` enum('player_checkin','coach_checkin') NOT NULL DEFAULT 'player_checkin',
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `scanned_by` int(11) NOT NULL,
  `status` enum('success','duplicate_flagged') NOT NULL DEFAULT 'success',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_qr_attendance_sync` (`sync_uuid`),
  KEY `team_id` (`team_id`),
  KEY `user_id` (`user_id`),
  KEY `scanned_by` (`scanned_by`),
  KEY `idx_qr_attendance_match_team` (`match_id`,`team_id`),
  CONSTRAINT `qr_attendance_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qr_attendance_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qr_attendance_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `qr_attendance_ibfk_4` FOREIGN KEY (`scanned_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qr_attendance`
--

LOCK TABLES `qr_attendance` WRITE;
/*!40000 ALTER TABLE `qr_attendance` DISABLE KEYS */;
/*!40000 ALTER TABLE `qr_attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_tokens` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `family_id` char(36) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_refresh_family` (`family_id`,`revoked_at`),
  KEY `idx_refresh_user` (`user_id`,`expires_at`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES (1,1,'123efa2e-091b-4a65-8fec-eaaabf0245f6','1e98617a5c41fab6234e6b8a49193e8457e531cf135874151b4c591b3d7e91ba','2026-09-16 11:58:34','2026-08-17 11:58:34','2026-08-17 11:58:34','2026-08-17 03:58:34'),(2,1,'123efa2e-091b-4a65-8fec-eaaabf0245f6','c730622355bbbd07afb7d1b40b1436a11fded9a5f8fd19e7cafd7e2a1ed0f5b5','2026-09-16 11:58:34',NULL,'2026-08-17 11:58:34','2026-08-17 03:58:34'),(4,1,'698660a4-c2fa-47b5-aa42-ae50249592c3','5261541f369dc7ffbdddc264d2a3c8c46f8f70992fe09b8d6bfd92411d2652c5','2026-09-16 12:01:54',NULL,NULL,'2026-08-17 04:01:54'),(6,1,'4b24e703-9925-4305-896d-1c71f7b1092d','eca162c97041d4fd518d2506d811bacc3c9a9aeb0440fd13f1d21201c3513f3a','2026-09-16 12:02:41',NULL,NULL,'2026-08-17 04:02:41'),(8,1,'b986864a-6a71-4116-9ad8-09719b28d466','02007941cbca4363a9f0e568abd9455b7aa6e4224e70ba8d11b4750947e2b94e','2026-09-16 12:03:05',NULL,NULL,'2026-08-17 04:03:05'),(9,1,'fe3b52f7-6c3a-414c-8608-71bd98798b20','45c2325219e0046ffab4358a8c30d3ea159428aeb4bdb73328b3a8ae362d00c0','2026-09-16 18:43:11',NULL,NULL,'2026-08-17 10:43:11'),(10,1,'2bbb6971-8a95-4b0d-845e-d08bb16fcad5','d22f8433e522c3d5d0f2ac2c861272fba0460d0247bd7aa9eaa84c6a7df12284','2026-09-16 18:43:43',NULL,NULL,'2026-08-17 10:43:43'),(11,1,'08848ed9-5795-4e4d-bc59-a0c00946d477','2991038ddb6b6b50fe49fedae2c9670cc431fb97b098907cae08931f87855c9c','2026-09-16 18:44:02',NULL,'2026-08-17 18:45:55','2026-08-17 10:44:02'),(12,1,'613ad85c-b13a-4408-ad95-a6f9ff3d797f','24bd7ec8eb8e640c7e3f8cd69eb32f495d97a51780f5385ca504fe849a2acafa','2026-09-16 18:48:23',NULL,'2026-08-17 18:48:59','2026-08-17 10:48:23'),(13,1,'c0e4749a-3fa2-433e-b259-9273abfaf7bd','3f20575e5fbd05a798441427302ffb780162e3fa45aef9659b258375dcdec2b3','2026-09-22 17:04:52','2026-08-23 17:24:16','2026-08-23 17:24:16','2026-08-23 09:04:52'),(14,1,'c0e4749a-3fa2-433e-b259-9273abfaf7bd','37978b8926ac3f57e66b374e1c7a4bcfd7ba150615ad044647ecfabf8169643c','2026-09-22 17:24:16','2026-08-23 17:54:40','2026-08-23 17:54:40','2026-08-23 09:24:16'),(15,1,'affcb9ec-ed74-4d13-92b7-e10cc4d38d75','0ea2ea5f7cc0f9ba07bb13eea590a38926f188169c26333853a323e33d1cbaed','2026-09-22 17:25:35',NULL,NULL,'2026-08-23 09:25:35'),(16,1,'c0e4749a-3fa2-433e-b259-9273abfaf7bd','d6770e81b1e9b73940e71d1268aa4d71f0ba00b9ac92d228d80d164ee49e884f','2026-09-22 17:54:40','2026-08-23 17:54:40','2026-08-23 17:54:40','2026-08-23 09:54:40'),(17,1,'c0e4749a-3fa2-433e-b259-9273abfaf7bd','f88c7561910159b04ae6b50b20722ddb6600e4bed5bc4ab6f349910f61889f00','2026-09-22 17:54:40',NULL,'2026-08-23 18:04:54','2026-08-23 09:54:40'),(18,1,'a0ea745f-5b15-4ce4-9816-b660283ee910','93840262dd1d22a9cfce74f18b25fa8464324d789d83652b632479df011ea8ce','2026-09-22 18:03:33',NULL,NULL,'2026-08-23 10:03:33'),(19,1,'b632ef57-5d31-4748-bfb9-ce3454160c52','37c411282e66efb1ebb75951a85509f57ba0d3bbe7830aa9a2ee0a65ebaefd49','2026-09-22 18:03:55',NULL,NULL,'2026-08-23 10:03:55'),(20,1,'4f7ccd07-8657-43cb-ab05-af7081131cd0','a90a960f686463a355b898a0178863d04a49c77c705a5517fe3103925433c8e9','2026-09-22 19:00:42',NULL,'2026-08-23 19:01:00','2026-08-23 11:00:42'),(21,1,'bf899db9-6ba6-40b2-b88c-4f6f38bc0458','7c8e0d858f65d543f33a43a20d1e0ef0ec700c0be97082f61d3612f8236af066','2026-09-22 19:02:00',NULL,'2026-08-23 19:02:02','2026-08-23 11:02:00'),(22,1,'30c7a81d-7c18-483d-a4b1-e170ccf25b83','ff05a5a0a02d3a4b4adf233e27d258b5aa4a7c749d895f233947cf10d3aa110a','2026-09-22 19:02:13',NULL,'2026-08-23 19:02:16','2026-08-23 11:02:13'),(23,2,'f6266e6e-d6a3-48ca-81d6-bb70de454e7f','68fed5fe59eda6f076d44be037e8a494cf39e3b1cb9f6dcb481a40896a8bc319','2026-09-22 19:02:57',NULL,'2026-08-23 19:03:22','2026-08-23 11:02:57'),(24,1,'c6e07887-4358-47ec-9023-1d673fa8ecff','bb412a5d0a4301eb106cf2b08ac9fffa0f80fc31be9d178538d1ceea1ae97fe5','2026-09-22 19:03:56',NULL,'2026-08-23 19:03:57','2026-08-23 11:03:56'),(25,4,'b4822df6-af3b-49a8-889e-50b8428f5ba0','246379accfd3acd7fdd63270cf23d25f7e47d4bab7deb168e8187d5d01645be3','2026-09-22 19:04:27',NULL,'2026-08-23 19:05:59','2026-08-23 11:04:27'),(26,4,'9487941c-4dc6-4979-973c-5c8ef4479375','a510c66b4d32fed9a9192b868b2aab34f75de047a7b2fc4c13975e4fa7cd07b5','2026-09-22 19:06:54','2026-08-23 19:23:48','2026-08-23 19:23:48','2026-08-23 11:06:54'),(27,4,'9487941c-4dc6-4979-973c-5c8ef4479375','b5395736412f684a7e516fbd6d487c17ee14de89cac4ed4689e6138aa5d37cd1','2026-09-22 19:23:48',NULL,NULL,'2026-08-23 11:23:48'),(28,4,'91261c4e-9bd8-407c-9ff9-ae916fa32e0b','2d55c8d85938a05f1a77c192cd66c8f3a707cc6d06c5e6b1375a102eb5858650','2026-09-22 19:23:58',NULL,NULL,'2026-08-23 11:23:58'),(29,4,'f66da2ab-7eb8-4ac5-871e-ddddd26eb780','0ae0247bc9df7ea1db9090ce4b0f89e7bdaae145a1a34ff484539d9d33eb62fb','2026-09-22 19:33:27',NULL,NULL,'2026-08-23 11:33:27'),(30,4,'4de44285-6dc0-4669-a401-03da51079b1d','48c75ddb7d03406a94ab41362235101e71a521dc7c1242fdb393f8c5aa36c882','2026-09-22 19:33:55',NULL,NULL,'2026-08-23 11:33:55'),(31,4,'7b3f3588-6a39-4972-b754-a16db5eceae2','cc5e482135c6a3e04cf4c1b1c48180de7974db4669a90ce3443e37979d893194','2026-09-22 19:34:14',NULL,NULL,'2026-08-23 11:34:14'),(32,4,'80bc3af3-cac2-4bfd-a2e2-89dc20cb1a4b','ccdfd01cff933aa70340dcd306d92c3125739ab2d2f8c14e626c5132453189ff','2026-09-22 19:34:24',NULL,NULL,'2026-08-23 11:34:24');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports_log`
--

DROP TABLE IF EXISTS `reports_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reports_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) DEFAULT NULL,
  `report_type` varchar(80) NOT NULL,
  `generated_by` int(11) NOT NULL,
  `filters_json` longtext DEFAULT NULL,
  `file_url` varchar(255) DEFAULT NULL,
  `format` enum('pdf','excel','csv','print') NOT NULL DEFAULT 'pdf',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reports_tournament_created` (`tournament_id`,`created_at`),
  KEY `idx_reports_user_created` (`generated_by`,`created_at`),
  CONSTRAINT `fk_reports_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reports_user` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports_log`
--

LOCK TABLES `reports_log` WRITE;
/*!40000 ALTER TABLE `reports_log` DISABLE KEYS */;
INSERT INTO `reports_log` VALUES (1,1,'analytics',4,NULL,NULL,'csv','2026-08-23 11:34:14'),(2,1,'tournament_report',4,NULL,'tournament-1-report.pdf','pdf','2026-08-23 11:34:24');
/*!40000 ALTER TABLE `reports_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_constraints`
--

DROP TABLE IF EXISTS `schedule_constraints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `schedule_constraints` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `max_games_per_team_per_day` int(11) DEFAULT 2,
  `min_rest_minutes_between_games` int(11) DEFAULT 120,
  `default_match_duration_minutes` int(11) DEFAULT 40,
  `default_break_minutes` int(11) DEFAULT 15,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_constraint_tournament` (`tournament_id`),
  CONSTRAINT `fk_schedule_constraints_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_constraints`
--

LOCK TABLES `schedule_constraints` WRITE;
/*!40000 ALTER TABLE `schedule_constraints` DISABLE KEYS */;
INSERT INTO `schedule_constraints` VALUES (1,1,2,120,40,15);
/*!40000 ALTER TABLE `schedule_constraints` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `score_corrections`
--

DROP TABLE IF EXISTS `score_corrections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `score_corrections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `match_id` int(11) NOT NULL,
  `original_home_score` int(11) NOT NULL,
  `original_away_score` int(11) NOT NULL,
  `requested_home_score` int(11) NOT NULL,
  `requested_away_score` int(11) NOT NULL,
  `reason` text NOT NULL,
  `supporting_notes` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `requested_by` int(11) NOT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_correction_review` (`status`,`match_id`),
  KEY `match_id` (`match_id`),
  KEY `requested_by` (`requested_by`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `score_corrections_ibfk_1` FOREIGN KEY (`match_id`) REFERENCES `matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `score_corrections_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
  CONSTRAINT `score_corrections_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `score_corrections`
--

LOCK TABLES `score_corrections` WRITE;
/*!40000 ALTER TABLE `score_corrections` DISABLE KEYS */;
INSERT INTO `score_corrections` VALUES (1,1,3,0,4,2,'Validated official score sheet','End-to-end workflow test','approved',2,1,'2026-08-17 12:03:07','2026-08-17 04:03:04');
/*!40000 ALTER TABLE `score_corrections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sports`
--

DROP TABLE IF EXISTS `sports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `category` enum('team','individual','doubles') NOT NULL DEFAULT 'team',
  `min_players_per_team` int(11) NOT NULL DEFAULT 5,
  `max_players_per_team` int(11) NOT NULL DEFAULT 15,
  `default_match_duration_mins` int(11) NOT NULL DEFAULT 40,
  `rules_summary` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sports`
--

LOCK TABLES `sports` WRITE;
/*!40000 ALTER TABLE `sports` DISABLE KEYS */;
INSERT INTO `sports` VALUES (1,'Basketball','team',5,15,40,'FIBA-style basketball: four 10-minute quarters with overtime support.','2026-08-04 12:41:08'),(2,'Volleyball','team',6,14,60,'FIVB Best of 3 sets to 25 points','2026-08-04 12:41:08'),(3,'Badminton','doubles',1,2,30,'BWF 21 points rally scoring','2026-08-04 12:41:08'),(4,'Chess','individual',1,1,45,'FIDE Rapid Swiss / Knockout format','2026-08-04 12:41:08'),(5,'Esports','team',5,7,45,'Mobile Legends / Valorant 5v5 Best of 3','2026-08-04 12:41:08'),(6,'Football','team',11,20,90,'FIFA 90 mins regulation time','2026-08-04 12:41:08'),(7,'Futsal','team',5,12,40,'AMF 5v5 indoor soccer rules','2026-08-04 12:41:08');
/*!40000 ALTER TABLE `sports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `standings`
--

DROP TABLE IF EXISTS `standings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `standings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL,
  `played` int(11) DEFAULT 0,
  `won` int(11) DEFAULT 0,
  `lost` int(11) DEFAULT 0,
  `drawn` int(11) DEFAULT 0,
  `points_scored` int(11) DEFAULT 0,
  `points_against` int(11) DEFAULT 0,
  `net_points` int(11) DEFAULT 0,
  `tournament_points` int(11) DEFAULT 0,
  `rank_position` int(11) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tournament_id` (`tournament_id`),
  KEY `team_id` (`team_id`),
  CONSTRAINT `standings_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `standings_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `standings`
--

LOCK TABLES `standings` WRITE;
/*!40000 ALTER TABLE `standings` DISABLE KEYS */;
INSERT INTO `standings` VALUES (5,1,1,1,1,0,0,4,2,2,3,1,'2026-08-17 04:03:10'),(6,1,2,1,0,1,0,2,4,-2,0,2,'2026-08-17 04:03:10');
/*!40000 ALTER TABLE `standings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_players`
--

DROP TABLE IF EXISTS `team_players`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `team_players` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `team_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `student_id_number` varchar(50) NOT NULL,
  `jersey_number` int(11) DEFAULT NULL,
  `position` varchar(50) DEFAULT NULL,
  `eligibility_status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  `request_type` enum('coach_invitation','player_application') NOT NULL DEFAULT 'coach_invitation',
  `category_id` int(11) DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `team_id` (`team_id`),
  KEY `user_id` (`user_id`),
  KEY `verified_by` (`verified_by`),
  KEY `fk_tp_category` (`category_id`),
  CONSTRAINT `fk_tp_category` FOREIGN KEY (`category_id`) REFERENCES `event_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `team_players_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `team_players_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `team_players_ibfk_3` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_players`
--

LOCK TABLES `team_players` WRITE;
/*!40000 ALTER TABLE `team_players` DISABLE KEYS */;
INSERT INTO `team_players` VALUES (1,1,7,'2023-32623',22,'Point Guard','verified','player_application',NULL,4,'','2026-08-04 20:17:13','2026-08-23 10:56:53'),(2,1,7,'2023-10492',NULL,NULL,'pending','coach_invitation',NULL,NULL,NULL,'2026-08-04 20:18:23','2026-08-04 20:18:23');
/*!40000 ALTER TABLE `team_players` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `teams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tournament_id` int(11) NOT NULL,
  `division_id` int(11) DEFAULT NULL,
  `team_name` varchar(100) NOT NULL,
  `short_name` varchar(20) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `primary_color` char(7) DEFAULT '#F97316',
  `secondary_color` char(7) DEFAULT '#18181B',
  `coach_user_id` int(11) NOT NULL,
  `manager_user_id` int(11) DEFAULT NULL,
  `qr_code_hash` varchar(64) DEFAULT NULL,
  `status` enum('draft','pending_payment','registered','disqualified') NOT NULL DEFAULT 'pending_payment',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_code_hash` (`qr_code_hash`),
  KEY `tournament_id` (`tournament_id`),
  KEY `coach_user_id` (`coach_user_id`),
  KEY `manager_user_id` (`manager_user_id`),
  KEY `idx_teams_division` (`division_id`),
  CONSTRAINT `fk_teams_division` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teams_ibfk_2` FOREIGN KEY (`coach_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teams_ibfk_3` FOREIGN KEY (`manager_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
INSERT INTO `teams` VALUES (1,1,NULL,'MGA IT ',NULL,NULL,'#F97316','#18181B',4,NULL,'cfc069a5ddf23e892122ae930d4e541097e094ecf45a458085666af79f0138c1','registered','2026-08-04 19:57:44','2026-08-04 20:10:28'),(2,1,NULL,'Linaw Ballers','LIN',NULL,'#F97316','#18181B',4,NULL,'b690c3b807478df092704ffaa32a85927c67c62c2289b7316f812a6e20f40992','registered','2026-08-17 04:01:33','2026-08-17 04:01:33');
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tournaments`
--

DROP TABLE IF EXISTS `tournaments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tournaments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `season` varchar(50) DEFAULT NULL,
  `sport_id` int(11) NOT NULL,
  `format` enum('single_elimination','double_elimination','round_robin','group_stage','league') NOT NULL DEFAULT 'single_elimination',
  `seeding_type` enum('automatic','manual') NOT NULL DEFAULT 'automatic',
  `rules` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `registration_deadline` date DEFAULT NULL,
  `registration_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','upcoming','ongoing','completed','cancelled') NOT NULL DEFAULT 'upcoming',
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `sport_id` (`sport_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_tournaments_organization` (`organization_id`),
  CONSTRAINT `fk_tournaments_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournaments_ibfk_1` FOREIGN KEY (`sport_id`) REFERENCES `sports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tournaments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tournaments`
--

LOCK TABLES `tournaments` WRITE;
/*!40000 ALTER TABLE `tournaments` DISABLE KEYS */;
INSERT INTO `tournaments` VALUES (1,1,'Basketball sa Capstone',NULL,1,'double_elimination','automatic','','','2026-08-06','2026-09-30',NULL,100.00,'upcoming',1,2,'2026-08-04 19:53:42','2026-08-17 03:44:19');
/*!40000 ALTER TABLE `tournaments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_faculty_id` varchar(50) DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','finance_officer','player','official','statistician') NOT NULL DEFAULT 'player',
  `department_course` varchar(100) DEFAULT NULL,
  `year_level` varchar(30) DEFAULT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `student_faculty_id` (`student_faculty_id`),
  UNIQUE KEY `uq_users_phone_number` (`phone_number`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'ADM-2026-001','Platform Administrator','admin@','$2y$12$IG/z2hMQQMgkuvtBF9OxKOiWO6WKDtZUCy9CCjnU76qK9D88LNC8a','platform_admin','Sports Office',NULL,NULL,NULL,1,'2026-08-04 12:41:08','2026-08-23 10:56:53'),(2,'ORG-2026-002','Tournament Organizer','organizer@','$2y$12$ZKRbzQnoDU7Cxr2rtdxLhOSKfMR1PJw07nRxSOXOaNypQRsWIVdyu','organization_admin','Sports Office',NULL,NULL,NULL,1,'2026-08-04 12:41:08','2026-08-23 10:56:53'),(4,'COACH-2026-004','Team Coach','coach@','$2y$12$m1nSJxHUHtdkMLux/uSLquMjJKgsQmiRBovy0kRcFRXTLlv3kIV7m','coach','Information Technology',NULL,'09700609670','/uploads/avatars/avatar_4_1787483963.jpg',1,'2026-08-04 12:41:08','2026-08-23 11:19:23'),(7,'2023-10492','Basketball Player','player@','$2y$12$2oUTeMZ77w1krFoUWxvrgean8ilo1t8BQaK/kFaZYeFo8seoLOgMe','player','Information Technology','3rd Year',NULL,NULL,1,'2026-08-04 12:41:08','2026-08-23 10:56:54');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venue_availability`
--

DROP TABLE IF EXISTS `venue_availability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `venue_availability` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `venue_id` int(11) NOT NULL,
  `unavailable_date` date NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_venue_date` (`venue_id`,`unavailable_date`),
  CONSTRAINT `fk_venue_availability_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venue_availability`
--

LOCK TABLES `venue_availability` WRITE;
/*!40000 ALTER TABLE `venue_availability` DISABLE KEYS */;
/*!40000 ALTER TABLE `venue_availability` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venue_blackouts`
--

DROP TABLE IF EXISTS `venue_blackouts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `venue_blackouts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `court_id` int(11) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_court_blackout` (`court_id`,`starts_at`,`ends_at`),
  CONSTRAINT `venue_blackouts_ibfk_1` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venue_blackouts`
--

LOCK TABLES `venue_blackouts` WRITE;
/*!40000 ALTER TABLE `venue_blackouts` DISABLE KEYS */;
/*!40000 ALTER TABLE `venue_blackouts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venues`
--

DROP TABLE IF EXISTS `venues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `venues` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `organization_id` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `location` varchar(150) NOT NULL,
  `operating_hours_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`operating_hours_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_venues_organization` (`organization_id`),
  CONSTRAINT `fk_venues_organization` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venues`
--

LOCK TABLES `venues` WRITE;
/*!40000 ALTER TABLE `venues` DISABLE KEYS */;
INSERT INTO `venues` VALUES (1,NULL,'EVSU-OC Main Gymnasium','Main Campus, Ormoc City',NULL,'2026-08-04 12:41:08'),(2,NULL,'EVSU Athletic Oval & Field','Sports Complex, Ormoc Campus',NULL,'2026-08-04 12:41:08'),(3,NULL,'EVSU Audio-Visual Center','Building B, Ormoc Campus',NULL,'2026-08-04 12:41:08');
/*!40000 ALTER TABLE `venues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'fullcourt_database'
--

--
-- Dumping routines for database 'fullcourt_database'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-23 19:34:26

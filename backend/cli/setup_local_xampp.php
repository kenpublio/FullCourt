<?php

if (PHP_SAPI !== 'cli') exit(1);

require_once __DIR__ . '/../config/database.php';

$db = (new Database())->getConnection();
if (!$db || $db->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'mysql') {
    fwrite(STDERR, "Local XAMPP MySQL is not active.\n");
    exit(1);
}

$schema = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS age_at_registration SMALLINT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_team_name VARCHAR(150) NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS coaching_experience_years SMALLINT NULL",
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT NULL",
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_designation VARCHAR(100) NULL",
    "ALTER TABLE venues ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'",
    "ALTER TABLE venues ADD COLUMN IF NOT EXISTS submitted_by INT NULL",
    "ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_by INT NULL",
    "ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL",
    "ALTER TABLE venues ADD COLUMN IF NOT EXISTS review_notes VARCHAR(500) NULL",
    "ALTER TABLE team_players ADD COLUMN IF NOT EXISTS player_name VARCHAR(150) NULL",
    "ALTER TABLE team_players ADD COLUMN IF NOT EXISTS birth_date DATE NULL",
    "ALTER TABLE team_players ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(150) NULL",
    "ALTER TABLE team_players ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR(80) NULL",
    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS seed INT NULL",
    "ALTER TABLE team_players MODIFY request_type ENUM('coach_invitation','player_application','coach_registration') NOT NULL DEFAULT 'coach_registration'",
    "ALTER TABLE divisions ADD COLUMN IF NOT EXISTS age_cutoff_date DATE NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS declared_birth_date DATE NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS birthdate_match TINYINT(1) NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS mismatch_flag VARCHAR(80) NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS id_type VARCHAR(60) NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS id_number_last4 VARCHAR(4) NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS id_birth_date DATE NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS selfie_path VARCHAR(255) NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS selfie_mime_type VARCHAR(100) NULL",
    "ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS consent_confirmed TINYINT(1) NOT NULL DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS platform_settings (
        id INT PRIMARY KEY,
        maintenance_enabled TINYINT(1) NOT NULL DEFAULT 0,
        maintenance_message VARCHAR(255) NULL,
        registration_enabled TINYINT(1) NOT NULL DEFAULT 1,
        updated_by INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tournament_id INT NULL,
        title VARCHAR(180) NOT NULL,
        message TEXT NOT NULL,
        priority VARCHAR(30) NOT NULL DEFAULT 'normal',
        published_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_announcements_published (published_at, expires_at),
        INDEX idx_announcements_tournament (tournament_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS reminder_30_sent_at DATETIME NULL",
    "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS roster_locked_at DATETIME NULL",
    "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS roster_locked_by INT NULL",
    "ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_status_reason VARCHAR(500) NULL",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_status_updated_by INT NULL",
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_status_updated_at DATETIME NULL",
    "CREATE TABLE IF NOT EXISTS match_officials (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, user_id INT NOT NULL, role VARCHAR(40) NOT NULL, assigned_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_match_official (match_id,user_id,role)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS match_rosters (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, player_id INT NOT NULL, team_id INT NOT NULL, jersey_number VARCHAR(12) NULL, position VARCHAR(50) NULL, is_active TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_match_player (match_id,player_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS game_events (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, event_type VARCHAR(60) NOT NULL, team_id INT NULL, player_id INT NULL, clock_seconds INT NULL, period VARCHAR(20) NULL, detail_json JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_event_match (match_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS game_readiness (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL UNIQUE, venue_ready TINYINT(1) NOT NULL DEFAULT 0, equipment_ready TINYINT(1) NOT NULL DEFAULT 0, home_team_present TINYINT(1) NOT NULL DEFAULT 0, away_team_present TINYINT(1) NOT NULL DEFAULT 0, lineups_confirmed TINYINT(1) NOT NULL DEFAULT 0, officials_ready TINYINT(1) NOT NULL DEFAULT 0, medical_ready TINYINT(1) NOT NULL DEFAULT 0, notes VARCHAR(500) NULL, updated_by INT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS game_incidents (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, incident_type VARCHAR(30) NOT NULL, severity VARCHAR(20) NOT NULL DEFAULT 'low', description VARCHAR(1000) NOT NULL, action_taken VARCHAR(1000) NULL, status VARCHAR(20) NOT NULL DEFAULT 'open', reported_by INT NULL, resolved_by INT NULL, resolved_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_incident_match_status (match_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS fouls (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, player_id INT NOT NULL, team_id INT NOT NULL, foul_type VARCHAR(40) NOT NULL, recorded_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_foul_match (match_id,team_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS timeouts (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, team_id INT NOT NULL, timeout_number INT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', duration_seconds INT NOT NULL DEFAULT 60, recorded_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_timeout (match_id,team_id,timeout_number)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS substitutions (id BIGINT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, team_id INT NOT NULL, player_in_id INT NOT NULL, player_out_id INT NOT NULL, period VARCHAR(20) NULL, clock_seconds INT NULL, recorded_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS game_scoring_links (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        match_id INT NOT NULL,
        created_by INT NOT NULL,
        operator_label VARCHAR(120) NOT NULL,
        operator_name VARCHAR(120) NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        pin_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        last_used_at DATETIME NULL,
        revoked_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_scoring_link_match_active (match_id, expires_at, revoked_at),
        CONSTRAINT fk_scoring_link_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        CONSTRAINT fk_scoring_link_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

foreach ($schema as $statement) $db->exec($statement);
$db->exec("INSERT INTO platform_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id");
$db->exec("UPDATE venues SET approval_status='approved' WHERE approval_status IS NULL OR approval_status='pending'");

$accounts = [
    'platform_admin' => 'platform.admin@fullcourt.local',
    'coach' => 'demo.coach01@fullcourt.local',
    'statistician' => 'demo.staffadmin01@fullcourt.local',
];
$passwordHash = password_hash('FullCourt2026!', PASSWORD_BCRYPT);
$find = $db->prepare("SELECT id FROM users WHERE role=:role ORDER BY id LIMIT 1");
$update = $db->prepare("UPDATE users SET email=:email,password_hash=:password,is_active=1 WHERE id=:id");
$insert = $db->prepare("INSERT INTO users (full_name,email,password_hash,role,is_active) VALUES (:full_name,:email,:password,:role,1)");
foreach ($accounts as $role => $email) {
    $find->execute([':role' => $role]);
    $id = $find->fetchColumn();
    if ($id) {
        $update->execute([':email' => $email, ':password' => $passwordHash, ':id' => $id]);
    } else {
        $name = $role === 'statistician' ? 'Demo Staff Admin' : ($role === 'coach' ? 'Demo Coach' : 'Platform Administrator');
        $insert->execute([':full_name'=>$name, ':email'=>$email, ':password'=>$passwordHash, ':role'=>$role]);
    }
}

echo json_encode([
    'database' => 'fullcourt_database',
    'driver' => 'mysql',
    'accounts_ready' => array_values($accounts),
], JSON_PRETTY_PRINT) . PHP_EOL;

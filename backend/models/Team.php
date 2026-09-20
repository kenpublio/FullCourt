<?php
// backend/models/Team.php

require_once __DIR__ . '/../config/database.php';

class Team {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getByTournament(int $tournamentId): array {
        $sql = "SELECT tm.*, u.full_name as coach_name, u.email as coach_email, t.name as tournament_name, t.seeding_type,
                (SELECT COUNT(*) FROM team_players WHERE team_id = tm.id) as total_players,
                (SELECT COUNT(*) FROM team_players WHERE team_id = tm.id AND eligibility_status = 'verified') as verified_players
                FROM teams tm
                JOIN users u ON tm.coach_user_id = u.id
                JOIN tournaments t ON tm.tournament_id = t.id
                WHERE tm.tournament_id = :tournamentId
                ORDER BY CASE WHEN t.seeding_type = 'manual' THEN COALESCE(tm.seed, 9999) ELSE tm.id END";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':tournamentId' => $tournamentId]);
        return $stmt->fetchAll();
    }

    public function getAll(): array {
        $sql = "SELECT tm.*, u.full_name as coach_name, t.name as tournament_name, s.name as sport_name, d.name AS division_name,
                (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = tm.id AND tp.eligibility_status = 'verified') AS total_players
                FROM teams tm
                JOIN users u ON tm.coach_user_id = u.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                LEFT JOIN divisions d ON d.id = tm.division_id
                ORDER BY tm.id DESC";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }

    public function getForCoach(int $userId): array {
        $sql = "SELECT tm.*, u.full_name AS coach_name, t.name AS tournament_name, s.name AS sport_name, d.name AS division_name,
                       (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = tm.id AND tp.eligibility_status = 'verified') AS total_players
                FROM teams tm
                JOIN users u ON tm.coach_user_id = u.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                LEFT JOIN divisions d ON d.id = tm.division_id
                WHERE tm.coach_user_id = :coachId OR tm.manager_user_id = :managerId
                ORDER BY tm.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':coachId' => $userId, ':managerId' => $userId]);
        return $stmt->fetchAll();
    }

    public function getForOrganizationUser(int $userId): array {
        $sql = "SELECT DISTINCT tm.*, coach.full_name AS coach_name, t.name AS tournament_name, s.name AS sport_name, d.name AS division_name,
                       (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id = tm.id AND tp.eligibility_status = 'verified') AS total_players
                FROM teams tm
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN organization_members om ON om.organization_id = t.organization_id
                    AND om.user_id = :userId AND om.status = 'active'
                JOIN organizations o ON o.id = om.organization_id AND o.status = 'active'
                JOIN users coach ON tm.coach_user_id = coach.id
                JOIN sports s ON t.sport_id = s.id
                LEFT JOIN divisions d ON d.id = tm.division_id
                ORDER BY tm.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $sql = "SELECT tm.*, u.full_name as coach_name, t.name as tournament_name
                FROM teams tm
                JOIN users u ON tm.coach_user_id = u.id
                JOIN tournaments t ON tm.tournament_id = t.id
                WHERE tm.id = :id LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $team = $stmt->fetch();
        return $team ?: null;
    }

    public function create(array $data): int {
        $qrHash = hash('sha256', $data['team_name'] . '_' . time() . '_' . rand(1000, 9999));
        $sql = "INSERT INTO teams (tournament_id, division_id, team_name, short_name, primary_color, secondary_color, logo_url, coach_user_id, manager_user_id, qr_code_hash, status)
                VALUES (:tournament_id, :division_id, :team_name, :short_name, :primary_color, :secondary_color, :logo_url, :coach_user_id, :manager_user_id, :qr_code_hash, :status)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':tournament_id' => $data['tournament_id'],
            ':division_id' => $data['division_id'] ?? null,
            ':team_name' => $data['team_name'],
            ':short_name' => $data['short_name'] ?? null,
            ':primary_color' => $data['primary_color'] ?? '#F97316',
            ':secondary_color' => $data['secondary_color'] ?? '#18181B',
            ':logo_url' => $data['logo_url'] ?? null,
            ':coach_user_id' => $data['coach_user_id'],
            ':manager_user_id' => $data['manager_user_id'] ?? null,
            ':qr_code_hash' => $qrHash,
            ':status' => $data['status'] ?? 'registered'
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function updateStatus(int $id, string $status): bool {
        $stmt = $this->db->prepare("UPDATE teams SET status = :status WHERE id = :id");
        return $stmt->execute([':status' => $status, ':id' => $id]);
    }

    public function update(int $id, array $data): bool {
        $sql = "UPDATE teams SET tournament_id = :tournament_id, division_id = :division_id,
                team_name = :team_name, short_name = :short_name, primary_color = :primary_color
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            ':tournament_id' => $data['tournament_id'],
            ':division_id' => $data['division_id'] ?? null,
            ':team_name' => $data['team_name'],
            ':short_name' => $data['short_name'] ?? null,
            ':primary_color' => $data['primary_color'] ?? '#F97316',
            ':id' => $id
        ]);
    }

    public function hasMatches(int $id): bool {
        $stmt = $this->db->prepare("SELECT id FROM matches WHERE team1_id = :team1 OR team2_id = :team2 LIMIT 1");
        $stmt->execute([':team1' => $id, ':team2' => $id]);
        return (bool) $stmt->fetch();
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM teams WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function updateLogo(int $id, string $url): bool {
        $stmt = $this->db->prepare("UPDATE teams SET logo_url = :url WHERE id = :id");
        return $stmt->execute([':url' => $url, ':id' => $id]);
    }

    public function setSeed(int $id, ?int $seed): bool {
        $stmt = $this->db->prepare("UPDATE teams SET seed = :seed WHERE id = :id");
        return $stmt->execute([':seed' => $seed, ':id' => $id]);
    }
}

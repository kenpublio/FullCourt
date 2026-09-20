<?php
// backend/models/Tournament.php

require_once __DIR__ . '/../config/database.php';

class Tournament {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAll(?int $userId = null, bool $platform = false): array {
        $sql = "SELECT t.*, s.name as sport_name, s.category as sport_category, u.full_name as organizer_name,
                (SELECT COUNT(*) FROM teams WHERE tournament_id = t.id) as registered_teams_count
                FROM tournaments t
                JOIN sports s ON t.sport_id = s.id
                JOIN users u ON t.created_by = u.id
                WHERE LOWER(s.name) = 'basketball'";
        if (!$platform && $userId !== null) {
            $sql .= " AND (t.created_by=:user_id OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=t.organization_id AND om.user_id=:member_id AND om.status='active') OR EXISTS (SELECT 1 FROM teams own_tm LEFT JOIN team_players own_tp ON own_tp.team_id=own_tm.id WHERE own_tm.tournament_id=t.id AND (own_tm.coach_user_id=:coach_id OR own_tm.manager_user_id=:manager_id OR own_tp.user_id=:player_id)))";
        }
        $sql .= "
                ORDER BY t.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(!$platform && $userId !== null ? [':user_id'=>$userId,':member_id'=>$userId,':coach_id'=>$userId,':manager_id'=>$userId,':player_id'=>$userId] : []);
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $sql = "SELECT t.*, s.name as sport_name, s.category as sport_category, u.full_name as organizer_name
                FROM tournaments t
                JOIN sports s ON t.sport_id = s.id
                JOIN users u ON t.created_by = u.id
                WHERE t.id = :id AND LOWER(s.name) = 'basketball' LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int {
        $sql = "INSERT INTO tournaments (organization_id,name, sport_id, format, rules, description, start_date, end_date, registration_fee, status, created_by)
                VALUES (:organization_id,:name, :sport_id, :format, :rules, :description, :start_date, :end_date, :registration_fee, :status, :created_by)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':organization_id' => $data['organization_id'] ?? null,
            ':name' => $data['name'],
            ':sport_id' => $data['sport_id'],
            ':format' => $data['format'] ?? 'single_elimination',
            ':rules' => $data['rules'] ?? null,
            ':description' => $data['description'] ?? null,
            ':start_date' => $data['start_date'],
            ':end_date' => $data['end_date'],
            ':registration_fee' => $data['registration_fee'] ?? 0.00,
            ':status' => $data['status'] ?? 'upcoming',
            ':created_by' => $data['created_by']
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool {
        $sql = "UPDATE tournaments 
                SET name = :name, sport_id = :sport_id, format = :format, rules = :rules, 
                    description = :description, start_date = :start_date, end_date = :end_date, 
                    registration_fee = :registration_fee, status = :status
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            ':name' => $data['name'],
            ':sport_id' => $data['sport_id'],
            ':format' => $data['format'],
            ':rules' => $data['rules'] ?? null,
            ':description' => $data['description'] ?? null,
            ':start_date' => $data['start_date'],
            ':end_date' => $data['end_date'],
            ':registration_fee' => $data['registration_fee'] ?? 0.00,
            ':status' => $data['status'],
            ':id' => $id
        ]);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM tournaments WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function getSports(): array {
        $stmt = $this->db->query("SELECT * FROM sports WHERE LOWER(name) = 'basketball' ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    public function getBasketballSportId(): ?int {
        $stmt = $this->db->query("SELECT id FROM sports WHERE LOWER(name) = 'basketball' LIMIT 1");
        $id = $stmt->fetchColumn();
        return $id === false ? null : (int) $id;
    }
}

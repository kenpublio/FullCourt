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
                (SELECT COUNT(*) FROM teams WHERE tournament_id = t.id AND status = 'registered') as registered_teams_count
                FROM tournaments t
                JOIN sports s ON t.sport_id = s.id
                JOIN users u ON t.created_by = u.id
                WHERE LOWER(s.name) = 'basketball'";
        if (!$platform && $userId !== null) {
            $sql .= " AND (t.approval_status='approved' OR t.created_by=:creator_id)";
            $sql .= " AND (t.created_by=:user_id OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=t.organization_id AND om.user_id=:member_id AND om.status='active') OR EXISTS (SELECT 1 FROM teams own_tm LEFT JOIN team_players own_tp ON own_tp.team_id=own_tm.id WHERE own_tm.tournament_id=t.id AND (own_tm.coach_user_id=:coach_id OR own_tm.manager_user_id=:manager_id OR own_tp.user_id=:player_id)))";
        }
        $sql .= "
                ORDER BY t.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(!$platform && $userId !== null ? [':creator_id'=>$userId,':user_id'=>$userId,':member_id'=>$userId,':coach_id'=>$userId,':manager_id'=>$userId,':player_id'=>$userId] : []);
        return $stmt->fetchAll();
    }

    public function getAvailableForCoach(int $userId): array {
        $sql = "SELECT t.*, s.name AS sport_name, s.category AS sport_category, u.full_name AS organizer_name,
                (SELECT COUNT(*) FROM teams rt WHERE rt.tournament_id=t.id AND rt.status='registered') AS registered_teams_count,
                coach_team.id AS application_team_id, coach_team.team_name AS application_team_name,
                coach_team.status AS application_status
                FROM tournaments t
                JOIN sports s ON t.sport_id=s.id
                JOIN users u ON t.created_by=u.id
                LEFT JOIN teams coach_team ON coach_team.tournament_id=t.id
                  AND (coach_team.coach_user_id=:coach_id OR coach_team.manager_user_id=:manager_id)
                WHERE LOWER(s.name)='basketball'
                  AND t.approval_status='approved'
                  AND (t.status IN ('upcoming','ongoing') OR coach_team.id IS NOT NULL)
                ORDER BY CASE WHEN coach_team.id IS NOT NULL THEN 0 ELSE 1 END, t.start_date ASC";
        $stmt=$this->db->prepare($sql);
        $stmt->execute([':coach_id'=>$userId,':manager_id'=>$userId]);
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

    public function canUseCourts(array $courtIds, int $organizationId, int $basketballSportId): bool {
        if (!$courtIds || !$organizationId) return false;
        $placeholders=implode(',',array_fill(0,count($courtIds),'?'));
        $stmt=$this->db->prepare("SELECT COUNT(DISTINCT c.id) FROM courts c JOIN venues v ON v.id=c.venue_id WHERE c.id IN ({$placeholders}) AND c.is_available=1 AND (c.sport_id IS NULL OR c.sport_id=?) AND v.organization_id=? AND v.approval_status='approved'");
        $stmt->execute([...$courtIds,$basketballSportId,$organizationId]);
        return (int)$stmt->fetchColumn()===count(array_unique($courtIds));
    }

    public function create(array $data): int {
        $sql = "INSERT INTO tournaments (organization_id,name, sport_id, format, rules, description, start_date, end_date, registration_fee, status, approval_status, created_by)
                VALUES (:organization_id,:name, :sport_id, :format, :rules, :description, :start_date, :end_date, :registration_fee, 'upcoming', 'pending', :created_by)";
        $this->db->beginTransaction();
        try {
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
            ':created_by' => $data['created_by']
          ]);
          $id=(int)$this->db->lastInsertId();
          if (!empty($data['court_ids'])) {
            $link=$this->db->prepare('INSERT INTO tournament_courts (tournament_id,court_id) VALUES (:tournament_id,:court_id)');
            foreach (array_unique(array_map('intval',$data['court_ids'])) as $courtId) {
              $link->execute([':tournament_id'=>$id,':court_id'=>$courtId]);
            }
          }
          $this->db->commit();
          return $id;
        } catch (Throwable $error) {
          if ($this->db->inTransaction()) $this->db->rollBack();
          throw $error;
        }
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

    public function review(int $id, string $status, int $reviewerId, ?string $notes): bool {
        $stmt = $this->db->prepare("UPDATE tournaments
            SET approval_status=:status, approval_notes=:notes, reviewed_by=:reviewer,
                reviewed_at=NOW(), is_published=CASE WHEN :published_status='approved' THEN 1 ELSE 0 END
            WHERE id=:id AND approval_status='pending'");
        return $stmt->execute([
            ':status' => $status,
            ':notes' => $notes,
            ':reviewer' => $reviewerId,
            ':published_status' => $status,
            ':id' => $id,
        ]) && $stmt->rowCount() === 1;
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

<?php
// backend/models/TeamPlayer.php

require_once __DIR__ . '/../config/database.php';

class TeamPlayer {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getByTeam(int $teamId): array {
        $sql = "SELECT tp.*, u.full_name, u.email, u.phone_number, u.avatar_url, u.department_course, v.full_name as verifier_name
                FROM team_players tp
                LEFT JOIN users u ON tp.user_id = u.id
                LEFT JOIN users v ON tp.verified_by = v.id
                WHERE tp.team_id = :teamId
                  AND NOT (tp.eligibility_status = 'pending' AND tp.user_id IS NOT NULL
                    AND EXISTS (SELECT 1 FROM team_players verified
                      WHERE verified.team_id = tp.team_id AND verified.user_id = tp.user_id
                        AND verified.eligibility_status = 'verified'))
                ORDER BY tp.id DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':teamId' => $teamId]);
        return $stmt->fetchAll();
    }

    public function getAllPending(): array {
        $sql = "SELECT tp.*, tm.team_name, t.name as tournament_name, s.name as sport_name,
                u.full_name as user_full_name, u.email as user_email, u.phone_number as user_phone
                FROM team_players tp
                JOIN teams tm ON tp.team_id = tm.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE NOT (tp.eligibility_status='pending' AND tp.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_players verified WHERE verified.team_id=tp.team_id AND verified.user_id=tp.user_id AND verified.eligibility_status='verified'))
                ORDER BY tp.created_at ASC";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }

    public function getForCoach(int $coachId): array {
        $sql = "SELECT tp.*, tm.team_name, t.name AS tournament_name, s.name AS sport_name,
                       u.full_name AS user_full_name, u.email AS user_email, u.phone_number AS user_phone
                FROM team_players tp
                JOIN teams tm ON tp.team_id = tm.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                LEFT JOIN users u ON tp.user_id = u.id
                WHERE (tm.coach_user_id = :coachId OR tm.manager_user_id = :managerId)
                  AND NOT (tp.eligibility_status='pending' AND tp.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_players verified WHERE verified.team_id=tp.team_id AND verified.user_id=tp.user_id AND verified.eligibility_status='verified'))
                ORDER BY tp.created_at ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':coachId' => $coachId, ':managerId' => $coachId]);
        return $stmt->fetchAll();
    }

    public function getForOrganizationUser(int $userId): array {
        $sql = "SELECT DISTINCT tp.*,tm.team_name,t.name AS tournament_name,s.name AS sport_name,
                       u.full_name AS user_full_name,u.email AS user_email,u.phone_number AS user_phone
                FROM organization_members om
                JOIN organizations o ON o.id=om.organization_id AND o.status='active'
                JOIN tournaments t ON t.organization_id=o.id
                JOIN teams tm ON tm.tournament_id=t.id
                JOIN team_players tp ON tp.team_id=tm.id
                JOIN sports s ON t.sport_id=s.id
                LEFT JOIN users u ON u.id=tp.user_id
                WHERE om.user_id=:user_id AND om.status='active'
                  AND NOT (tp.eligibility_status='pending' AND tp.user_id IS NOT NULL AND EXISTS
                    (SELECT 1 FROM team_players verified WHERE verified.team_id=tp.team_id
                     AND verified.user_id=tp.user_id AND verified.eligibility_status='verified'))
                ORDER BY tp.created_at ASC";
        $stmt=$this->db->prepare($sql);$stmt->execute([':user_id'=>$userId]);return$stmt->fetchAll();
    }

    public function getTournamentId(int $playerRecordId): ?int {
        $stmt=$this->db->prepare("SELECT tm.tournament_id FROM team_players tp JOIN teams tm ON tm.id=tp.team_id WHERE tp.id=:id");
        $stmt->execute([':id'=>$playerRecordId]);$id=$stmt->fetchColumn();return$id===false?null:(int)$id;
    }

    public function belongsToCoach(int $playerRecordId, int $coachId): bool {
        $stmt = $this->db->prepare("SELECT tp.id FROM team_players tp JOIN teams tm ON tp.team_id = tm.id WHERE tp.id = :id AND (tm.coach_user_id = :coachId OR tm.manager_user_id = :managerId) LIMIT 1");
        $stmt->execute([':id' => $playerRecordId, ':coachId' => $coachId, ':managerId' => $coachId]);
        return (bool) $stmt->fetch();
    }

    public function getMembershipForUser(int $userId): ?array {
        $sql = "SELECT tp.id, tp.team_id, tp.eligibility_status, tp.jersey_number, tp.position,
                       tm.team_name, tm.status AS team_status, t.id AS tournament_id,
                       t.name AS tournament_name, s.name AS sport_name
                FROM team_players tp
                JOIN teams tm ON tp.team_id = tm.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                WHERE tp.user_id = :userId
                  AND (tp.eligibility_status = 'verified' OR (tp.eligibility_status='pending' AND tp.remarks LIKE 'Player accepted%'))
                ORDER BY tp.created_at DESC
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        $membership = $stmt->fetch();
        return $membership ?: null;
    }

    public function getInvitationsForUser(int $userId): array {
        $sql = "SELECT tp.id, tp.team_id, tp.eligibility_status, tp.created_at,
                       tm.team_name, t.name AS tournament_name, s.name AS sport_name,
                       coach.full_name AS coach_name
                FROM team_players tp
                JOIN teams tm ON tp.team_id = tm.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                JOIN users coach ON tm.coach_user_id = coach.id
                WHERE tp.user_id = :userId AND tp.eligibility_status = 'pending'
                  AND COALESCE(tp.remarks,'') NOT LIKE 'Player accepted%'
                ORDER BY tp.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        return $stmt->fetchAll();
    }

    public function findInvitation(int $id, int $userId): ?array {
        $stmt = $this->db->prepare("SELECT * FROM team_players WHERE id = :id AND user_id = :userId AND eligibility_status = 'pending' AND COALESCE(remarks,'') NOT LIKE 'Player accepted%' LIMIT 1");
        $stmt->execute([':id' => $id, ':userId' => $userId]);
        $invitation = $stmt->fetch();
        return $invitation ?: null;
    }

    public function respondToInvitation(int $id, int $userId, bool $accept): bool {
        $status = $accept ? 'pending' : 'rejected';
        $stmt = $this->db->prepare("UPDATE team_players SET eligibility_status = :status, remarks = :remarks WHERE id = :id AND user_id = :userId AND eligibility_status = 'pending'");
        return $stmt->execute([
            ':status' => $status,
            ':remarks' => $accept ? 'Player accepted the invitation. Identity verification is still required.' : 'Player declined the team invitation.',
            ':id' => $id,
            ':userId' => $userId
        ]);
    }

    public function hasActiveInvitation(int $teamId, int $userId): bool {
        $stmt = $this->db->prepare("SELECT id FROM team_players WHERE team_id = :teamId AND user_id = :userId AND eligibility_status IN ('pending', 'verified') LIMIT 1");
        $stmt->execute([':teamId' => $teamId, ':userId' => $userId]);
        return (bool) $stmt->fetch();
    }

    public function addPlayer(array $data): int {
        $sql = "INSERT INTO team_players (team_id, user_id, student_id_number, jersey_number, position, eligibility_status, request_type)
                VALUES (:team_id, :user_id, :student_id_number, :jersey_number, :position, 'pending', 'coach_invitation')";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':team_id' => $data['team_id'],
            ':user_id' => $data['user_id'] ?? null,
            ':student_id_number' => $data['student_id_number'],
            ':jersey_number' => $data['jersey_number'] ?? null,
            ':position' => $data['position'] ?? null
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function updateEligibility(int $id, string $status, int $verifierId, ?string $remarks): bool {
        if ($status === 'verified') {
            $identity=$this->db->prepare("SELECT id,birthdate_match,status FROM eligibility_documents WHERE team_player_id=:id AND document_type='Identity Verification' ORDER BY created_at DESC LIMIT 1");
            $identity->execute([':id'=>$id]);$identityRow=$identity->fetch();
            if(!$identityRow||$identityRow['status']!=='verified')throw new InvalidArgumentException('Verification blocked: review and verify the player ID and live selfie first.');
            if($identityRow['birthdate_match']!==true&&$identityRow['birthdate_match']!==1)throw new InvalidArgumentException('Verification blocked: the ID birthdate does not match the registered player birthdate.');
            $eligibility = $this->ageEligibility($id);
            if (!$eligibility['qualified']) {
                throw new InvalidArgumentException($eligibility['message']);
            }
            $remarks = trim(($remarks ? $remarks . ' ' : '') . $eligibility['message']);
        }
        $sql = "UPDATE team_players SET eligibility_status = :status, verified_by = :verifierId, remarks = :remarks WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':status' => $status,
            ':verifierId' => $verifierId,
            ':remarks' => $remarks,
            ':id' => $id
        ]);

        // Insert into eligibility_logs
        $logSql = "INSERT INTO eligibility_logs (team_player_id, action_by, status, remarks) VALUES (:tp_id, :action_by, :status, :remarks)";
        $logStmt = $this->db->prepare($logSql);
        $logStmt->execute([
            ':tp_id' => $id,
            ':action_by' => $verifierId,
            ':status' => $status,
            ':remarks' => $remarks
        ]);

        return true;
    }

    public function ageEligibility(int $id): array {
        $stmt = $this->db->prepare("SELECT pp.birth_date,d.min_age,d.max_age,t.start_date
            FROM team_players tp JOIN teams tm ON tm.id=tp.team_id
            JOIN tournaments t ON t.id=tm.tournament_id
            LEFT JOIN divisions d ON d.id=tm.division_id AND d.tournament_id=t.id
            LEFT JOIN player_profiles pp ON pp.user_id=tp.user_id WHERE tp.id=:id");
        $stmt->execute([':id'=>$id]);
        $row = $stmt->fetch();
        if (!$row) return ['qualified'=>false,'message'=>'Player roster record was not found.'];
        if ($row['min_age'] === null && $row['max_age'] === null) {
            return ['qualified'=>true,'message'=>'No division age restriction applies.'];
        }
        if (empty($row['birth_date'])) {
            return ['qualified'=>false,'message'=>'Verification blocked: the player must provide a birthdate for this age-restricted division.'];
        }
        $reference = new DateTimeImmutable($row['start_date'] ?: 'today');
        $age = (new DateTimeImmutable($row['birth_date']))->diff($reference)->y;
        $minimum = $row['min_age'] === null ? 0 : (int)$row['min_age'];
        $maximum = $row['max_age'] === null ? 200 : (int)$row['max_age'];
        if ($age < $minimum || $age > $maximum) {
            return ['qualified'=>false,'age'=>$age,'message'=>"Verification blocked: age {$age} is outside the allowed {$minimum}-{$maximum} range on tournament start date."];
        }
        return ['qualified'=>true,'age'=>$age,'message'=>"Age verified automatically: {$age} years old on tournament start date."];
    }

    public function updateRosterDetails(int $id, ?int $jerseyNumber, ?string $position): bool {
        $stmt = $this->db->prepare("UPDATE team_players SET jersey_number = :jersey, position = :position WHERE id = :id");
        return $stmt->execute([
            ':jersey' => $jerseyNumber,
            ':position' => $position ?: null,
            ':id' => $id
        ]);
    }
}

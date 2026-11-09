<?php
// backend/models/Tournament.php

require_once __DIR__ . '/../config/database.php';

class Tournament {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAll(?int $userId = null, bool $platform = false, bool $assignedStaffOnly = false): array {
        $sql = "SELECT t.*, s.name as sport_name, s.category as sport_category, u.full_name as organizer_name,
                (SELECT COUNT(*) FROM teams WHERE tournament_id = t.id AND status = 'registered') as registered_teams_count,
                (SELECT tsa.user_id FROM tournament_staff_assignments tsa WHERE tsa.tournament_id=t.id ORDER BY CASE WHEN tsa.assignment_role='primary' THEN 0 ELSE 1 END,tsa.created_at LIMIT 1) AS assigned_staff_id,
                (SELECT su.full_name FROM tournament_staff_assignments tsa JOIN users su ON su.id=tsa.user_id WHERE tsa.tournament_id=t.id ORDER BY CASE WHEN tsa.assignment_role='primary' THEN 0 ELSE 1 END,tsa.created_at LIMIT 1) AS assigned_staff_name,
                (SELECT COUNT(*) FROM tournament_courts tc WHERE tc.tournament_id=t.id) AS readiness_courts,
                (SELECT COUNT(*) FROM matches rm WHERE rm.tournament_id=t.id) AS readiness_matches,
                (SELECT COUNT(*) FROM matches rm WHERE rm.tournament_id=t.id AND rm.team1_id IS NOT NULL AND rm.team2_id IS NOT NULL AND (rm.scheduled_start_time IS NULL OR rm.court_id IS NULL)) AS readiness_unscheduled,
                (SELECT sc.daily_start_time FROM schedule_constraints sc WHERE sc.tournament_id=t.id LIMIT 1) AS schedule_start_time,
                (SELECT sc.daily_end_time FROM schedule_constraints sc WHERE sc.tournament_id=t.id LIMIT 1) AS schedule_end_time,
                (SELECT sc.max_games_per_team_per_day FROM schedule_constraints sc WHERE sc.tournament_id=t.id LIMIT 1) AS max_games_per_team_per_day,
                (SELECT tc.court_id FROM tournament_courts tc WHERE tc.tournament_id=t.id ORDER BY tc.court_id LIMIT 1) AS schedule_court_id,
                (SELECT c.court_name FROM tournament_courts tc JOIN courts c ON c.id=tc.court_id WHERE tc.tournament_id=t.id ORDER BY tc.court_id LIMIT 1) AS schedule_court_name,
                (SELECT v.name FROM tournament_courts tc JOIN courts c ON c.id=tc.court_id JOIN venues v ON v.id=c.venue_id WHERE tc.tournament_id=t.id ORDER BY tc.court_id LIMIT 1) AS schedule_venue_name
                FROM tournaments t
                JOIN sports s ON t.sport_id = s.id
                JOIN users u ON t.created_by = u.id
                WHERE LOWER(s.name) = 'basketball' AND t.archived_at IS NULL";
        if ($assignedStaffOnly && $userId !== null) {
            $sql .= " AND EXISTS (SELECT 1 FROM tournament_staff_assignments tsa_scope WHERE tsa_scope.tournament_id=t.id AND tsa_scope.user_id=:assigned_staff_id)";
        } elseif (!$platform && $userId !== null) {
            $sql .= " AND (t.approval_status='approved' OR t.created_by=:creator_id)";
            $sql .= " AND (t.created_by=:user_id OR EXISTS (SELECT 1 FROM tournament_staff_assignments tsa_access WHERE tsa_access.tournament_id=t.id AND tsa_access.user_id=:staff_id) OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=t.organization_id AND om.user_id=:member_id AND om.status='active') OR EXISTS (SELECT 1 FROM teams own_tm LEFT JOIN team_players own_tp ON own_tp.team_id=own_tm.id WHERE own_tm.tournament_id=t.id AND (own_tm.coach_user_id=:coach_id OR own_tm.manager_user_id=:manager_id OR own_tp.user_id=:player_id)))";
        }
        $sql .= "
                ORDER BY t.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $params = $assignedStaffOnly && $userId !== null
            ? [':assigned_staff_id'=>$userId]
            : (!$platform && $userId !== null ? [':creator_id'=>$userId,':user_id'=>$userId,':staff_id'=>$userId,':member_id'=>$userId,':coach_id'=>$userId,':manager_id'=>$userId,':player_id'=>$userId] : []);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function getAvailableForCoach(int $userId): array {
        $sql = "SELECT t.*, s.name AS sport_name, s.category AS sport_category, u.full_name AS organizer_name,
                (SELECT COUNT(*) FROM teams rt WHERE rt.tournament_id=t.id AND rt.status='registered') AS registered_teams_count,
                (SELECT ct.id FROM teams ct
                  WHERE ct.tournament_id=t.id
                    AND (ct.coach_user_id=:application_coach_id OR ct.manager_user_id=:application_manager_id)
                  ORDER BY ct.id DESC LIMIT 1) AS application_team_id,
                (SELECT ct.team_name FROM teams ct
                  WHERE ct.tournament_id=t.id
                    AND (ct.coach_user_id=:name_coach_id OR ct.manager_user_id=:name_manager_id)
                  ORDER BY ct.id DESC LIMIT 1) AS application_team_name,
                (SELECT ct.status FROM teams ct
                  WHERE ct.tournament_id=t.id
                    AND (ct.coach_user_id=:status_coach_id OR ct.manager_user_id=:status_manager_id)
                  ORDER BY ct.id DESC LIMIT 1) AS application_status
                FROM tournaments t
                JOIN sports s ON t.sport_id=s.id
                JOIN users u ON t.created_by=u.id
                WHERE LOWER(s.name)='basketball' AND t.archived_at IS NULL
                  AND t.approval_status='approved'
                  AND (t.status IN ('upcoming','ongoing') OR EXISTS (
                    SELECT 1 FROM teams access_team
                    WHERE access_team.tournament_id=t.id
                      AND (access_team.coach_user_id=:access_coach_id OR access_team.manager_user_id=:access_manager_id)
                  ))
                ORDER BY CASE WHEN EXISTS (
                    SELECT 1 FROM teams sort_team
                    WHERE sort_team.tournament_id=t.id
                      AND (sort_team.coach_user_id=:sort_coach_id OR sort_team.manager_user_id=:sort_manager_id)
                  ) THEN 0 ELSE 1 END, t.start_date ASC";
        $stmt=$this->db->prepare($sql);
        $stmt->execute([
            ':application_coach_id'=>$userId, ':application_manager_id'=>$userId,
            ':name_coach_id'=>$userId, ':name_manager_id'=>$userId,
            ':status_coach_id'=>$userId, ':status_manager_id'=>$userId,
            ':access_coach_id'=>$userId, ':access_manager_id'=>$userId,
            ':sort_coach_id'=>$userId, ':sort_manager_id'=>$userId,
        ]);
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
        if (!$courtIds) return false;
        $placeholders=implode(',',array_fill(0,count($courtIds),'?'));
        $organizationFilter=$organizationId>0?' AND v.organization_id=?':'';
        $stmt=$this->db->prepare("SELECT COUNT(DISTINCT c.id) FROM courts c JOIN venues v ON v.id=c.venue_id WHERE c.id IN ({$placeholders}) AND c.is_available=1 AND v.approval_status IN ('approved','pending'){$organizationFilter}");
        $params=[...$courtIds];if($organizationId>0)$params[]=$organizationId;$stmt->execute($params);
        return (int)$stmt->fetchColumn()===count(array_unique($courtIds));
    }

    public function create(array $data): int {
        $sql = "INSERT INTO tournaments (organization_id,name, sport_id, format, rules, description, start_date, end_date, registration_deadline, registration_fee, status, approval_status, is_published, operation_mode, created_by)
                VALUES (:organization_id,:name, :sport_id, :format, :rules, :description, :start_date, :end_date, :registration_deadline, :registration_fee, 'upcoming', :approval_status, :is_published, :operation_mode, :created_by)";
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
            ':registration_deadline' => $data['registration_deadline'] ?? $data['start_date'],
            ':registration_fee' => $data['registration_fee'] ?? 0.00,
            ':approval_status' => $data['approval_status'] ?? 'approved',
            ':is_published' => !empty($data['is_published']) ? 1 : 0,
            ':operation_mode' => $data['operation_mode'] ?? 'official',
            ':created_by' => $data['created_by']
          ]);
          $id=(int)$this->db->lastInsertId();
          if (!empty($data['court_ids'])) {
            $link=$this->db->prepare('INSERT INTO tournament_courts (tournament_id,court_id) VALUES (:tournament_id,:court_id)');
            foreach (array_unique(array_map('intval',$data['court_ids'])) as $courtId) {
              $link->execute([':tournament_id'=>$id,':court_id'=>$courtId]);
            }
          }
          $constraints=$this->db->prepare('INSERT INTO schedule_constraints (tournament_id,max_games_per_team_per_day,min_rest_minutes_between_games,default_match_duration_minutes,default_break_minutes,daily_start_time,daily_end_time,available_weekdays) VALUES (:tournament_id,:max_games,:rest_minutes,:match_minutes,:break_minutes,:daily_start,:daily_end,:available_weekdays)');
          $constraints->execute([
            ':tournament_id'=>$id,
            ':max_games'=>(int)($data['max_games_per_team_per_day']??2),
            ':rest_minutes'=>(int)($data['min_rest_minutes_between_games']??120),
            ':match_minutes'=>(int)($data['default_match_duration_minutes']??90),
            ':break_minutes'=>(int)($data['default_break_minutes']??15),
            ':daily_start'=>$data['schedule_start_time']??'08:00',
            ':daily_end'=>$data['schedule_end_time']??'20:00',
            ':available_weekdays'=>$data['available_days']??'mon,tue,wed,thu,fri,sat,sun',
          ]);
          $this->db->commit();
          return $id;
        } catch (Throwable $error) {
          if ($this->db->inTransaction()) $this->db->rollBack();
          throw $error;
        }
    }

    public function approveLinkedPendingVenues(int $tournamentId, int $reviewedBy): int {
        $stmt=$this->db->prepare("UPDATE venues SET approval_status='approved',reviewed_by=:reviewed_by,reviewed_at=NOW(),review_notes=COALESCE(review_notes,'Approved with tournament application') WHERE approval_status='pending' AND id IN (SELECT DISTINCT c.venue_id FROM tournament_courts tc JOIN courts c ON c.id=tc.court_id WHERE tc.tournament_id=:tournament_id)");
        $stmt->execute([':reviewed_by'=>$reviewedBy,':tournament_id'=>$tournamentId]);
        return $stmt->rowCount();
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

    public function setRosterLock(int $id, bool $locked, int $userId): bool {
        $stmt = $this->db->prepare("UPDATE tournaments SET roster_locked_at = :locked_at, roster_locked_by = :locked_by WHERE id = :id");
        return $stmt->execute([
            ':locked_at' => $locked ? date('Y-m-d H:i:s') : null,
            ':locked_by' => $locked ? $userId : null,
            ':id' => $id,
        ]);
    }

    public function archive(int $id): bool {
        $stmt = $this->db->prepare("UPDATE tournaments SET archived_at = NOW(), is_published = 0 WHERE id = :id");
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

    public function assignStaff(int $tournamentId, ?int $staffUserId, int $assignedBy): void {
        $this->db->beginTransaction();
        try {
            $this->db->prepare("DELETE FROM tournament_staff_assignments WHERE tournament_id=:tournament_id AND assignment_role='primary'")->execute([':tournament_id'=>$tournamentId]);
            if ($staffUserId) {
                $stmt=$this->db->prepare("INSERT INTO tournament_staff_assignments (tournament_id,user_id,assignment_role,assigned_by) VALUES (:tournament_id,:user_id,'primary',:assigned_by)");
                $stmt->execute([':tournament_id'=>$tournamentId,':user_id'=>$staffUserId,':assigned_by'=>$assignedBy]);
            }
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function readiness(int $tournamentId): array {
        $stmt=$this->db->prepare("SELECT t.registration_deadline,t.registration_fee,
            (SELECT COUNT(*) FROM tournament_courts WHERE tournament_id=:t1) courts,
            (SELECT COUNT(*) FROM teams WHERE tournament_id=:t2 AND status='registered') teams,
            (SELECT COUNT(*) FROM matches WHERE tournament_id=:t3) matches,
            (SELECT COUNT(*) FROM matches WHERE tournament_id=:t4 AND team1_id IS NOT NULL AND team2_id IS NOT NULL AND (scheduled_start_time IS NULL OR court_id IS NULL)) unscheduled,
            (SELECT COUNT(*) FROM tournament_staff_assignments WHERE tournament_id=:t5) assigned_staff,
            (SELECT COUNT(*) FROM team_players tp JOIN teams tm ON tm.id=tp.team_id WHERE tm.tournament_id=:t6 AND tp.eligibility_status='verified') verified_players,
            (SELECT COUNT(*) FROM teams tm WHERE tm.tournament_id=:t7 AND tm.status='registered' AND (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id=tm.id AND tp.eligibility_status='verified')>=5) eligible_teams,
            (SELECT COUNT(*) FROM teams tm WHERE tm.tournament_id=:t8 AND tm.status='registered' AND (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.team_id=tm.id AND p.tournament_id=tm.tournament_id AND p.status='approved')>=t.registration_fee) paid_teams
            FROM tournaments t WHERE t.id=:t0 LIMIT 1");
        $stmt->execute([':t0'=>$tournamentId,':t1'=>$tournamentId,':t2'=>$tournamentId,':t3'=>$tournamentId,':t4'=>$tournamentId,':t5'=>$tournamentId,':t6'=>$tournamentId,':t7'=>$tournamentId,':t8'=>$tournamentId]);
        $row=$stmt->fetch() ?: [];
        $teamCount=(int)($row['teams']??0);
        $registrationFee=(float)($row['registration_fee']??0);
        $checks=[
            ['key'=>'court','label'=>'Main Court attached','ready'=>(int)($row['courts']??0)===1],
            ['key'=>'teams','label'=>'At least two approved teams','ready'=>(int)($row['teams']??0)>=2],
            ['key'=>'bracket','label'=>'Bracket generated','ready'=>(int)($row['matches']??0)>0],
            ['key'=>'schedule','label'=>'All playable games have time and court','ready'=>(int)($row['matches']??0)>0 && (int)($row['unscheduled']??0)===0],
            ['key'=>'deadline','label'=>'Roster deadline configured','ready'=>!empty($row['registration_deadline'])],
            ['key'=>'players','label'=>'Every team has at least five eligible players','ready'=>$teamCount>=2 && (int)($row['eligible_teams']??0)===$teamCount],
            ['key'=>'staff','label'=>'Primary Staff Admin assigned','ready'=>(int)($row['assigned_staff']??0)>0],
        ];
        if($registrationFee>0){
            $checks[]=['key'=>'payment','label'=>'Every team registration fee approved','ready'=>$teamCount>=2 && (int)($row['paid_teams']??0)===$teamCount];
        }
        $ready=count(array_filter($checks,fn($check)=>$check['ready']));
        return ['checks'=>$checks,'ready_count'=>$ready,'total_count'=>count($checks),'publish_ready'=>$ready===count($checks),'counts'=>$row];
    }

    public function publish(int $tournamentId): bool {
        $stmt=$this->db->prepare("UPDATE tournaments SET is_published=1 WHERE id=:id AND operation_mode='official'");
        $stmt->execute([':id'=>$tournamentId]);
        return $stmt->rowCount()===1;
    }
}

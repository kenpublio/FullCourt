<?php

require_once __DIR__ . '/../config/database.php';

class SportsApplication {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function getOptionsForPlayer(int $userId): array {
        $sql = "SELECT tm.id AS team_id, tm.team_name, tm.status AS team_status,
                       t.id AS tournament_id, t.name AS tournament_name, t.description AS tournament_description,
                       t.start_date, t.end_date, t.status AS tournament_status,
                       s.id AS sport_id, s.name AS sport_name, s.rules_summary AS sport_description,
                       s.max_players_per_team, s.min_players_per_team,
                       u.full_name AS coach_name,
                       (SELECT c.court_name FROM matches m LEFT JOIN courts c ON m.court_id=c.id WHERE m.tournament_id=t.id AND (m.team1_id=tm.id OR m.team2_id=tm.id) AND m.status='scheduled' ORDER BY m.scheduled_start_time LIMIT 1) AS court_name,
                       (SELECT v.name FROM matches m LEFT JOIN courts c ON m.court_id=c.id LEFT JOIN venues v ON c.venue_id=v.id WHERE m.tournament_id=t.id AND (m.team1_id=tm.id OR m.team2_id=tm.id) AND m.status='scheduled' ORDER BY m.scheduled_start_time LIMIT 1) AS venue_name,
                       (SELECT m.scheduled_start_time FROM matches m WHERE m.tournament_id=t.id AND (m.team1_id=tm.id OR m.team2_id=tm.id) AND m.status='scheduled' ORDER BY m.scheduled_start_time LIMIT 1) AS next_schedule,
                       (SELECT COUNT(*) FROM team_players roster WHERE roster.team_id=tm.id AND roster.eligibility_status='verified') AS approved_players,
                       (SELECT mine.eligibility_status FROM team_players mine WHERE mine.team_id=tm.id AND mine.user_id=:mineUserId ORDER BY mine.id DESC LIMIT 1) AS application_status,
                       (SELECT mine.id FROM team_players mine WHERE mine.team_id=tm.id AND mine.user_id=:mineIdUserId ORDER BY mine.id DESC LIMIT 1) AS application_id
                FROM teams tm
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                JOIN users u ON tm.coach_user_id = u.id
                WHERE t.status IN ('upcoming','ongoing')
                ORDER BY CASE t.status WHEN 'ongoing' THEN 1 ELSE 2 END, t.start_date ASC, s.name ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':mineUserId' => $userId, ':mineIdUserId' => $userId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['event_categories'] = $this->eventCategoriesForSport((int) $row['sport_id']);
        }
        return $rows;
    }

    private function eventCategoriesForSport(int $sportId): array {
        $stmt = $this->db->prepare("SELECT id, name, gender, player_count FROM event_categories WHERE sport_id=:sportId ORDER BY sort_order ASC");
        $stmt->execute([':sportId' => $sportId]);
        return $stmt->fetchAll();
    }

    public function apply(int $teamId, int $userId, string $studentId, ?int $categoryId = null): int {
        $check = $this->db->prepare("SELECT id FROM team_players WHERE team_id=:teamId AND user_id=:userId AND eligibility_status IN ('pending','verified') LIMIT 1");
        $check->execute([':teamId'=>$teamId, ':userId'=>$userId]);
        if ($check->fetch()) throw new Exception('You already have an active application for this team.');

        $capacity = $this->db->prepare("SELECT s.max_players_per_team, COUNT(tp.id) AS approved FROM teams tm JOIN tournaments t ON tm.tournament_id=t.id JOIN sports s ON t.sport_id=s.id LEFT JOIN team_players tp ON tp.team_id=tm.id AND tp.eligibility_status='verified' WHERE tm.id=:teamId GROUP BY tm.id,s.id");
        $capacity->execute([':teamId'=>$teamId]);
        $row = $capacity->fetch();
        if (!$row) throw new Exception('The selected team is unavailable.');
        if ((int)$row['approved'] >= (int)$row['max_players_per_team']) throw new Exception('This team has no available player slots.');

        $stmt = $this->db->prepare("INSERT INTO team_players (team_id,user_id,student_id_number,category_id,eligibility_status,request_type,remarks) VALUES (:teamId,:userId,:studentId,:categoryId,'pending','player_application','Player submitted a sports application.')");
        $stmt->execute([':teamId'=>$teamId, ':userId'=>$userId, ':studentId'=>$studentId, ':categoryId'=>$categoryId]);
        return (int)$this->db->lastInsertId();
    }

    public function getForCoach(int $coachId): array {
        $stmt = $this->db->prepare("SELECT tp.id, tp.created_at, tp.student_id_number, u.full_name, u.email, u.department_course, u.year_level, tm.team_name, s.name AS sport_name, s.max_players_per_team, (SELECT COUNT(*) FROM team_players x WHERE x.team_id=tm.id AND x.eligibility_status='verified') AS approved_players FROM team_players tp JOIN users u ON tp.user_id=u.id JOIN teams tm ON tp.team_id=tm.id JOIN tournaments t ON tm.tournament_id=t.id JOIN sports s ON t.sport_id=s.id WHERE tm.coach_user_id=:coachId AND tp.request_type='player_application' AND tp.eligibility_status='pending' ORDER BY tp.created_at ASC");
        $stmt->execute([':coachId'=>$coachId]);
        return $stmt->fetchAll();
    }

    public function getUpdatesForPlayer(int $userId): array {
        $stmt = $this->db->prepare("SELECT tp.id, tp.eligibility_status, tp.remarks, tp.updated_at,
                                           tm.team_name, t.name AS tournament_name, s.name AS sport_name,
                                           coach.full_name AS coach_name
                                    FROM team_players tp
                                    JOIN teams tm ON tp.team_id = tm.id
                                    JOIN tournaments t ON tm.tournament_id = t.id
                                    JOIN sports s ON t.sport_id = s.id
                                    JOIN users coach ON tm.coach_user_id = coach.id
                                    WHERE tp.user_id = :userId
                                      AND tp.request_type = 'player_application'
                                      AND tp.eligibility_status IN ('verified', 'rejected')
                                    ORDER BY tp.updated_at DESC");
        $stmt->execute([':userId' => $userId]);
        return $stmt->fetchAll();
    }

    public function respond(int $id, int $coachId, string $status): bool {
        $stmt = $this->db->prepare("UPDATE team_players tp JOIN teams tm ON tp.team_id=tm.id JOIN tournaments t ON tm.tournament_id=t.id JOIN sports s ON t.sport_id=s.id SET tp.eligibility_status=:status, tp.verified_by=:coachId, tp.remarks=:remarks WHERE tp.id=:id AND tm.coach_user_id=:coachId AND tp.request_type='player_application' AND tp.eligibility_status='pending' AND (:status='rejected' OR (SELECT COUNT(*) FROM team_players x WHERE x.team_id=tm.id AND x.eligibility_status='verified') < s.max_players_per_team)");
        $stmt->execute([':status'=>$status, ':coachId'=>$coachId, ':remarks'=>$status==='verified'?'Coach approved the sports application.':'Coach rejected the sports application.', ':id'=>$id]);
        return $stmt->rowCount() > 0;
    }
}

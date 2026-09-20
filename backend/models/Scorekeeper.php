<?php
// backend/models/Scorekeeper.php

require_once __DIR__ . '/../config/database.php';

class Scorekeeper {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    // All matches assigned to the given scorekeeper (by match_officials) for
    // tournaments whose schedule is upcoming/ongoing.
    public function getAssignedMatches(int $userId): array {
        $stmt = $this->db->prepare("
            SELECT m.id, m.round_number, m.match_number, m.stage_name, m.status,
                   m.scheduled_start_time, m.scheduled_end_time,
                   t.id AS tournament_id, t.name AS tournament_name, t.status AS tournament_status,
                   s.name AS sport_name, s.default_match_duration_mins,
                   t1.team_name AS team1_name, t2.team_name AS team2_name,
                   c.court_name, v.name AS venue_name,
                   ms.team1_score, ms.team2_score, ms.current_period, ms.timer_seconds, ms.is_timer_running
            FROM match_officials mo
            JOIN matches m ON mo.match_id = m.id
            JOIN tournaments t ON m.tournament_id = t.id
            JOIN sports s ON t.sport_id = s.id
            LEFT JOIN teams t1 ON m.team1_id = t1.id
            LEFT JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN courts c ON m.court_id = c.id
            LEFT JOIN venues v ON c.venue_id = v.id
            LEFT JOIN match_scores ms ON ms.match_id = m.id
            WHERE mo.user_id = :uid AND (m.status = 'scheduled' OR m.status = 'in_progress')
            ORDER BY m.scheduled_start_time ASC
        ");
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    public function getMatchRoster(int $matchId): array {
        $stmt = $this->db->prepare("
            SELECT mr.user_id, mr.team_id, mr.jersey_number, mr.position, mr.is_active,
                   u.full_name, u.student_faculty_id
            FROM match_rosters mr
            JOIN users u ON mr.user_id = u.id
            WHERE mr.match_id = :mid
            ORDER BY mr.team_id, mr.is_active DESC, u.full_name ASC
        ");
        $stmt->execute([':mid' => $matchId]);
        return $stmt->fetchAll();
    }

    public function getMatchScoreState(int $matchId): ?array {
        $stmt = $this->db->prepare("
            SELECT ms.*, m.tournament_id, m.team1_id, m.team2_id, m.winner_team_id, m.status AS match_status,
                   t1.team_name AS team1_name, t2.team_name AS team2_name
            FROM match_scores ms
            JOIN matches m ON ms.match_id = m.id
            LEFT JOIN teams t1 ON m.team1_id = t1.id
            LEFT JOIN teams t2 ON m.team2_id = t2.id
            WHERE ms.match_id = :mid LIMIT 1
        ");
        $stmt->execute([':mid' => $matchId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    // Aggregate foul counts per team/player for the live scoreboard.
    public function getFoulCounts(int $matchId): array {
        $stmt = $this->db->prepare("
            SELECT f.team_id, f.player_id, u.full_name, u.student_faculty_id,
                   COUNT(*) AS fouls,
                   SUM(CASE WHEN f.foul_type = 'technical' THEN 1 ELSE 0 END) AS technical,
                   SUM(CASE WHEN f.foul_type = 'unsportsmanlike' THEN 1 ELSE 0 END) AS unsportsmanlike,
                   SUM(CASE WHEN f.foul_type = 'disqualification' THEN 1 ELSE 0 END) AS disqualifications
            FROM fouls f
            JOIN users u ON f.player_id = u.id
            WHERE f.match_id = :mid
            GROUP BY f.team_id, f.player_id, u.full_name, u.student_faculty_id
            ORDER BY f.team_id, MIN(f.created_at) ASC
        ");
        $stmt->execute([':mid' => $matchId]);
        return $stmt->fetchAll();
    }

    public function getTimeoutHistory(int $matchId): array {
        $stmt = $this->db->prepare("
            SELECT t.id, t.team_id, tm.team_name, t.timeout_number, t.status,
                   t.duration_seconds, t.created_at
            FROM timeouts t
            JOIN teams tm ON t.team_id = tm.id
            WHERE t.match_id = :mid
            ORDER BY t.created_at DESC
        ");
        $stmt->execute([':mid' => $matchId]);
        return $stmt->fetchAll();
    }

    public function getEventLog(int $matchId, int $limit = 100): array {
        $stmt = $this->db->prepare("
            SELECT ge.id, ge.event_type, ge.team_id, ge.player_id, ge.clock_seconds,
                   ge.period, ge.detail_json, ge.created_at,
                   t.team_name, u.full_name AS player_name, u.student_faculty_id AS player_number
            FROM game_events ge
            LEFT JOIN teams t ON ge.team_id = t.id
            LEFT JOIN users u ON ge.player_id = u.id
            WHERE ge.match_id = :mid
            ORDER BY ge.created_at DESC
            LIMIT :limit
        ");
        $stmt->bindValue(':mid', $matchId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function recordEvent(int $matchId, array $event): int {
        $stmt = $this->db->prepare("INSERT INTO game_events (match_id, event_type, team_id, player_id, clock_seconds, period, detail_json) VALUES (:mid, :type, :team, :player, :clock, :period, :detail)");
        $stmt->execute([
            ':mid' => $matchId,
            ':type' => $event['event_type'],
            ':team' => $event['team_id'] ?? null,
            ':player' => $event['player_id'] ?? null,
            ':clock' => $event['clock_seconds'] ?? null,
            ':period' => $event['period'] ?? null,
            ':detail' => isset($event['detail_json']) ? json_encode($event['detail_json']) : null,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function deleteEvent(int $eventId, int $matchId): bool {
        $stmt = $this->db->prepare("DELETE FROM game_events WHERE id = :eid AND match_id = :mid");
        return $stmt->execute([':eid' => $eventId, ':mid' => $matchId]);
    }

    public function updateScoreState(int $matchId, array $fields): bool {
        $set = [];
        $params = [':mid' => $matchId];
        foreach (['team1_score', 'team2_score', 'current_period', 'timer_seconds', 'is_timer_running'] as $col) {
            if (array_key_exists($col, $fields)) {
                $set[] = "$col = :$col";
                $params[":$col"] = $fields[$col];
            }
        }
        if (!$set) return true;
        $sql = "UPDATE match_scores SET " . implode(', ', $set) . " WHERE match_id = :mid";
        return $this->db->prepare($sql)->execute($params);
    }

    public function recordFoul(int $matchId, int $playerId, int $teamId, string $type, int $recordedBy): int {
        $stmt = $this->db->prepare("INSERT INTO fouls (match_id, player_id, team_id, foul_type, recorded_by) VALUES (:mid, :pid, :tid, :type, :rb)");
        $stmt->execute([':mid' => $matchId, ':pid' => $playerId, ':tid' => $teamId, ':type' => $type, ':rb' => $recordedBy]);
        return (int) $this->db->lastInsertId();
    }

    public function cancelTimeout(int $matchId, int $timeoutId): bool {
        $stmt = $this->db->prepare("UPDATE timeouts SET status = 'cancelled' WHERE id = :tid AND match_id = :mid");
        return $stmt->execute([':tid' => $timeoutId, ':mid' => $matchId]);
    }

    public function recordTimeout(int $matchId, int $teamId, int $duration, int $recordedBy): int {
        $nextStmt = $this->db->prepare("SELECT COALESCE(MAX(timeout_number), 0) + 1 AS next FROM timeouts WHERE match_id = :mid AND team_id = :tid");
        $nextStmt->execute([':mid' => $matchId, ':tid' => $teamId]);
        $next = (int) $nextStmt->fetchColumn();

        $stmt = $this->db->prepare("INSERT INTO timeouts (match_id, team_id, timeout_number, status, duration_seconds, recorded_by) VALUES (:mid, :tid, :num, 'active', :dur, :rb)");
        $stmt->execute([':mid' => $matchId, ':tid' => $teamId, ':num' => $next, ':dur' => $duration, ':rb' => $recordedBy]);
        return (int) $this->db->lastInsertId();
    }

    public function recordSubstitution(int $matchId, int $teamId, int $playerIn, int $playerOut, string $period, ?int $clock, int $recordedBy): int {
        $stmt = $this->db->prepare("
            INSERT INTO substitutions (match_id, team_id, player_in_id, player_out_id, period, clock_seconds, recorded_by)
            VALUES (:mid, :tid, :pin, :pout, :period, :clock, :rb)
        ");
        $stmt->execute([
            ':mid' => $matchId, ':tid' => $teamId, ':pin' => $playerIn,
            ':pout' => $playerOut, ':period' => $period, ':clock' => $clock, ':rb' => $recordedBy
        ]);

        // Update active roster flags for this match/team.
        $this->db->prepare("UPDATE match_rosters SET is_active = 0 WHERE match_id = :mid AND team_id = :tid AND user_id IN (:pin, :pout)")
            ->execute([':mid' => $matchId, ':tid' => $teamId, ':pin' => $playerIn, ':pout' => $playerOut]);
        $this->db->prepare("UPDATE match_rosters SET is_active = 1 WHERE match_id = :mid AND team_id = :tid AND user_id = :pin")
            ->execute([':mid' => $matchId, ':tid' => $teamId, ':pin' => $playerIn]);

        return (int) $this->db->lastInsertId();
    }

    public function isAssignedScorekeeper(int $matchId, int $userId): bool {
        $stmt = $this->db->prepare("SELECT 1 FROM match_officials WHERE match_id = :mid AND user_id = :uid AND role = 'scorekeeper' LIMIT 1");
        $stmt->execute([':mid' => $matchId, ':uid' => $userId]);
        return (bool) $stmt->fetchColumn();
    }

    public function getMatchStatus(int $matchId): ?string {
        $stmt = $this->db->prepare("SELECT status FROM matches WHERE id = :mid LIMIT 1");
        $stmt->execute([':mid' => $matchId]);
        return $stmt->fetchColumn() ?: null;
    }

    public function startMatch(int $matchId): void {
        $this->db->prepare("UPDATE matches SET status = 'in_progress', actual_start_time = COALESCE(actual_start_time, NOW()) WHERE id = :mid")->execute([':mid' => $matchId]);
    }

    public function completeMatch(int $matchId, int $winnerTeamId): void {
        $this->db->prepare("UPDATE matches SET status = 'completed', actual_end_time = NOW(), winner_team_id = :w WHERE id = :mid")->execute([':w' => $winnerTeamId, ':mid' => $matchId]);
    }

    public function assignOfficial(int $matchId, int $userId, string $role, int $assignedBy): bool {
        $stmt = $this->db->prepare("INSERT INTO match_officials (match_id, user_id, role, assigned_by) VALUES (:mid, :uid, :role, :ab) ON CONFLICT (match_id,user_id,role) DO NOTHING");
        return $stmt->execute([':mid' => $matchId, ':uid' => $userId, ':role' => $role, ':ab' => $assignedBy]);
    }

    public function getOfficialAssignment(int $matchId): array {
        $stmt = $this->db->prepare("
            SELECT mo.role, u.full_name, u.email
            FROM match_officials mo
            JOIN users u ON mo.user_id = u.id
            WHERE mo.match_id = :mid
        ");
        $stmt->execute([':mid' => $matchId]);
        return $stmt->fetchAll();
    }
}

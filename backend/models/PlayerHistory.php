<?php
// backend/models/PlayerHistory.php

require_once __DIR__ . '/../config/database.php';

class PlayerHistory {
    private PDO $db;

    public function __construct() {
        $db = (new Database())->getConnection();
        if (!$db) throw new Exception('Database connection failed');
        $this->db = $db;
    }

    public function forUser(int $userId): array {
        $sql = "SELECT tp.id, tp.eligibility_status, ec.name AS category_name, ec.gender,
                       tm.team_name, t.name AS tournament_name, t.start_date, t.end_date,
                       s.name AS sport_name,
                       t.id AS tournament_id
                FROM team_players tp
                JOIN teams tm ON tp.team_id = tm.id
                JOIN tournaments t ON tm.tournament_id = t.id
                JOIN sports s ON t.sport_id = s.id
                LEFT JOIN event_categories ec ON tp.category_id = ec.id
                WHERE tp.user_id = :userId
                  AND tp.eligibility_status IN ('verified','rejected')
                ORDER BY t.start_date DESC, tp.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $row) {
            $row['matches'] = $this->matchesForTeamInTournament((int) $row['team_id'], (int) $row['tournament_id']);
            $result[] = $row;
        }
        return $result;
    }

    private function matchesForTeamInTournament(int $teamId, int $tournamentId): array {
        $sql = "SELECT m.id, m.scheduled_start_time, m.stage_name, m.status, m.team1_id, m.team2_id, m.winner_team_id,
                       t1.team_name AS team1_name, t2.team_name AS team2_name,
                       c.court_name, v.name AS venue_name,
                       ms.team1_score, ms.team2_score
                FROM matches m
                JOIN teams t1 ON t1.id = m.team1_id
                JOIN teams t2 ON t2.id = m.team2_id
                LEFT JOIN courts c ON m.court_id = c.id
                LEFT JOIN venues v ON c.venue_id = v.id
                LEFT JOIN match_scores ms ON ms.match_id = m.id
                WHERE m.tournament_id = :tournamentId
                  AND (m.team1_id = :teamId OR m.team2_id = :teamId)
                ORDER BY m.scheduled_start_time ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':tournamentId' => $tournamentId, ':teamId' => $teamId]);
        $matches = $stmt->fetchAll();

        foreach ($matches as &$m) {
            $m['is_winner'] = (int) $m['winner_team_id'] === $teamId ? 1 : 0;
        }
        return $matches;
    }
}
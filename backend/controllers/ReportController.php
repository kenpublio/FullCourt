<?php
// backend/controllers/ReportController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class ReportController {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAnalytics(): void {
        AuthMiddleware::authenticate();

        $totalUsers = (int) $this->db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $totalTournaments = (int) $this->db->query("SELECT COUNT(*) FROM tournaments t JOIN sports s ON s.id=t.sport_id WHERE LOWER(s.name)='basketball'")->fetchColumn();
        $activeTournaments = (int) $this->db->query("SELECT COUNT(*) FROM tournaments t JOIN sports s ON s.id=t.sport_id WHERE LOWER(s.name)='basketball' AND t.status IN ('upcoming','ongoing')")->fetchColumn();
        $totalTeams = (int) $this->db->query("SELECT COUNT(*) FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id JOIN sports s ON s.id=t.sport_id WHERE LOWER(s.name)='basketball'")->fetchColumn();
        $registeredTeams = (int) $this->db->query("SELECT COUNT(*) FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id JOIN sports s ON s.id=t.sport_id WHERE LOWER(s.name)='basketball' AND tm.status='registered'")->fetchColumn();
        $pendingEligibility = (int) $this->db->query("SELECT COUNT(*) FROM team_players WHERE eligibility_status='pending'")->fetchColumn();
        $verifiedPlayers = (int) $this->db->query("SELECT COUNT(*) FROM team_players WHERE eligibility_status = 'verified'")->fetchColumn();
        $totalMatches = (int) $this->db->query("SELECT COUNT(*) FROM matches")->fetchColumn();
        $activeGames = (int) $this->db->query("SELECT COUNT(*) FROM matches WHERE status='in_progress'")->fetchColumn();

        // Sports breakdown
        $sportsBreakdown = $this->db->query("
            SELECT s.name as sport, COUNT(t.id) as tournament_count, COUNT(tm.id) as team_count
            FROM sports s
            LEFT JOIN tournaments t ON s.id = t.sport_id
            LEFT JOIN teams tm ON t.id = tm.tournament_id
            WHERE LOWER(s.name)='basketball'
            GROUP BY s.id, s.name
        ")->fetchAll();

        // Eligibility status breakdown
        $eligibilityStats = $this->db->query("
            SELECT eligibility_status, COUNT(*) as count 
            FROM team_players 
            GROUP BY eligibility_status
        ")->fetchAll();

        // Top teams leaderboard (across all completed tournaments)
        $topTeams = $this->db->query("
            SELECT tm.team_name, t.name AS tournament_name, st.tournament_points, st.net_points, st.rank_position
            FROM standings st
            JOIN teams tm ON st.team_id = tm.id
            JOIN tournaments t ON st.tournament_id = t.id
            ORDER BY st.tournament_points DESC, st.net_points DESC, st.rank_position ASC
            LIMIT 8
        ")->fetchAll();

        // Match outcome funnel
        $outcomeFunnel = $this->db->query("
            SELECT status, COUNT(*) as count FROM matches GROUP BY status
        ")->fetchAll();

        $playerLeaders = $this->db->query("
            SELECT u.full_name, tm.team_name, COUNT(DISTINCT e.match_id) games_played,
                SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
                SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,
                SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,
                SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END) defensive_plays
            FROM basketball_stat_events e
            JOIN team_players tp ON tp.id=e.team_player_id
            JOIN users u ON u.id=tp.user_id
            JOIN teams tm ON tm.id=e.team_id
            WHERE e.is_void=0
            GROUP BY u.id,u.full_name,tm.id,tm.team_name
            ORDER BY points DESC,rebounds DESC,assists DESC LIMIT 10
        ")->fetchAll();

        Response::success('Analytics data retrieved', [
            'metrics' => [
                'total_users' => $totalUsers,
                'total_tournaments' => $totalTournaments,
                'active_tournaments' => $activeTournaments,
                'total_teams' => $totalTeams,
                'registered_teams' => $registeredTeams,
                'pending_eligibility' => $pendingEligibility,
                'verified_players' => $verifiedPlayers,
                'total_matches' => $totalMatches,
                'active_games' => $activeGames
            ],
            'sports_breakdown' => $sportsBreakdown,
            'eligibility_stats' => $eligibilityStats,
            'top_teams' => $topTeams,
            'match_outcomes' => $outcomeFunnel,
            'player_leaders' => $playerLeaders
        ]);
    }

    public function getStandings(int $tournamentId): void {
        AuthMiddleware::authenticate();
        $stmt = $this->db->prepare("SELECT st.*, tm.team_name FROM standings st JOIN teams tm ON tm.id = st.team_id WHERE st.tournament_id = :tournament_id ORDER BY st.tournament_points DESC, st.net_points DESC, tm.team_name ASC");
        $stmt->execute([':tournament_id' => $tournamentId]);
        Response::success('Tournament standings retrieved', ['standings' => $stmt->fetchAll()]);
    }

    // POST /reports/generate  { report_type, format, tournament_id?, filters? }
    // Logs an exportable report request to reports_log for audit trail.
    public function generateReport(): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $type = trim($input['report_type'] ?? 'analytics');
        $format = in_array($input['format'] ?? 'csv', ['pdf','excel','csv','print'], true) ? $input['format'] : 'csv';
        $filters = $input['filters'] ?? null;

        $stmt = $this->db->prepare("INSERT INTO reports_log (tournament_id, report_type, generated_by, filters_json, file_url, format) VALUES (:tid, :type, :uid, :filters, :url, :fmt)");
        $stmt->execute([
            ':tid' => $input['tournament_id'] ?? null,
            ':type' => $type,
            ':uid' => $user['user_id'],
            ':filters' => $filters ? json_encode($filters) : null,
            ':url' => null,
            ':fmt' => $format,
        ]);

        Response::success('Report generation logged', ['report_id' => (int)$this->db->lastInsertId()]);
    }

    // GET /reports/log
    public function reportLog(): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']);
        $stmt = $this->db->prepare("
            SELECT rl.id, rl.tournament_id, t.name AS tournament_name, rl.report_type, rl.filters_json, rl.file_url, rl.format, rl.created_at, u.full_name AS generated_by
            FROM reports_log rl
            LEFT JOIN tournaments t ON rl.tournament_id = t.id
            LEFT JOIN users u ON rl.generated_by = u.id
            ORDER BY rl.created_at DESC LIMIT 50
        ");
        $stmt->execute();
        Response::success('Report generation log retrieved', ['reports' => $stmt->fetchAll()]);
    }
}

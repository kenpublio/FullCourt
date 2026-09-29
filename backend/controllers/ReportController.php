<?php
// backend/controllers/ReportController.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/response.php';

class ReportController {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAnalytics(): void {
        $user=AuthMiddleware::authenticate();
        if (in_array($user['role'], ['coach','coach_manager'], true)) {
            $userId=(int)$user['user_id'];
            $teamId=isset($_GET['team_id'])?(int)$_GET['team_id']:0;
            if($teamId>0){
                $access=$this->db->prepare('SELECT id FROM teams WHERE id=:team_id AND (coach_user_id=:coach_id OR manager_user_id=:manager_id) LIMIT 1');
                $access->execute([':team_id'=>$teamId,':coach_id'=>$userId,':manager_id'=>$userId]);
                if(!$access->fetchColumn())Response::forbidden('You can only view analytics for your assigned team.');
                $this->coachAnalytics(0,[$teamId],'Assigned team analytics retrieved');
            }else{
                $this->coachAnalytics($userId);
            }
            return;
        }
        if (in_array($user['role'],['organization_admin','tournament_organizer'],true)) {
            $stmt=$this->db->prepare("SELECT DISTINCT tm.id FROM organization_members om JOIN organizations o ON o.id=om.organization_id AND o.status='active' JOIN tournaments t ON t.organization_id=o.id JOIN teams tm ON tm.tournament_id=t.id WHERE om.user_id=:user_id AND om.status='active'");
            $stmt->execute([':user_id'=>(int)$user['user_id']]);
            $this->coachAnalytics(0,array_map('intval',$stmt->fetchAll(PDO::FETCH_COLUMN)),'Organization analytics retrieved');
            return;
        }

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
        $user=AuthMiddleware::authenticate();
        OrganizationAccess::requireTournament($tournamentId,$user);
        $sql="SELECT st.*, tm.team_name FROM standings st JOIN teams tm ON tm.id = st.team_id WHERE st.tournament_id = :tournament_id";
        $sql.=" ORDER BY st.tournament_points DESC, st.net_points DESC, tm.team_name ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':tournament_id'=>$tournamentId]);
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
        if(!empty($input['tournament_id']))OrganizationAccess::requireTournament((int)$input['tournament_id'],$user);

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
        $coach=in_array($user['role'],['coach','coach_manager'],true);$organizer=in_array($user['role'],['organization_admin','tournament_organizer'],true);
        $sql="
            SELECT rl.id, rl.tournament_id, t.name AS tournament_name, rl.report_type, rl.filters_json, rl.file_url, rl.format, rl.created_at, u.full_name AS generated_by
            FROM reports_log rl
            LEFT JOIN tournaments t ON rl.tournament_id = t.id
            LEFT JOIN users u ON rl.generated_by = u.id
            ".($coach?' WHERE rl.generated_by=:user_id ':($organizer?" WHERE EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=t.organization_id AND om.user_id=:user_id AND om.status='active') ":''))." ORDER BY rl.created_at DESC LIMIT 50";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(($coach||$organizer)?[':user_id'=>(int)$user['user_id']]:[]);
        Response::success('Report generation log retrieved', ['reports' => $stmt->fetchAll()]);
    }

    private function coachAnalytics(int $userId,?array $scopedTeamIds=null,string $message='Coach team analytics retrieved'): void {
        if($scopedTeamIds===null){$ids=$this->db->prepare('SELECT id FROM teams WHERE coach_user_id=:coach OR manager_user_id=:manager');$ids->execute([':coach'=>$userId,':manager'=>$userId]);$teamIds=array_map('intval',$ids->fetchAll(PDO::FETCH_COLUMN));}
        else{$teamIds=$scopedTeamIds;}
        if(!$teamIds){Response::success('Coach analytics retrieved',['metrics'=>['total_users'=>0,'total_tournaments'=>0,'active_tournaments'=>0,'total_teams'=>0,'registered_teams'=>0,'pending_eligibility'=>0,'verified_players'=>0,'total_matches'=>0,'active_games'=>0],'sports_breakdown'=>[],'eligibility_stats'=>[],'top_teams'=>[],'match_outcomes'=>[],'player_leaders'=>[]]);}
        $marks=implode(',',$teamIds);
        $scalar=function(string $sql):int{return(int)$this->db->query($sql)->fetchColumn();};
        $rows=function(string $sql):array{return$this->db->query($sql)->fetchAll();};
        $metrics=[
          'total_users'=>$scalar("SELECT COUNT(*) FROM team_players WHERE team_id IN ($marks)"),
          'total_tournaments'=>$scalar("SELECT COUNT(DISTINCT tournament_id) FROM teams WHERE id IN ($marks)"),
          'active_tournaments'=>$scalar("SELECT COUNT(DISTINCT t.id) FROM tournaments t JOIN teams tm ON tm.tournament_id=t.id WHERE tm.id IN ($marks) AND t.status IN ('upcoming','ongoing')"),
          'total_teams'=>count($teamIds),'registered_teams'=>$scalar("SELECT COUNT(*) FROM teams WHERE id IN ($marks) AND status='registered'"),
          'pending_eligibility'=>$scalar("SELECT COUNT(*) FROM team_players WHERE team_id IN ($marks) AND eligibility_status='pending'"),
          'verified_players'=>$scalar("SELECT COUNT(*) FROM team_players WHERE team_id IN ($marks) AND eligibility_status='verified'"),
          'total_matches'=>$scalar("SELECT COUNT(*) FROM matches WHERE team1_id IN ($marks) OR team2_id IN ($marks)"),
          'active_games'=>$scalar("SELECT COUNT(*) FROM matches WHERE status='in_progress' AND (team1_id IN ($marks) OR team2_id IN ($marks))")];
        $eligibility=$rows("SELECT eligibility_status,COUNT(*) count FROM team_players WHERE team_id IN ($marks) GROUP BY eligibility_status");
        $top=$rows("SELECT tm.team_name,t.name tournament_name,st.tournament_points,st.net_points,st.rank_position FROM standings st JOIN teams tm ON tm.id=st.team_id JOIN tournaments t ON t.id=st.tournament_id WHERE tm.id IN ($marks) ORDER BY st.tournament_points DESC");
        $outcomes=$rows("SELECT status,COUNT(*) count FROM matches WHERE team1_id IN ($marks) OR team2_id IN ($marks) GROUP BY status");
        $leaders=$rows("SELECT u.full_name,tm.team_name,COUNT(DISTINCT e.match_id) games_played,SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END) defensive_plays FROM basketball_stat_events e JOIN team_players tp ON tp.id=e.team_player_id JOIN users u ON u.id=tp.user_id JOIN teams tm ON tm.id=e.team_id WHERE e.is_void=0 AND tm.id IN ($marks) GROUP BY u.id,u.full_name,tm.id,tm.team_name ORDER BY points DESC LIMIT 10");
        Response::success($message,['metrics'=>$metrics,'sports_breakdown'=>[['sport'=>'Basketball','tournament_count'=>$metrics['total_tournaments'],'team_count'=>count($teamIds)]],'eligibility_stats'=>$eligibility,'top_teams'=>$top,'match_outcomes'=>$outcomes,'player_leaders'=>$leaders]);
    }
}

<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/Bracket.php';
require_once __DIR__ . '/../models/Schedule.php';
require_once __DIR__ . '/../models/Scorekeeper.php';
require_once __DIR__ . '/../models/GameOperations.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class PublicController {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function portal(): void {
        $tournaments = $this->db->query("SELECT t.id,t.name,t.format,t.description,t.start_date,t.end_date,t.status,s.name sport_name FROM tournaments t JOIN sports s ON s.id=t.sport_id WHERE LOWER(s.name)='basketball' AND t.is_published=1 AND t.status IN ('upcoming','ongoing','completed') ORDER BY CASE t.status WHEN 'ongoing' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,t.start_date DESC LIMIT 12")->fetchAll();
        $matches = $this->db->query("SELECT m.id,m.tournament_id,m.stage_name,m.round_number,m.scheduled_start_time,m.status,t.name tournament_name,a.team_name team1_name,b.team_name team2_name,c.court_name,ms.team1_score,ms.team2_score FROM matches m JOIN tournaments t ON t.id=m.tournament_id JOIN sports s ON s.id=t.sport_id LEFT JOIN teams a ON a.id=m.team1_id LEFT JOIN teams b ON b.id=m.team2_id LEFT JOIN courts c ON c.id=m.court_id LEFT JOIN match_scores ms ON ms.match_id=m.id WHERE LOWER(s.name)='basketball' AND t.is_published=1 AND m.schedule_status='published' ORDER BY COALESCE(m.scheduled_start_time,'9999-12-31') LIMIT 30")->fetchAll();
        $standings = $this->db->query("SELECT st.rank_position,st.played,st.won,st.lost,st.drawn,st.tournament_points,tm.team_name,t.name tournament_name FROM standings st JOIN teams tm ON tm.id=st.team_id JOIN tournaments t ON t.id=st.tournament_id JOIN sports s ON s.id=t.sport_id WHERE LOWER(s.name)='basketball' AND t.is_published=1 ORDER BY st.tournament_id,st.rank_position LIMIT 40")->fetchAll();
        $leaders = $this->db->query("SELECT u.full_name,tm.team_name,
            SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
            SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists
            FROM basketball_stat_events e JOIN team_players tp ON tp.id=e.team_player_id JOIN users u ON u.id=tp.user_id
            JOIN teams tm ON tm.id=e.team_id JOIN matches m ON m.id=e.match_id JOIN tournaments t ON t.id=m.tournament_id
            WHERE e.is_void=0 AND t.is_published=1 GROUP BY u.id,tm.id ORDER BY points DESC LIMIT 12")->fetchAll();
        Response::success('Public basketball portal retrieved', compact('tournaments', 'matches', 'standings', 'leaders'));
    }

    public function tournament(int $tournamentId): void {
        $stmt = $this->db->prepare("SELECT t.*,s.name AS sport_name FROM tournaments t JOIN sports s ON t.sport_id=s.id WHERE t.id=:id AND LOWER(s.name)='basketball' AND t.is_published=1 LIMIT 1");
        $stmt->execute([':id' => $tournamentId]);
        $tournament = $stmt->fetch();
        if (!$tournament) Response::error('Tournament not found.', 404);
        $teamsStmt = $this->db->prepare("SELECT tm.id, tm.team_name, tm.logo_url, tm.status, u.full_name AS coach_name, (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id=tm.id AND tp.eligibility_status='verified') AS player_count FROM teams tm JOIN users u ON tm.coach_user_id=u.id WHERE tm.tournament_id=:id ORDER BY tm.team_name");
        $teamsStmt->execute([':id' => $tournamentId]);
        $teams = $teamsStmt->fetchAll();
        $schedule = (new Schedule())->getMasterSchedule($tournamentId);
        $bracket = (new Bracket())->getBracket($tournamentId);
        $standingsStmt = $this->db->prepare("SELECT st.*, tm.team_name FROM standings st JOIN teams tm ON st.team_id=tm.id WHERE st.tournament_id=:id ORDER BY st.rank_position, st.tournament_points DESC");
        $standingsStmt->execute([':id' => $tournamentId]);
        $standings = $standingsStmt->fetchAll();
        $leadersStmt=$this->db->prepare("SELECT u.id user_id,u.full_name,tm.team_name,tp.jersey_number,tp.position,
            SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
            SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,
            SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,
            SUM(CASE WHEN e.event_type='steal' THEN 1 ELSE 0 END) steals,
            SUM(CASE WHEN e.event_type='block' THEN 1 ELSE 0 END) blocks
            FROM basketball_stat_events e JOIN matches m ON m.id=e.match_id JOIN team_players tp ON tp.id=e.team_player_id
            JOIN users u ON u.id=tp.user_id JOIN teams tm ON tm.id=e.team_id
            WHERE m.tournament_id=:id AND e.is_void=0 GROUP BY u.id,u.full_name,tm.id,tm.team_name,tp.id,tp.jersey_number,tp.position
            ORDER BY points DESC,rebounds DESC,assists DESC LIMIT 25");
        $leadersStmt->execute([':id'=>$tournamentId]);$leaders=$leadersStmt->fetchAll();
        $awardsStmt=$this->db->prepare("SELECT ac.name,ac.metric_key,u.full_name,tp.jersey_number,tp.position,tm.team_name
            FROM award_categories ac JOIN player_awards pa ON pa.award_category_id=ac.id AND pa.status='confirmed'
            JOIN users u ON u.id=pa.user_id LEFT JOIN team_players tp ON tp.user_id=u.id
            LEFT JOIN teams tm ON tm.id=tp.team_id AND tm.tournament_id=ac.tournament_id
            WHERE ac.tournament_id=:id AND ac.is_public=1 ORDER BY ac.name");
        $awardsStmt->execute([':id'=>$tournamentId]);$awards=$awardsStmt->fetchAll();
        Response::success('Public tournament details retrieved', compact('tournament', 'teams', 'schedule', 'bracket', 'standings', 'leaders', 'awards'));
    }

    // GET /public/tournaments/{id}/bracket
    public function bracket(int $tournamentId): void {
        $bracket = (new Bracket())->getBracket($tournamentId);
        Response::success('Public bracket retrieved', $bracket);
    }

    // GET /public/tournaments/{id}/schedule
    public function schedule(int $tournamentId): void {
        $schedule = (new Schedule())->getMasterSchedule($tournamentId);
        Response::success('Public schedule retrieved', ['schedule' => $schedule]);
    }

    public function dailySchedule(): void {
        $stmt=$this->db->query("SELECT m.id,m.tournament_id,m.stage_name,m.round_number,m.match_number,m.scheduled_start_time,m.scheduled_end_time,m.status,
            t.name tournament_name,h.team_name team1_name,a.team_name team2_name,c.court_name,v.name venue_name,
            COALESCE(ms.team1_score,0) team1_score,COALESCE(ms.team2_score,0) team2_score,ms.current_period,ms.timer_seconds
            FROM matches m JOIN tournaments t ON t.id=m.tournament_id JOIN sports s ON s.id=t.sport_id
            LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id
            LEFT JOIN courts c ON c.id=m.court_id LEFT JOIN venues v ON v.id=c.venue_id LEFT JOIN match_scores ms ON ms.match_id=m.id
            WHERE LOWER(s.name)='basketball' AND t.is_published=1 AND m.schedule_status='published'
            ORDER BY CASE WHEN m.status='in_progress' THEN 0 ELSE 1 END,COALESCE(m.scheduled_start_time,'9999-12-31') LIMIT 250");
        Response::success('Public daily basketball schedule retrieved',['matches'=>$stmt->fetchAll()]);
    }

    // GET /public/venues
    public function venues(): void {
        $stmt = $this->db->query("SELECT v.id,v.name,v.location,c.id court_id,c.court_name,c.sport_id,s.name sport_name FROM venues v LEFT JOIN courts c ON c.venue_id=v.id LEFT JOIN sports s ON s.id=c.sport_id WHERE c.sport_id IS NULL OR LOWER(s.name)='basketball' ORDER BY v.id,c.id");
        $rows = $stmt->fetchAll();
        $venues = [];
        foreach ($rows as $r) {
            if (!isset($venues[$r['id']])) {
                $venues[$r['id']] = ['id' => (int)$r['id'], 'name' => $r['name'], 'location' => $r['location'], 'courts' => []];
            }
            if ($r['court_id']) $venues[$r['id']]['courts'][] = ['id' => (int)$r['court_id'], 'court_name' => $r['court_name'], 'sport' => $r['sport_name']];
        }
        Response::success('Public venues retrieved', ['venues' => array_values($venues)]);
    }

    // GET /public/matches/{id}/live
    public function liveMatch(int $matchId): void {
        $access=$this->db->prepare("SELECT o.public_scores,o.public_player_profiles FROM matches m JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN organizations o ON o.id=t.organization_id WHERE m.id=:id AND t.is_published=1 LIMIT 1");
        $access->execute([':id'=>$matchId]);
        $privacy=$access->fetch();
        if(!$privacy) Response::error('Public game not found.',404);
        if(isset($privacy['public_scores']) && !$privacy['public_scores']) Response::error('Public scoring is disabled for this competition.',403);
        $scorekeeper=new Scorekeeper();
        $board = $scorekeeper->getMatchScoreState($matchId);
        if (!$board) Response::error('Live scoreboard not found for this match.', 404);
        $events=$scorekeeper->getEventLog($matchId,40);
        $fouls=$scorekeeper->getFoulCounts($matchId);
        $timeouts=$scorekeeper->getTimeoutHistory($matchId);
        $boxScore=!isset($privacy['public_player_profiles'])||$privacy['public_player_profiles']?(new GameOperations())->boxScore($matchId):[];
        Response::success('Live match state retrieved', ['score'=>$board,'events'=>$events,'fouls'=>$fouls,'timeouts'=>$timeouts,'box_score'=>$boxScore]);
    }

    public function matchDetails(int $matchId): void {
        $match=$this->db->prepare("SELECT m.id,m.tournament_id,m.team1_id,m.team2_id,m.stage_name,m.match_number,m.scheduled_start_time,m.status,m.lineups_confirmed_at,t.name tournament_name,h.team_name team1_name,a.team_name team2_name,h.logo_url team1_logo,a.logo_url team2_logo,c.court_name,v.name venue_name FROM matches m JOIN tournaments t ON t.id=m.tournament_id JOIN sports s ON s.id=t.sport_id LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id LEFT JOIN courts c ON c.id=m.court_id LEFT JOIN venues v ON v.id=c.venue_id WHERE m.id=:id AND t.is_published=1 AND LOWER(s.name)='basketball' AND m.schedule_status='published' LIMIT 1");
        $match->execute([':id'=>$matchId]);$game=$match->fetch();if(!$game)Response::error('Public game not found.',404);
        $lineup=$this->db->prepare("SELECT tm.team_name,u.full_name,tp.jersey_number,tp.position,gl.is_starter FROM game_lineups gl JOIN team_players tp ON tp.id=gl.team_player_id JOIN users u ON u.id=tp.user_id JOIN teams tm ON tm.id=tp.team_id WHERE gl.match_id=:id AND gl.is_present=1 ORDER BY tm.id,gl.is_starter DESC,tp.jersey_number,u.full_name");$lineup->execute([':id'=>$matchId]);
        $officials=$this->db->prepare("SELECT u.full_name,ga.assignment_role FROM game_assignments ga JOIN users u ON u.id=ga.user_id WHERE ga.match_id=:id AND ga.status='accepted' ORDER BY ga.assignment_role,u.full_name");$officials->execute([':id'=>$matchId]);
        $comparison=[];
        foreach(['team1'=>(int)$game['team1_id'],'team2'=>(int)$game['team2_id']] as $side=>$teamId){
            if(!$teamId){$comparison[$side]=['games'=>0,'wins'=>0,'losses'=>0,'win_rate'=>0,'points_per_game'=>0,'points_allowed'=>0];continue;}
            $form=$this->db->prepare("SELECT COUNT(*) games,SUM(CASE WHEN m.winner_team_id=:winner THEN 1 ELSE 0 END) wins,ROUND(AVG(CASE WHEN m.team1_id=:scoring THEN ms.team1_score ELSE ms.team2_score END),1) points_per_game,ROUND(AVG(CASE WHEN m.team1_id=:defending THEN ms.team2_score ELSE ms.team1_score END),1) points_allowed FROM matches m JOIN match_scores ms ON ms.match_id=m.id WHERE (m.team1_id=:home OR m.team2_id=:away) AND m.status='completed'");
            $form->execute([':winner'=>$teamId,':scoring'=>$teamId,':defending'=>$teamId,':home'=>$teamId,':away'=>$teamId]);$row=$form->fetch();$games=(int)$row['games'];$wins=(int)$row['wins'];
            $comparison[$side]=['games'=>$games,'wins'=>$wins,'losses'=>$games-$wins,'win_rate'=>$games?round($wins/$games*100,1):0,'points_per_game'=>(float)$row['points_per_game'],'points_allowed'=>(float)$row['points_allowed']];
        }
        $head=$this->db->prepare("SELECT COUNT(*) meetings,SUM(CASE WHEN winner_team_id=:team1 THEN 1 ELSE 0 END) team1_wins,SUM(CASE WHEN winner_team_id=:team2 THEN 1 ELSE 0 END) team2_wins FROM matches WHERE ((team1_id=:a AND team2_id=:b) OR (team1_id=:b2 AND team2_id=:a2)) AND status='completed'");
        $head->execute([':team1'=>$game['team1_id'],':team2'=>$game['team2_id'],':a'=>$game['team1_id'],':b'=>$game['team2_id'],':b2'=>$game['team2_id'],':a2'=>$game['team1_id']]);
        $comparison['head_to_head']=$head->fetch();
        Response::success('Public game details retrieved',['game'=>$game,'lineup'=>$lineup->fetchAll(),'officials'=>$officials->fetchAll(),'comparison'=>$comparison]);
    }

    public function organization(string $slug): void {
        $stmt = $this->db->prepare("SELECT id,name,organization_type,slug,logo_url,primary_color,secondary_color,tagline,
            public_scores,public_player_profiles FROM organizations WHERE slug=:slug AND status='active' LIMIT 1");
        $stmt->execute([':slug'=>$slug]);
        $organization=$stmt->fetch();
        if(!$organization) Response::error('Public organization not found.',404);
        $tid=$this->db->prepare("SELECT t.id,t.name,t.season,t.format,t.start_date,t.end_date,t.status
            FROM tournaments t WHERE t.organization_id=:organization_id AND t.is_published=1
            ORDER BY CASE t.status WHEN 'ongoing' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,t.start_date DESC");
        $tid->execute([':organization_id'=>$organization['id']]);$tournaments=$tid->fetchAll();
        $games=$this->db->prepare("SELECT m.id,m.scheduled_start_time,m.status,m.stage_name,t.name tournament_name,
            h.team_name home_team,a.team_name away_team,c.court_name,ms.team1_score home_score,ms.team2_score away_score
            FROM matches m JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN teams h ON h.id=m.team1_id
            LEFT JOIN teams a ON a.id=m.team2_id LEFT JOIN courts c ON c.id=m.court_id LEFT JOIN match_scores ms ON ms.match_id=m.id
            WHERE t.organization_id=:organization_id AND t.is_published=1 AND m.schedule_status='published'
            ORDER BY COALESCE(m.scheduled_start_time,'9999-12-31') LIMIT 50");
        $games->execute([':organization_id'=>$organization['id']]);
        $standings=$this->db->prepare("SELECT st.rank_position,st.played,st.won,st.lost,st.points_scored,st.points_against,
            st.net_points,tm.team_name,t.name tournament_name,d.name division_name FROM standings st
            JOIN teams tm ON tm.id=st.team_id JOIN tournaments t ON t.id=st.tournament_id
            LEFT JOIN divisions d ON d.id=tm.division_id WHERE t.organization_id=:organization_id AND t.is_published=1
            ORDER BY t.id,d.id,st.rank_position LIMIT 100");
        $standings->execute([':organization_id'=>$organization['id']]);
        $awards=$this->db->prepare("SELECT ac.name,u.full_name,tm.team_name FROM award_categories ac
            JOIN player_awards pa ON pa.award_category_id=ac.id AND pa.status='confirmed'
            JOIN users u ON u.id=pa.user_id LEFT JOIN team_players tp ON tp.user_id=u.id
            LEFT JOIN teams tm ON tm.id=tp.team_id JOIN tournaments t ON t.id=ac.tournament_id
            WHERE t.organization_id=:organization_id AND ac.is_public=1");
        $awards->execute([':organization_id'=>$organization['id']]);
        Response::success('Public basketball organization retrieved',['organization'=>$organization,'tournaments'=>$tournaments,
            'games'=>$games->fetchAll(),'standings'=>$standings->fetchAll(),'awards'=>$awards->fetchAll()]);
    }
}

<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/SimplePdf.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../models/AuditLog.php';

class PdfReportController {
    private PDO $db;
    public function __construct(){ $connection=(new Database())->getConnection();if(!$connection)throw new RuntimeException('Database unavailable.');$this->db=$connection; }

    public function tournament(int $id):void{
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']);
        OrganizationAccess::requireTournament($id,$user);
        $base=$this->tournamentRow($id);$pdf=new SimplePdf();$pdf->heading($base['organization_name']??'FullCourt','Tournament Operations Report',$base['name'].' | '.date('F j, Y'));
        $pdf->section('Competition Summary');$pdf->row(['Season','Format','Dates','Status'],[100,130,180,90],true);$pdf->row([$base['season']?:'N/A',str_replace('_',' ',$base['format']),$base['start_date'].' to '.$base['end_date'],$base['status']],[100,130,180,90]);
        $teams=$this->query("SELECT tm.team_name,d.name division_name,u.full_name coach_name,tm.status,
            (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id=tm.id AND tp.eligibility_status='verified') players
            FROM teams tm LEFT JOIN divisions d ON d.id=tm.division_id JOIN users u ON u.id=tm.coach_user_id WHERE tm.tournament_id=:id ORDER BY d.name,tm.team_name",$id);
        $pdf->section('Teams and Rosters');$pdf->row(['Team','Division','Coach','Players','Status'],[120,100,145,55,80],true);foreach($teams as $r)$pdf->row([$r['team_name'],$r['division_name']?:'Open',$r['coach_name'],$r['players'],$r['status']],[120,100,145,55,80]);
        $standings=$this->query("SELECT st.rank_position,tm.team_name,st.played,st.won,st.lost,st.points_scored,st.points_against,st.net_points FROM standings st JOIN teams tm ON tm.id=st.team_id WHERE st.tournament_id=:id ORDER BY st.rank_position",$id);
        $pdf->section('Standings');$pdf->row(['Rank','Team','GP','W','L','PF','PA','Diff'],[40,170,45,45,45,50,50,55],true);foreach($standings as $r)$pdf->row(array_values($r),[40,170,45,45,45,50,50,55]);
        $this->send($pdf->output(),'tournament-'.$id.'-report.pdf',(int)$user['user_id'],'TOURNAMENT_REPORT',$id);
    }

    public function scoreSheet(int $matchId):void{
        $stmt=$this->db->prepare("SELECT m.*,t.name tournament_name,o.name organization_name,
            h.team_name home_team,a.team_name away_team,c.court_name,v.name venue_name,ms.team1_score,ms.team2_score
            FROM matches m JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN organizations o ON o.id=t.organization_id
            LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id LEFT JOIN courts c ON c.id=m.court_id
            LEFT JOIN venues v ON v.id=c.venue_id LEFT JOIN match_scores ms ON ms.match_id=m.id WHERE m.id=:id AND t.is_published=1");$stmt->execute([':id'=>$matchId]);$m=$stmt->fetch();if(!$m)Response::error('Published match not found.',404);
        $pdf=new SimplePdf();$pdf->heading($m['organization_name']??'FullCourt','Official Basketball Score Sheet',$m['tournament_name'].' | '.$m['venue_name'].' - '.$m['court_name']);
        $pdf->section('Game Information');$pdf->row(['Date / Time','Stage','Status','Final Score'],[155,115,90,140],true);$pdf->row([$m['scheduled_start_time']?:'TBA',$m['stage_name'],$m['status'],($m['home_team']?:'Home').' '.($m['team1_score']??0).' - '.($m['team2_score']??0).' '.($m['away_team']?:'Away')],[155,115,90,140]);
        $players=$this->query("SELECT tm.team_name,tp.jersey_number,u.full_name,
            SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
            SUM(CASE WHEN e.event_type='2pt_made' THEN 1 ELSE 0 END) fg2,SUM(CASE WHEN e.event_type='3pt_made' THEN 1 ELSE 0 END) fg3,SUM(CASE WHEN e.event_type='ft_made' THEN 1 ELSE 0 END) ft,
            SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,SUM(CASE WHEN e.event_type='personal_foul' THEN 1 ELSE 0 END) fouls
            FROM basketball_stat_events e JOIN team_players tp ON tp.id=e.team_player_id JOIN teams tm ON tm.id=e.team_id JOIN users u ON u.id=tp.user_id
            WHERE e.match_id=:id AND e.is_void=0 GROUP BY tm.id,tm.team_name,tp.id,tp.jersey_number,u.full_name ORDER BY tm.id,tp.jersey_number",$matchId);
        $pdf->section('Player Box Score');$pdf->row(['Team','#','Player','PTS','2FG','3FG','FT','REB','AST','PF'],[95,25,145,35,35,35,35,40,40,35],true);foreach($players as $r)$pdf->row(array_values($r),[95,25,145,35,35,35,35,40,40,35]);
        $pdf->paragraph("\nReferee signature: _________________________     Statistician signature: _________________________\nThis digital score sheet was generated from the official FullCourt basketball event log.");
        $this->send($pdf->output(),'match-'.$matchId.'-score-sheet.pdf',null,'FIBA_SCORE_SHEET',(int)$m['tournament_id']);
    }

    private function tournamentRow(int $id):array{$stmt=$this->db->prepare("SELECT t.*,o.name organization_name FROM tournaments t LEFT JOIN organizations o ON o.id=t.organization_id WHERE t.id=:id");$stmt->execute([':id'=>$id]);$row=$stmt->fetch();if(!$row)Response::error('Tournament not found.',404);return $row;}
    private function query(string $sql,int $id):array{$stmt=$this->db->prepare($sql);$stmt->execute([':id'=>$id]);return $stmt->fetchAll();}
    private function send(string $bytes,string $filename,?int $userId,string $type,int $tournamentId):void{
        (new AuditLog())->log($userId,'GENERATE_PDF','REPORTS',"Generated {$type} for tournament {$tournamentId}.");
        if($userId!==null){$stmt=$this->db->prepare("INSERT INTO reports_log (tournament_id,report_type,generated_by,file_url,format) VALUES (:tournament_id,:type,:user_id,:file_url,'pdf')");$stmt->execute([':tournament_id'=>$tournamentId,':type'=>strtolower($type),':user_id'=>$userId,':file_url'=>$filename]);}
        header('Content-Type: application/pdf');header('Content-Disposition: attachment; filename="'.$filename.'"');header('Content-Length: '.strlen($bytes));echo $bytes;exit;
    }
}

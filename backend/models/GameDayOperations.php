<?php
require_once __DIR__.'/../config/database.php';

class GameDayOperations {
    private PDO $db;
    public function __construct(){ $connection=(new Database())->getConnection();if(!$connection)throw new RuntimeException('Database unavailable.');$this->db=$connection; }

    public function tournamentGames(int $tournamentId):array{
        $stmt=$this->db->prepare("SELECT m.id,m.stage_name,m.round_number,m.scheduled_start_time,m.status,t.name tournament_name,
          h.team_name home_team,a.team_name away_team,c.court_name,v.name venue_name,
          COALESCE(gr.venue_ready,FALSE) venue_ready,COALESCE(gr.equipment_ready,FALSE) equipment_ready,
          COALESCE(gr.home_team_present,FALSE) home_team_present,COALESCE(gr.away_team_present,FALSE) away_team_present,
          COALESCE(gr.lineups_confirmed,FALSE) lineups_confirmed,COALESCE(gr.officials_ready,FALSE) officials_ready,
          COALESCE(gr.medical_ready,FALSE) medical_ready,gr.notes,gr.updated_at,
          (SELECT COUNT(*) FROM game_incidents gi WHERE gi.match_id=m.id AND gi.status='open') open_incidents
          FROM matches m JOIN tournaments t ON t.id=m.tournament_id
          LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id
          LEFT JOIN courts c ON c.id=m.court_id LEFT JOIN venues v ON v.id=c.venue_id
          LEFT JOIN game_readiness gr ON gr.match_id=m.id WHERE m.tournament_id=:tournament_id
          ORDER BY COALESCE(m.scheduled_start_time,'9999-12-31'),m.id");
        $stmt->execute([':tournament_id'=>$tournamentId]);return$stmt->fetchAll();
    }
    public function incidents(int $tournamentId):array{
        $stmt=$this->db->prepare("SELECT gi.*,m.stage_name,h.team_name home_team,a.team_name away_team,u.full_name reported_by_name
          FROM game_incidents gi JOIN matches m ON m.id=gi.match_id LEFT JOIN teams h ON h.id=m.team1_id
          LEFT JOIN teams a ON a.id=m.team2_id LEFT JOIN users u ON u.id=gi.reported_by
          WHERE m.tournament_id=:tournament_id ORDER BY gi.created_at DESC");
        $stmt->execute([':tournament_id'=>$tournamentId]);return$stmt->fetchAll();
    }
    public function saveReadiness(int $matchId,array $data,int $userId):void{
        $fields=['venue_ready','equipment_ready','home_team_present','away_team_present','lineups_confirmed','officials_ready','medical_ready'];
        $params=[':match_id'=>$matchId,':notes'=>trim((string)($data['notes']??''))?:null,':user_id'=>$userId];
        foreach($fields as $field)$params[':'.$field]=!empty($data[$field]);
        $this->db->prepare("INSERT INTO game_readiness(match_id,venue_ready,equipment_ready,home_team_present,away_team_present,lineups_confirmed,officials_ready,medical_ready,notes,updated_by)
          VALUES(:match_id,:venue_ready,:equipment_ready,:home_team_present,:away_team_present,:lineups_confirmed,:officials_ready,:medical_ready,:notes,:user_id)
          ON CONFLICT(match_id) DO UPDATE SET venue_ready=EXCLUDED.venue_ready,equipment_ready=EXCLUDED.equipment_ready,home_team_present=EXCLUDED.home_team_present,away_team_present=EXCLUDED.away_team_present,lineups_confirmed=EXCLUDED.lineups_confirmed,officials_ready=EXCLUDED.officials_ready,medical_ready=EXCLUDED.medical_ready,notes=EXCLUDED.notes,updated_by=EXCLUDED.updated_by,updated_at=NOW()")->execute($params);
    }
    public function createIncident(int $matchId,array $data,int $userId):int{
        $stmt=$this->db->prepare("INSERT INTO game_incidents(match_id,incident_type,severity,description,action_taken,reported_by) VALUES(:match_id,:type,:severity,:description,:action,:user_id) RETURNING id");
        $stmt->execute([':match_id'=>$matchId,':type'=>$data['incident_type'],':severity'=>$data['severity'],':description'=>trim($data['description']),':action'=>trim((string)($data['action_taken']??''))?:null,':user_id'=>$userId]);return(int)$stmt->fetchColumn();
    }
    public function incidentTournamentId(int $id):?int{$stmt=$this->db->prepare("SELECT m.tournament_id FROM game_incidents gi JOIN matches m ON m.id=gi.match_id WHERE gi.id=:id");$stmt->execute([':id'=>$id]);$value=$stmt->fetchColumn();return$value===false?null:(int)$value;}
    public function resolveIncident(int $id,int $userId):bool{$stmt=$this->db->prepare("UPDATE game_incidents SET status='resolved',resolved_by=:user_id,resolved_at=NOW() WHERE id=:id AND status='open'");$stmt->execute([':user_id'=>$userId,':id'=>$id]);return$stmt->rowCount()>0;}
}

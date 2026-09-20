<?php

require_once __DIR__ . '/../config/database.php';

class QRAttendance {
    private PDO $db;

    public function __construct() {
        $connection=(new Database())->getConnection();
        if(!$connection)throw new RuntimeException('Database connection is unavailable.');
        $this->db=$connection;
    }

    public function teamQr(int $teamId): ?array {
        $stmt=$this->db->prepare("SELECT tm.id,tm.team_name,tm.qr_code_hash,t.name tournament_name
            FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id WHERE tm.id=:id");
        $stmt->execute([':id'=>$teamId]);$team=$stmt->fetch();
        if(!$team)return null;
        $team['qr_payload']='FULLCOURT:TEAM:'.$team['id'].':'.$team['qr_code_hash'];
        unset($team['qr_code_hash']);return $team;
    }

    public function teamTournamentId(int $teamId): ?int {
        $stmt=$this->db->prepare("SELECT tournament_id FROM teams WHERE id=:id");$stmt->execute([':id'=>$teamId]);$value=$stmt->fetchColumn();return$value===false?null:(int)$value;
    }

    public function assignmentMatchId(int $assignmentId): ?int {
        $stmt=$this->db->prepare("SELECT match_id FROM game_assignments WHERE id=:id");$stmt->execute([':id'=>$assignmentId]);$value=$stmt->fetchColumn();return$value===false?null:(int)$value;
    }

    public function recordTeamCheckin(int $matchId,string $payload,array $playerIds,string $syncUuid,int $scannedBy): array {
        if(!preg_match('/^FULLCOURT:TEAM:(\d+):([a-f0-9]{64})$/',$payload,$parts))throw new InvalidArgumentException('This is not a valid FullCourt team QR code.');
        $teamId=(int)$parts[1];$providedHash=$parts[2];
        $this->db->beginTransaction();
        try{
            $match=$this->db->prepare("SELECT team1_id,team2_id,status FROM matches WHERE id=:id FOR UPDATE");$match->execute([':id'=>$matchId]);$game=$match->fetch();
            if(!$game)throw new InvalidArgumentException('Selected game was not found.');
            if(!in_array($game['status'],['scheduled','in_progress'],true))throw new InvalidArgumentException('Check-in is only available for scheduled or active games.');
            if(!in_array($teamId,[(int)$game['team1_id'],(int)$game['team2_id']],true))throw new InvalidArgumentException('This team is not playing in the selected game.');
            $team=$this->db->prepare("SELECT qr_code_hash FROM teams WHERE id=:id");$team->execute([':id'=>$teamId]);$stored=(string)$team->fetchColumn();
            if($stored===''||!hash_equals($stored,$providedHash))throw new InvalidArgumentException('Team QR code is invalid or has been replaced.');
            $duplicate=$this->db->prepare("SELECT id,scanned_at FROM qr_attendance WHERE sync_uuid=:uuid OR (match_id=:match_id AND team_id=:team_id) LIMIT 1");
            $duplicate->execute([':uuid'=>$syncUuid,':match_id'=>$matchId,':team_id'=>$teamId]);$existing=$duplicate->fetch();
            if($existing){$this->db->commit();return['status'=>'duplicate','message'=>'Team was already checked in at '.$existing['scanned_at'],'team_id'=>$teamId];}
            $insert=$this->db->prepare("INSERT INTO qr_attendance(sync_uuid,match_id,team_id,qr_hash,attendance_type,scanned_by,status)
                VALUES(:uuid,:match_id,:team_id,:hash,'coach_checkin',:scanned_by,'success')");
            $insert->execute([':uuid'=>$syncUuid,':match_id'=>$matchId,':team_id'=>$teamId,':hash'=>hash('sha256',$payload),':scanned_by'=>$scannedBy]);
            if($playerIds){
                $valid=$this->db->prepare("SELECT id FROM team_players WHERE team_id=:team_id AND eligibility_status='verified'");$valid->execute([':team_id'=>$teamId]);
                $allowed=array_map('intval',array_column($valid->fetchAll(),'id'));$present=array_values(array_intersect($allowed,array_map('intval',$playerIds)));
                $lineup=$this->db->prepare("INSERT INTO game_lineups(match_id,team_player_id,is_present,is_starter,confirmed_by)
                    VALUES(:match_id,:player_id,:present,0,:user_id) ON CONFLICT (match_id,team_player_id) DO UPDATE SET is_present=EXCLUDED.is_present,confirmed_by=EXCLUDED.confirmed_by");
                foreach($allowed as $playerId)$lineup->execute([':match_id'=>$matchId,':player_id'=>$playerId,':present'=>in_array($playerId,$present,true)?1:0,':user_id'=>$scannedBy]);
            }
            $this->db->commit();return['status'=>'success','message'=>'Team check-in verified and saved.','team_id'=>$teamId];
        }catch(Throwable $error){$this->db->rollBack();throw$error;}
    }

    public function issueOfficialToken(int $assignmentId,int $userId,bool $manager): array {
        $stmt=$this->db->prepare("SELECT ga.id,ga.user_id,ga.status,ga.assignment_role,m.id match_id,m.scheduled_start_time,
            h.team_name home_team,a.team_name away_team FROM game_assignments ga JOIN matches m ON m.id=ga.match_id
            LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id WHERE ga.id=:id");
        $stmt->execute([':id'=>$assignmentId]);$assignment=$stmt->fetch();
        if(!$assignment||(!$manager&&(int)$assignment['user_id']!==$userId))throw new InvalidArgumentException('Game assignment not found.');
        if($assignment['status']!=='accepted')throw new InvalidArgumentException('The assignment must be accepted before generating game access.');
        $token=bin2hex(random_bytes(32));
        $update=$this->db->prepare("UPDATE game_assignments SET qr_token_hash=:hash,qr_expires_at=NOW() + INTERVAL '12 hours',qr_used_at=NULL WHERE id=:id");
        $update->execute([':hash'=>hash('sha256',$token),':id'=>$assignmentId]);
        $assignment['qr_payload']='FULLCOURT:OFFICIAL:'.$assignmentId.':'.$token;$assignment['expires_in_hours']=12;
        return$assignment;
    }

    public function validateOfficialToken(int $matchId,string $payload): array {
        if(!preg_match('/^FULLCOURT:OFFICIAL:(\d+):([a-f0-9]{64})$/',$payload,$parts))throw new InvalidArgumentException('This is not a valid FullCourt official QR code.');
        $assignmentId=(int)$parts[1];$token=$parts[2];
        $this->db->beginTransaction();
        try{
            $stmt=$this->db->prepare("SELECT ga.*,u.full_name,m.status match_status FROM game_assignments ga JOIN users u ON u.id=ga.user_id JOIN matches m ON m.id=ga.match_id WHERE ga.id=:id FOR UPDATE");
            $stmt->execute([':id'=>$assignmentId]);$row=$stmt->fetch();
            if(!$row||(int)$row['match_id']!==$matchId)throw new InvalidArgumentException('Official QR is assigned to a different game.');
            if(!in_array($row['match_status'],['scheduled','in_progress'],true))throw new InvalidArgumentException('Game access is closed for this match.');
            if($row['status']!=='accepted')throw new InvalidArgumentException('Official assignment is not accepted.');
            if($row['qr_used_at'])throw new InvalidArgumentException('Official QR has already been used.');
            if(!$row['qr_expires_at']||strtotime($row['qr_expires_at'])<time())throw new InvalidArgumentException('Official QR has expired.');
            if(!$row['qr_token_hash']||!hash_equals($row['qr_token_hash'],hash('sha256',$token)))throw new InvalidArgumentException('Official QR token is invalid.');
            $this->db->prepare("UPDATE game_assignments SET qr_used_at=NOW() WHERE id=:id")->execute([':id'=>$assignmentId]);
            $this->db->commit();return['assignment_id'=>$assignmentId,'match_id'=>$matchId,'official_name'=>$row['full_name'],'assignment_role'=>$row['assignment_role'],'access_path'=>'/games/'.$matchId.'/live'];
        }catch(Throwable $error){$this->db->rollBack();throw$error;}
    }

    public function getMatchAttendance(int $matchId): array {
        $stmt=$this->db->prepare("SELECT qa.*,tm.team_name,u.full_name scanned_by_name FROM qr_attendance qa
            JOIN teams tm ON tm.id=qa.team_id JOIN users u ON u.id=qa.scanned_by WHERE qa.match_id=:id ORDER BY qa.scanned_at DESC");
        $stmt->execute([':id'=>$matchId]);return$stmt->fetchAll();
    }
}

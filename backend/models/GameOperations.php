<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/MatchScore.php';

class GameOperations {
    private PDO $db;

    public function __construct() {
        $connection = (new Database())->getConnection();
        if (!$connection) throw new RuntimeException('Database connection is unavailable.');
        $this->db = $connection;
    }

    public function assignments(int $userId, bool $all = false, bool $platform = false): array {
        $where = 'WHERE ga.user_id = :user_id';
        if ($platform) $where = '';
        elseif ($all) $where = "WHERE EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=t.organization_id AND om.user_id=:user_id AND om.status='active')";
        $sql = "SELECT ga.*, m.scheduled_start_time, m.status AS match_status, t.name AS tournament_name,
            home.team_name AS home_team, away.team_name AS away_team, c.court_name, v.name AS venue_name,
            u.full_name AS assignee_name
            FROM game_assignments ga JOIN matches m ON m.id=ga.match_id JOIN tournaments t ON t.id=m.tournament_id
            JOIN users u ON u.id=ga.user_id LEFT JOIN teams home ON home.id=m.team1_id
            LEFT JOIN teams away ON away.id=m.team2_id LEFT JOIN courts c ON c.id=m.court_id
            LEFT JOIN venues v ON v.id=c.venue_id {$where} ORDER BY m.scheduled_start_time";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($platform ? [] : [':user_id'=>$userId]);
        return $stmt->fetchAll();
    }

    public function hasAcceptedStatisticianAssignment(int $matchId, int $userId): bool {
        $stmt = $this->db->prepare("SELECT 1 FROM game_assignments WHERE match_id=:match_id AND user_id=:user_id AND assignment_role='statistician' AND status='accepted' LIMIT 1");
        $stmt->execute([':match_id'=>$matchId, ':user_id'=>$userId]);
        return (bool)$stmt->fetchColumn();
    }

    public function assign(int $matchId, int $userId, string $role): int {
        $token = bin2hex(random_bytes(32));
        $stmt = $this->db->prepare("INSERT INTO game_assignments
            (match_id,user_id,assignment_role,qr_token_hash,qr_expires_at)
            VALUES (:match_id,:user_id,:role,:token,NOW() + INTERVAL '7 days')
            ON CONFLICT (match_id,user_id,assignment_role) DO UPDATE SET status='pending', qr_token_hash=EXCLUDED.qr_token_hash,
            qr_expires_at=EXCLUDED.qr_expires_at, qr_used_at=NULL RETURNING id");
        $stmt->execute([':match_id'=>$matchId,':user_id'=>$userId,':role'=>$role,':token'=>hash('sha256',$token)]);
        return (int)$stmt->fetchColumn();
    }

    public function respondAssignment(int $id, int $userId, string $status): bool {
        $stmt = $this->db->prepare("UPDATE game_assignments SET status=:status WHERE id=:id AND user_id=:user_id");
        $stmt->execute([':status'=>$status,':id'=>$id,':user_id'=>$userId]);
        return $stmt->rowCount() > 0;
    }

    public function saveLineup(int $matchId, array $players, int $userId): void {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("INSERT INTO game_lineups
                (match_id,team_player_id,is_present,is_starter,confirmed_by)
                VALUES (:match_id,:player_id,:present,:starter,:confirmed_by)
                ON CONFLICT (match_id,team_player_id) DO UPDATE SET is_present=EXCLUDED.is_present,is_starter=EXCLUDED.is_starter,confirmed_by=EXCLUDED.confirmed_by");
            $starterCount = 0;
            foreach ($players as $player) {
                if (!empty($player['is_starter'])) $starterCount++;
                $stmt->execute([':match_id'=>$matchId,':player_id'=>(int)$player['team_player_id'],
                    ':present'=>!empty($player['is_present']) ? 1 : 0, ':starter'=>!empty($player['is_starter']) ? 1 : 0,
                    ':confirmed_by'=>$userId]);
            }
            if ($starterCount !== 5) throw new InvalidArgumentException('A basketball lineup must have exactly five starters.');
            $minutes=$this->db->prepare("INSERT INTO player_game_minutes (match_id,team_player_id,seconds_played,last_entered_elapsed_seconds,is_on_court)
                VALUES (:match_id,:player_id,0,0,:on_court) ON CONFLICT (match_id,team_player_id) DO UPDATE SET is_on_court=EXCLUDED.is_on_court,last_entered_elapsed_seconds=CASE WHEN EXCLUDED.is_on_court=1 THEN 0 ELSE NULL END");
            foreach($players as $player){$minutes->execute([':match_id'=>$matchId,':player_id'=>(int)$player['team_player_id'],':on_court'=>!empty($player['is_starter'])?1:0]);}
            $this->db->prepare("UPDATE matches SET lineups_confirmed_at=NOW() WHERE id=:id")->execute([':id'=>$matchId]);
            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function lineup(int $matchId): array {
        $stmt=$this->db->prepare("SELECT tp.id team_player_id,tp.team_id,tp.user_id,tp.jersey_number,tp.position,
            u.full_name,tm.team_name,COALESCE(gl.is_present,1) is_present,COALESCE(gl.is_starter,0) is_starter,
            COALESCE(pgm.seconds_played,0) seconds_played,COALESCE(pgm.is_on_court,0) is_on_court
            FROM matches m JOIN teams tm ON tm.id IN (m.team1_id,m.team2_id)
            JOIN team_players tp ON tp.team_id=tm.id AND tp.eligibility_status='verified'
            JOIN users u ON u.id=tp.user_id LEFT JOIN game_lineups gl ON gl.match_id=m.id AND gl.team_player_id=tp.id
            LEFT JOIN player_game_minutes pgm ON pgm.match_id=m.id AND pgm.team_player_id=tp.id
            WHERE m.id=:match_id ORDER BY tm.id,tp.jersey_number,u.full_name");
        $stmt->execute([':match_id'=>$matchId]);return $stmt->fetchAll();
    }

    public function substitute(int $matchId,int $playerOutId,int $playerInId,int $period,int $clock,int $userId):void {
        $elapsed=max(0,(max(1,$period)-1)*600+(600-max(0,min(600,$clock))));
        $this->db->beginTransaction();
        try {
            $lock=$this->db->prepare("SELECT team_player_id,seconds_played,last_entered_elapsed_seconds,is_on_court FROM player_game_minutes WHERE match_id=:match_id AND team_player_id IN (:out_id,:in_id) FOR UPDATE");
            $lock->execute([':match_id'=>$matchId,':out_id'=>$playerOutId,':in_id'=>$playerInId]);$rows=$lock->fetchAll(PDO::FETCH_UNIQUE|PDO::FETCH_ASSOC);
            if(empty($rows[$playerOutId])||empty($rows[$playerInId])||!(int)$rows[$playerOutId]['is_on_court']||(int)$rows[$playerInId]['is_on_court']) throw new InvalidArgumentException('Select one on-court player out and one bench player in.');
            $played=max(0,$elapsed-(int)$rows[$playerOutId]['last_entered_elapsed_seconds']);
            $this->db->prepare("UPDATE player_game_minutes SET seconds_played=seconds_played+:played,is_on_court=0,last_entered_elapsed_seconds=NULL WHERE match_id=:match_id AND team_player_id=:id")
                ->execute([':played'=>$played,':match_id'=>$matchId,':id'=>$playerOutId]);
            $this->db->prepare("UPDATE player_game_minutes SET is_on_court=1,last_entered_elapsed_seconds=:elapsed WHERE match_id=:match_id AND team_player_id=:id")
                ->execute([':elapsed'=>$elapsed,':match_id'=>$matchId,':id'=>$playerInId]);
            $player=$this->db->prepare("SELECT team_id FROM team_players WHERE id=:id");$player->execute([':id'=>$playerInId]);$teamId=(int)$player->fetchColumn();
            $this->recordStatWithinTransaction($matchId,['event_uuid'=>bin2hex(random_bytes(16)),'team_id'=>$teamId,'team_player_id'=>$playerInId,'event_type'=>'substitution','period'=>$period,'game_clock_seconds'=>$clock,'metadata'=>['player_out_id'=>$playerOutId,'player_in_id'=>$playerInId]],$userId);
            $this->db->commit();
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }

    public function recordStat(int $matchId, array $data, int $userId): int {
        $points = ['2pt_made'=>2,'3pt_made'=>3,'ft_made'=>1][$data['event_type']] ?? 0;
        $this->db->beginTransaction();
        try {
            $id=$this->recordStatWithinTransaction($matchId,$data,$userId);
            $this->db->commit();
            return $id;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function recordStatWithinTransaction(int $matchId,array $data,int $userId):int {
            $points = ['2pt_made'=>2,'3pt_made'=>3,'ft_made'=>1][$data['event_type']] ?? 0;
            $stmt = $this->db->prepare("INSERT INTO basketball_stat_events
                (event_uuid,match_id,team_id,team_player_id,event_type,period,game_clock_seconds,metadata_json,recorded_by)
                VALUES (:uuid,:match_id,:team_id,:player_id,:type,:period,:clock,:metadata,:recorded_by)");
            $stmt->execute([':uuid'=>$data['event_uuid'],':match_id'=>$matchId,':team_id'=>(int)$data['team_id'],
                ':player_id'=>empty($data['team_player_id']) ? null : (int)$data['team_player_id'], ':type'=>$data['event_type'],
                ':period'=>(int)($data['period'] ?? 1), ':clock'=>(int)($data['game_clock_seconds'] ?? 600),
                ':metadata'=>json_encode($data['metadata'] ?? []), ':recorded_by'=>$userId]);
            $id = (int)$this->db->lastInsertId();
            if ($points > 0) {
                $score = $this->db->prepare("UPDATE match_scores ms SET
                    team1_score=ms.team1_score + CASE WHEN m.team1_id=:team_id_home THEN :points_home ELSE 0 END,
                    team2_score=ms.team2_score + CASE WHEN m.team2_id=:team_id_away THEN :points_away ELSE 0 END
                    FROM matches m WHERE m.id=ms.match_id AND ms.match_id=:match_id AND m.status <> 'completed'");
                $score->execute([':team_id_home'=>(int)$data['team_id'],':points_home'=>$points,
                    ':team_id_away'=>(int)$data['team_id'],':points_away'=>$points,':match_id'=>$matchId]);
            }
            return $id;
    }

    public function voidStat(int $matchId, int $eventId): bool {
        $stmt = $this->db->prepare("UPDATE basketball_stat_events SET is_void=1 WHERE id=:id AND match_id=:match_id AND is_void=0");
        $stmt->execute([':id'=>$eventId,':match_id'=>$matchId]);
        return $stmt->rowCount() > 0;
    }

    public function boxScore(int $matchId): array {
        $stmt = $this->db->prepare("SELECT tp.id team_player_id, u.full_name, tp.jersey_number, tm.id team_id, tm.team_name,
            SUM(CASE WHEN e.event_type='2pt_made' THEN 1 ELSE 0 END) fg2m, SUM(CASE WHEN e.event_type IN ('2pt_made','2pt_missed') THEN 1 ELSE 0 END) fg2a,
            SUM(CASE WHEN e.event_type='3pt_made' THEN 1 ELSE 0 END) fg3m, SUM(CASE WHEN e.event_type IN ('3pt_made','3pt_missed') THEN 1 ELSE 0 END) fg3a,
            SUM(CASE WHEN e.event_type='ft_made' THEN 1 ELSE 0 END) ftm, SUM(CASE WHEN e.event_type IN ('ft_made','ft_missed') THEN 1 ELSE 0 END) fta,
            SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds, SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,
            SUM(CASE WHEN e.event_type='steal' THEN 1 ELSE 0 END) steals, SUM(CASE WHEN e.event_type='block' THEN 1 ELSE 0 END) blocks,
            SUM(CASE WHEN e.event_type='turnover' THEN 1 ELSE 0 END) turnovers, SUM(CASE WHEN e.event_type='personal_foul' THEN 1 ELSE 0 END) fouls,
            tp.position,COALESCE(pgm.seconds_played,0) seconds_played,ROUND(COALESCE(pgm.seconds_played,0)/60,1) minutes_played,
            SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points
            FROM basketball_stat_events e JOIN team_players tp ON tp.id=e.team_player_id
            JOIN users u ON u.id=tp.user_id JOIN teams tm ON tm.id=e.team_id LEFT JOIN player_game_minutes pgm ON pgm.match_id=e.match_id AND pgm.team_player_id=tp.id
            WHERE e.match_id=:match_id AND e.is_void=0 GROUP BY tp.id,u.full_name,tp.jersey_number,tm.id,tm.team_name,tp.position,pgm.seconds_played
            ORDER BY tm.id,points DESC");
        $stmt->execute([':match_id'=>$matchId]);
        return $stmt->fetchAll();
    }

    public function requestCorrection(int $matchId, array $data, int $userId): int {
        $score = $this->db->prepare("SELECT team1_score,team2_score FROM match_scores WHERE match_id=:match_id");
        $score->execute([':match_id'=>$matchId]);
        $original = $score->fetch();
        if (!$original) throw new InvalidArgumentException('Match score does not exist.');
        $stmt = $this->db->prepare("INSERT INTO score_corrections
            (match_id,original_home_score,original_away_score,requested_home_score,requested_away_score,reason,supporting_notes,requested_by)
            VALUES (:match_id,:oh,:oa,:rh,:ra,:reason,:notes,:requested_by)");
        $stmt->execute([':match_id'=>$matchId,':oh'=>$original['team1_score'],':oa'=>$original['team2_score'],
            ':rh'=>(int)$data['home_score'],':ra'=>(int)$data['away_score'],':reason'=>$data['reason'],
            ':notes'=>$data['supporting_notes'] ?? null,':requested_by'=>$userId]);
        return (int)$this->db->lastInsertId();
    }

    public function corrections(int $userId, bool $platform = false): array {
        $where = $platform ? '' : "WHERE EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=t.organization_id AND om.user_id=:user_id AND om.status='active')";
        $stmt = $this->db->prepare("SELECT sc.*,t.name tournament_name,h.team_name home_team,a.team_name away_team,
            u.full_name requester_name FROM score_corrections sc JOIN matches m ON m.id=sc.match_id
            JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN teams h ON h.id=m.team1_id
            LEFT JOIN teams a ON a.id=m.team2_id JOIN users u ON u.id=sc.requested_by {$where} ORDER BY sc.created_at DESC");
        $stmt->execute($platform ? [] : [':user_id'=>$userId]);
        return $stmt->fetchAll();
    }

    public function correctionTournamentId(int $id): ?int {
        $stmt=$this->db->prepare("SELECT m.tournament_id FROM score_corrections sc JOIN matches m ON m.id=sc.match_id WHERE sc.id=:id");
        $stmt->execute([':id'=>$id]);$value=$stmt->fetchColumn();return $value===false?null:(int)$value;
    }

    public function reviewCorrection(int $id, string $status, int $reviewerId): bool {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT sc.*,m.tournament_id FROM score_corrections sc JOIN matches m ON m.id=sc.match_id WHERE sc.id=:id FOR UPDATE");
            $stmt->execute([':id'=>$id]);
            $row = $stmt->fetch();
            if (!$row || $row['status'] !== 'pending') throw new InvalidArgumentException('Pending correction not found.');
            if ($status === 'approved') {
                $this->db->prepare("UPDATE match_scores SET team1_score=:home,team2_score=:away WHERE match_id=:match_id")
                    ->execute([':home'=>$row['requested_home_score'],':away'=>$row['requested_away_score'],':match_id'=>$row['match_id']]);
            }
            $this->db->prepare("UPDATE score_corrections SET status=:status,reviewed_by=:reviewer,reviewed_at=NOW() WHERE id=:id")
                ->execute([':status'=>$status,':reviewer'=>$reviewerId,':id'=>$id]);
            $this->db->commit();
            if ($status === 'approved') (new MatchScore())->recomputeStandings((int)$row['tournament_id']);
            return true;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}

<?php

require_once __DIR__ . '/../config/database.php';

class ScoringAccess {
    private PDO $db;

    public function __construct() {
        $connection = (new Database())->getConnection();
        if (!$connection) throw new RuntimeException('Database connection is unavailable.');
        $this->db = $connection;
    }

    public function create(int $matchId, int $createdBy, string $label, int $hours): array {
        $token = bin2hex(random_bytes(32));
        $pin = (string)random_int(100000, 999999);
        $this->db->prepare("UPDATE game_scoring_links SET revoked_at=NOW() WHERE match_id=:match_id AND revoked_at IS NULL")
            ->execute([':match_id'=>$matchId]);
        $stmt = $this->db->prepare("INSERT INTO game_scoring_links
            (match_id,created_by,operator_label,token_hash,pin_hash,expires_at)
            VALUES (:match_id,:created_by,:label,:token_hash,:pin_hash,NOW() + (:hours * INTERVAL '1 hour'))
            RETURNING id,expires_at");
        $stmt->execute([
            ':match_id'=>$matchId, ':created_by'=>$createdBy, ':label'=>$label,
            ':token_hash'=>hash('sha256',$token), ':pin_hash'=>password_hash($pin,PASSWORD_DEFAULT), ':hours'=>$hours,
        ]);
        $row=$stmt->fetch();
        return ['id'=>(int)$row['id'],'token'=>$token,'pin'=>$pin,'expires_at'=>$row['expires_at'],'operator_label'=>$label];
    }

    public function findActiveByToken(string $token): ?array {
        $stmt=$this->db->prepare("SELECT gsl.*,m.status match_status,m.scheduled_start_time,t.name tournament_name,
            h.team_name home_team,a.team_name away_team,c.court_name,v.name venue_name
            FROM game_scoring_links gsl JOIN matches m ON m.id=gsl.match_id
            JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN teams h ON h.id=m.team1_id
            LEFT JOIN teams a ON a.id=m.team2_id LEFT JOIN courts c ON c.id=m.court_id
            LEFT JOIN venues v ON v.id=c.venue_id
            WHERE gsl.token_hash=:hash AND gsl.revoked_at IS NULL AND gsl.expires_at>NOW() LIMIT 1");
        $stmt->execute([':hash'=>hash('sha256',$token)]);$row=$stmt->fetch();return$row?:null;
    }

    public function findActiveById(int $id): ?array {
        $stmt=$this->db->prepare("SELECT gsl.*,m.status match_status FROM game_scoring_links gsl JOIN matches m ON m.id=gsl.match_id WHERE gsl.id=:id AND gsl.revoked_at IS NULL AND gsl.expires_at>NOW() LIMIT 1");
        $stmt->execute([':id'=>$id]);$row=$stmt->fetch();return$row?:null;
    }

    public function activate(string $token, string $pin, string $operatorName): ?array {
        $row=$this->findActiveByToken($token);
        if(!$row || !password_verify($pin,(string)$row['pin_hash'])) return null;
        $this->db->prepare("UPDATE game_scoring_links SET operator_name=:name,last_used_at=NOW() WHERE id=:id")
            ->execute([':name'=>$operatorName,':id'=>$row['id']]);
        $row['operator_name']=$operatorName;return$row;
    }

    public function touch(int $id): void {
        $this->db->prepare("UPDATE game_scoring_links SET last_used_at=NOW() WHERE id=:id")->execute([':id'=>$id]);
    }

    public function updateGameClock(int $matchId, string $period, int $timerSeconds, bool $isRunning): bool {
        $this->db->beginTransaction();
        try {
            $exists=$this->db->prepare("SELECT 1 FROM match_scores WHERE match_id=:match_id LIMIT 1");
            $exists->execute([':match_id'=>$matchId]);
            if (!$exists->fetchColumn()) {
                $this->db->rollBack();
                return false;
            }
            $score=$this->db->prepare("UPDATE match_scores SET current_period=:period,timer_seconds=:seconds,is_timer_running=:running,updated_at=NOW() WHERE match_id=:match_id");
            $score->execute([':period'=>$period,':seconds'=>$timerSeconds,':running'=>$isRunning?1:0,':match_id'=>$matchId]);
            $this->db->prepare("UPDATE matches SET status='in_progress',actual_start_time=COALESCE(actual_start_time,NOW()) WHERE id=:match_id AND status='scheduled'")
                ->execute([':match_id'=>$matchId]);
            $this->db->commit();
            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $e;
        }
    }

    public function revoke(int $id): bool {
        $stmt=$this->db->prepare("UPDATE game_scoring_links SET revoked_at=NOW() WHERE id=:id AND revoked_at IS NULL");
        $stmt->execute([':id'=>$id]);return$stmt->rowCount()>0;
    }

    public function matchIdForLink(int $id): ?int {
        $stmt=$this->db->prepare("SELECT match_id FROM game_scoring_links WHERE id=:id");$stmt->execute([':id'=>$id]);
        $value=$stmt->fetchColumn();return$value===false?null:(int)$value;
    }
}

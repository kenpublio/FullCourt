<?php

require_once __DIR__ . '/../config/database.php';

class Engagement {
    private PDO $db;
    public function __construct() {
        $connection=(new Database())->getConnection();
        if(!$connection) throw new RuntimeException('Database connection is unavailable.');
        $this->db=$connection;
    }
    public function notifications(int $userId): array {
        $stmt=$this->db->prepare("SELECT * FROM notifications WHERE user_id=:user_id ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([':user_id'=>$userId]); return $stmt->fetchAll();
    }
    public function notify(int $userId,string $type,string $title,string $message,?string $url=null): int {
        $stmt=$this->db->prepare("INSERT INTO notifications (user_id,notification_type,title,message,action_url) VALUES (:user_id,:type,:title,:message,:url)");
        $stmt->execute([':user_id'=>$userId,':type'=>$type,':title'=>$title,':message'=>$message,':url'=>$url]);
        return (int)$this->db->lastInsertId();
    }
    public function markRead(int $id,int $userId): bool {
        $stmt=$this->db->prepare("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=:id AND user_id=:user_id");
        $stmt->execute([':id'=>$id,':user_id'=>$userId]); return $stmt->rowCount()>0;
    }
    public function markAllRead(int $userId): void {
        $this->db->prepare("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE user_id=:user_id")->execute([':user_id'=>$userId]);
    }
    public function awards(int $tournamentId): array {
        $stmt=$this->db->prepare("SELECT ac.id category_id,ac.name,ac.metric_key,ac.is_public,pa.id award_id,
            pa.status,u.id user_id,u.full_name,u.avatar_url,tp.jersey_number,
            COALESCE(pp.primary_position,tp.position) position,tm.team_name,
            COALESCE(stats.games_played,0) games_played,COALESCE(stats.points,0) points,
            COALESCE(stats.rebounds,0) rebounds,COALESCE(stats.assists,0) assists,
            COALESCE(stats.defense,0) defense,COALESCE(stats.turnovers,0) turnovers,
            COALESCE(stats.rating,0) rating
            FROM award_categories ac LEFT JOIN player_awards pa ON pa.award_category_id=ac.id
            LEFT JOIN users u ON u.id=pa.user_id LEFT JOIN team_players tp ON tp.user_id=u.id
            LEFT JOIN teams tm ON tm.id=tp.team_id AND tm.tournament_id=ac.tournament_id
            LEFT JOIN player_profiles pp ON pp.user_id=u.id
            LEFT JOIN (SELECT m.tournament_id,tp.user_id,COUNT(DISTINCT e.match_id) games_played,
                SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
                SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,
                SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,
                SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END) defense,
                SUM(CASE WHEN e.event_type='turnover' THEN 1 ELSE 0 END) turnovers,
                ROUND(SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END)
                +SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END)*1.2
                +SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END)*1.5
                +SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END)*2
                -SUM(CASE WHEN e.event_type='turnover' THEN 1 ELSE 0 END)*1.2,2) rating
                FROM basketball_stat_events e JOIN matches m ON m.id=e.match_id
                JOIN team_players tp ON tp.id=e.team_player_id WHERE e.is_void=0
                GROUP BY m.tournament_id,tp.user_id) stats ON stats.tournament_id=ac.tournament_id AND stats.user_id=u.id
            WHERE ac.tournament_id=:tournament_id ORDER BY ac.id");
        $stmt->execute([':tournament_id'=>$tournamentId]); return $stmt->fetchAll();
    }
    public function recommendAwards(int $tournamentId): array {
        $categories=['Scoring Leader'=>'points','Rebounding Leader'=>'rebounds','Assist Leader'=>'assists','Defensive Performer'=>'defense'];
        $positions=['Point Guard'=>'PG','Shooting Guard'=>'SG','Small Forward'=>'SF','Power Forward'=>'PF','Center'=>'C'];
        $this->db->beginTransaction();
        try {
            $cat=$this->db->prepare("INSERT INTO award_categories (tournament_id,name,metric_key) VALUES (:tid,:name,:metric)
                ON CONFLICT (tournament_id,name) DO UPDATE SET metric_key=EXCLUDED.metric_key RETURNING id");
            $winnerSql="SELECT tp.user_id,
                SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
                SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,
                SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END) defense FROM basketball_stat_events e
                JOIN matches m ON m.id=e.match_id JOIN team_players tp ON tp.id=e.team_player_id
                WHERE m.tournament_id=:tid AND e.is_void=0 AND tp.user_id IS NOT NULL
                GROUP BY tp.user_id ORDER BY %s DESC LIMIT 1";
            $award=$this->db->prepare("INSERT INTO player_awards (award_category_id,user_id,status) VALUES (:category,:user_id,'recommended')
                ON CONFLICT (award_category_id,user_id) DO UPDATE SET status=CASE WHEN player_awards.status='confirmed' THEN 'confirmed' ELSE 'recommended' END");
            foreach($categories as $name=>$metric){
                $cat->execute([':tid'=>$tournamentId,':name'=>$name,':metric'=>$metric]);
                $categoryId=(int)$cat->fetchColumn();
                $query=$this->db->prepare(sprintf($winnerSql,$metric));
                $query->execute([':tid'=>$tournamentId]);$userId=$query->fetchColumn();
                if($userId)$award->execute([':category'=>$categoryId,':user_id'=>(int)$userId]);
            }
            $cat->execute([':tid'=>$tournamentId,':name'=>'Tournament MVP',':metric'=>'mvp_rating']);
            $mvpCategoryId=(int)$cat->fetchColumn();
            $mvpWinner=$this->db->prepare("SELECT tp.user_id,
                SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END)*1.2
                + SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END)*1.5
                + SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END)*2
                - SUM(CASE WHEN e.event_type='turnover' THEN 1 ELSE 0 END)*1.2 AS rating
                FROM basketball_stat_events e JOIN matches m ON m.id=e.match_id
                JOIN team_players tp ON tp.id=e.team_player_id
                WHERE m.tournament_id=:tid AND e.is_void=0 AND tp.user_id IS NOT NULL
                GROUP BY tp.user_id ORDER BY rating DESC LIMIT 1");
            $mvpWinner->execute([':tid'=>$tournamentId]);$mvpUserId=$mvpWinner->fetchColumn();
            if($mvpUserId)$award->execute([':category'=>$mvpCategoryId,':user_id'=>(int)$mvpUserId]);
            $positionWinner=$this->db->prepare("SELECT tp.user_id,
                ROUND(SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END)
                + SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END)*1.2 + SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END)*1.5
                + SUM(CASE WHEN e.event_type IN ('steal','block') THEN 1 ELSE 0 END)*2 - SUM(CASE WHEN e.event_type='turnover' THEN 1 ELSE 0 END)*1.2,2) rating
                FROM basketball_stat_events e JOIN matches m ON m.id=e.match_id JOIN team_players tp ON tp.id=e.team_player_id
                LEFT JOIN player_profiles pp ON pp.user_id=tp.user_id
                WHERE m.tournament_id=:tid AND e.is_void=0
                AND COALESCE(pp.primary_position,tp.position) IN (:position_name,:position_code)
                GROUP BY tp.user_id HAVING COUNT(DISTINCT e.match_id)>0 ORDER BY rating DESC LIMIT 1");
            foreach($positions as $label=>$position){
                $name='Mythical Five - '.$label;$cat->execute([':tid'=>$tournamentId,':name'=>$name,':metric'=>'mythical_'.$position]);
                $categoryId=(int)$cat->fetchColumn();
                $positionWinner->execute([':tid'=>$tournamentId,':position_name'=>$label,':position_code'=>$position]);$userId=$positionWinner->fetchColumn();
                if($userId)$award->execute([':category'=>$categoryId,':user_id'=>(int)$userId]);
            }
            $this->db->commit(); return $this->awards($tournamentId);
        }catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public function confirmAward(int $awardId,int $userId,bool $publish): bool {
        $this->db->beginTransaction();
        try {
            $stmt=$this->db->prepare("UPDATE player_awards SET status='confirmed',confirmed_by=:user_id,confirmed_at=NOW() WHERE id=:id RETURNING award_category_id");
            $stmt->execute([':user_id'=>$userId,':id'=>$awardId]);
            $categoryId=$stmt->fetchColumn();
            if($categoryId===false){$this->db->rollBack();return false;}
            $this->db->prepare("UPDATE award_categories SET is_public=:publish WHERE id=:id")
                ->execute([':publish'=>$publish?1:0,':id'=>$categoryId]);
            $this->db->commit();return true;
        } catch(Throwable $e){$this->db->rollBack();throw $e;}
    }
    public function awardTournamentId(int $awardId): ?int {
        $stmt=$this->db->prepare("SELECT ac.tournament_id FROM player_awards pa JOIN award_categories ac ON ac.id=pa.award_category_id WHERE pa.id=:id");
        $stmt->execute([':id'=>$awardId]);$value=$stmt->fetchColumn();return $value===false?null:(int)$value;
    }
}

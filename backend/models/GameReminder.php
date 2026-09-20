<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/NotificationMailer.php';

class GameReminder {
    private PDO $db;
    public function __construct() {
        $connection=(new Database())->getConnection();
        if(!$connection) throw new RuntimeException('Database connection is unavailable.');
        $this->db=$connection;
    }

    public function dispatchDue(): array {
        $matches=$this->db->query("SELECT m.id,m.scheduled_start_time,h.team_name home_team,a.team_name away_team
            FROM matches m LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id
            WHERE m.status='scheduled' AND m.schedule_status='published' AND m.reminder_30_sent_at IS NULL
              AND m.scheduled_start_time BETWEEN NOW() + INTERVAL '25 minutes' AND NOW() + INTERVAL '35 minutes'
            FOR UPDATE OF m")->fetchAll();
        $sent=0;$emailsSent=0;$emailsFailed=0;$mailer=new NotificationMailer();
        foreach($matches as $match){
            $this->db->beginTransaction();
            try {
                $users=$this->db->prepare("SELECT DISTINCT recipient_id FROM (
                    SELECT tp.user_id recipient_id FROM matches m JOIN team_players tp ON tp.team_id IN(m.team1_id,m.team2_id) AND tp.eligibility_status='verified' WHERE m.id=:m1
                    UNION SELECT tm.coach_user_id FROM matches m JOIN teams tm ON tm.id IN(m.team1_id,m.team2_id) WHERE m.id=:m2 AND tm.coach_user_id IS NOT NULL
                    UNION SELECT tm.manager_user_id FROM matches m JOIN teams tm ON tm.id IN(m.team1_id,m.team2_id) WHERE m.id=:m3 AND tm.manager_user_id IS NOT NULL
                    UNION SELECT ga.user_id FROM game_assignments ga WHERE ga.match_id=:m4 AND ga.status='accepted'
                ) recipients WHERE recipient_id IS NOT NULL");
                $users->execute([':m1'=>$match['id'],':m2'=>$match['id'],':m3'=>$match['id'],':m4'=>$match['id']]);
                $insert=$this->db->prepare("INSERT INTO notifications (user_id,notification_type,title,message,action_url,dedupe_key)
                    VALUES (:user,'game_reminder','Game starts in 30 minutes',:message,'/dashboard',:dedupe) ON CONFLICT (dedupe_key) DO NOTHING");
                foreach($users->fetchAll(PDO::FETCH_COLUMN) as $userId){
                    $insert->execute([':user'=>$userId,':message'=>($match['home_team']?:'TBD').' vs '.($match['away_team']?:'TBD').' is scheduled at '.date('g:i A',strtotime($match['scheduled_start_time'])).'.',':dedupe'=>'game30-'.$match['id'].'-'.$userId]);
                    $created=$insert->rowCount();$sent += $created;
                    if($created){$message=($match['home_team']?:'TBD').' vs '.($match['away_team']?:'TBD').' starts at '.date('g:i A',strtotime($match['scheduled_start_time'])).'. Please arrive early and check your assigned court.';$mailer->sendToUser((int)$userId,'Game starts in 30 minutes',$message,'/schedules','View game schedule')?$emailsSent++:$emailsFailed++;}
                }
                $this->db->prepare("UPDATE matches SET reminder_30_sent_at=NOW() WHERE id=:id AND reminder_30_sent_at IS NULL")->execute([':id'=>$match['id']]);
                $this->db->commit();
            } catch(Throwable $e){$this->db->rollBack();throw $e;}
        }
        return ['matches_processed'=>count($matches),'notifications_sent'=>$sent,'emails_sent'=>$emailsSent,'emails_skipped_or_failed'=>$emailsFailed];
    }
}

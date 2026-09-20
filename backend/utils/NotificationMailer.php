<?php
require_once __DIR__.'/../config/database.php';
require_once __DIR__.'/ResendMailer.php';

class NotificationMailer {
    private PDO $db; private ResendMailer $mailer; private string $appUrl;
    public function __construct(){ $this->db=(new Database())->getConnection();$this->mailer=new ResendMailer();$this->appUrl=rtrim((string)(getenv('APP_URL')?:'http://127.0.0.1:5180'),'/'); }
    public function isConfigured():bool{return $this->mailer->isConfigured();}
    public function sendToUser(int $userId,string $subject,string $message,string $path='/notifications',string $actionLabel='View notification'):bool{
        $stmt=$this->db->prepare("SELECT email,full_name,is_active FROM users WHERE id=:id LIMIT 1");$stmt->execute([':id'=>$userId]);$user=$stmt->fetch();
        if(!$user||!(bool)$user['is_active']||!filter_var($user['email']??'',FILTER_VALIDATE_EMAIL))return false;
        $text="Hello ".($user['full_name']?:'FullCourt member').",\n\n{$message}\n\nOpen FullCourt: {$this->appUrl}{$path}";
        return $this->mailer->send($user['email'],$subject,$text,ResendMailer::notificationHtml($subject,$message,$this->appUrl.$path,$actionLabel));
    }
    public function sendToTournamentParticipants(int $tournamentId,string $subject,string $message,string $path):array{
        $stmt=$this->db->prepare("SELECT DISTINCT user_id FROM (SELECT tp.user_id FROM teams tm JOIN team_players tp ON tp.team_id=tm.id AND tp.eligibility_status='verified' WHERE tm.tournament_id=:p1 UNION SELECT tm.coach_user_id FROM teams tm WHERE tm.tournament_id=:p2 AND tm.coach_user_id IS NOT NULL UNION SELECT tm.manager_user_id FROM teams tm WHERE tm.tournament_id=:p3 AND tm.manager_user_id IS NOT NULL UNION SELECT ga.user_id FROM game_assignments ga JOIN matches m ON m.id=ga.match_id WHERE m.tournament_id=:p4 AND ga.status='accepted') recipients WHERE user_id IS NOT NULL");
        $stmt->execute([':p1'=>$tournamentId,':p2'=>$tournamentId,':p3'=>$tournamentId,':p4'=>$tournamentId]);$sent=0;$failed=0;
        foreach($stmt->fetchAll(PDO::FETCH_COLUMN) as $userId){$this->sendToUser((int)$userId,$subject,$message,$path)?$sent++:$failed++;}
        return ['emails_sent'=>$sent,'emails_skipped_or_failed'=>$failed];
    }
}

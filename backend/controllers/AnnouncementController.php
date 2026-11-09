<?php
// backend/controllers/AnnouncementController.php

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../models/AuditLog.php';

class AnnouncementController {
    private PDO $db;

    public function __construct() {
        $db = (new Database())->getConnection();
        if (!$db) throw new Exception('Database connection failed');
        $this->db = $db;
    }

    // Public: current, non-expired announcements
    public function indexPublished(): void {
        $stmt = $this->db->query("SELECT a.id, a.title, a.message, a.priority, a.published_at, t.name AS tournament_name
                                  FROM announcements a
                                  LEFT JOIN tournaments t ON a.tournament_id = t.id
                                  WHERE a.published_at IS NOT NULL
                                    AND (a.expires_at IS NULL OR a.expires_at > NOW())
                                  ORDER BY a.published_at DESC
                                  LIMIT 20");
        Response::success('Announcements retrieved', ['announcements' => $stmt->fetchAll()]);
    }

    public function managed(): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        if(OrganizationAccess::isPlatform($user)){
            $stmt=$this->db->query("SELECT a.*,t.name tournament_name FROM announcements a LEFT JOIN tournaments t ON t.id=a.tournament_id ORDER BY a.created_at DESC LIMIT 100");
        }else{
            $stmt=$this->db->prepare("SELECT a.*,t.name tournament_name FROM announcements a JOIN tournaments t ON t.id=a.tournament_id
                WHERE EXISTS (SELECT 1 FROM tournament_staff_assignments tsa WHERE tsa.tournament_id=t.id AND tsa.user_id=:user_id)
                ORDER BY a.created_at DESC LIMIT 100");
            $stmt->execute([':user_id'=>(int)$user['user_id']]);
        }
        Response::success('Managed announcements retrieved',['announcements'=>$stmt->fetchAll()]);
    }

    public function publish(): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        $input=json_decode(file_get_contents('php://input'),true)?:[];
        $title=trim((string)($input['title']??''));$message=trim((string)($input['message']??''));
        $tournamentId=(int)($input['tournament_id']??0);$priority=(string)($input['priority']??'normal');
        $expiresHours=max(1,min(720,(int)($input['expires_in_hours']??72)));
        if($title===''||mb_strlen($title)>180||$message===''||mb_strlen($message)>1500)Response::error('Announcement title and message are required.',422);
        if(!in_array($priority,['normal','important','urgent'],true))Response::error('Invalid announcement priority.',422);
        if(!$tournamentId&&!OrganizationAccess::isPlatform($user))Response::error('Staff Admin announcements must select an assigned tournament.',422);
        if($tournamentId)OrganizationAccess::requireTournament($tournamentId,$user);
        $stmt=$this->db->prepare("INSERT INTO announcements(tournament_id,title,message,priority,published_at,expires_at)
            VALUES(:tournament_id,:title,:message,:priority,NOW(),DATE_ADD(NOW(), INTERVAL {$expiresHours} HOUR))");
        $stmt->bindValue(':tournament_id',$tournamentId?:null,$tournamentId?PDO::PARAM_INT:PDO::PARAM_NULL);
        $stmt->bindValue(':title',$title);$stmt->bindValue(':message',$message);$stmt->bindValue(':priority',$priority);$stmt->execute();
        $id=(int)$this->db->lastInsertId();
        $recipientSql=$tournamentId
            ? "SELECT DISTINCT user_id FROM (SELECT coach_user_id user_id FROM teams WHERE tournament_id=:tid AND coach_user_id IS NOT NULL UNION SELECT manager_user_id FROM teams WHERE tournament_id=:tid2 AND manager_user_id IS NOT NULL) recipients"
            : "SELECT id user_id FROM users WHERE role IN ('coach','assistant_coach','statistician') AND is_active=1";
        $recipients=$this->db->prepare($recipientSql);$recipients->execute($tournamentId?[':tid'=>$tournamentId,':tid2'=>$tournamentId]:[]);
        $notify=$this->db->prepare("INSERT INTO notifications(user_id,notification_type,title,message,action_url) VALUES(:user_id,'announcement',:title,:message,'/notifications')");
        $count=0;foreach($recipients->fetchAll() as $recipient){$notify->execute([':user_id'=>(int)$recipient['user_id'],':title'=>$title,':message'=>$message]);$count++;}
        (new AuditLog())->log((int)$user['user_id'],'PUBLISH_ANNOUNCEMENT','COMMUNICATIONS',"Published announcement #{$id}: {$title}.");
        Response::success('Announcement published and team staff notified.',['id'=>$id,'notifications_created'=>$count],201);
    }
}

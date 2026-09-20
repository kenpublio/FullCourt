<?php

require_once __DIR__ . '/../models/Engagement.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/response.php';

class EngagementController {
    private Engagement $model; private AuditLog $audit;
    private const MANAGERS=['platform_admin','admin','organization_admin','tournament_organizer'];
    public function __construct(){ $this->model=new Engagement();$this->audit=new AuditLog(); }
    public function notifications():void{$u=AuthMiddleware::authenticate();Response::success('Notifications retrieved',['notifications'=>$this->model->notifications((int)$u['user_id'])]);}
    public function read(int $id):void{$u=AuthMiddleware::authenticate();if(!$this->model->markRead($id,(int)$u['user_id']))Response::error('Notification not found.',404);Response::success('Notification marked as read');}
    public function readAll():void{$u=AuthMiddleware::authenticate();$this->model->markAllRead((int)$u['user_id']);Response::success('All notifications marked as read');}
    public function awards(int $tid):void{$u=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($tid,$u);Response::success('Awards retrieved',['awards'=>$this->model->awards($tid)]);}
    public function recommend(int $tid):void{$u=AuthMiddleware::authorizeRoles(self::MANAGERS);OrganizationAccess::requireTournament($tid,$u);$rows=$this->model->recommendAwards($tid);$this->audit->log((int)$u['user_id'],'RECOMMEND_AWARDS','AWARDS',"Rebuilt recommendations for tournament {$tid}.");Response::success('Award recommendations rebuilt',['awards'=>$rows]);}
    public function confirm(int $id):void{$u=AuthMiddleware::authorizeRoles(self::MANAGERS);$tid=$this->model->awardTournamentId($id);if($tid===null)Response::error('Award not found.',404);OrganizationAccess::requireTournament($tid,$u);$in=json_decode(file_get_contents('php://input'),true)?:[];if(!$this->model->confirmAward($id,(int)$u['user_id'],!empty($in['publish'])))Response::error('Award not found.',404);$this->audit->log((int)$u['user_id'],'CONFIRM_AWARD','AWARDS',"Confirmed award {$id}.");Response::success('Award confirmed');}
}

<?php
require_once __DIR__.'/../models/SystemOperations.php';
require_once __DIR__.'/../models/AuditLog.php';
require_once __DIR__.'/../middleware/auth.php';
require_once __DIR__.'/../utils/response.php';

class SystemOperationsController {
    private SystemOperations $system;private AuditLog $audit;
    public function __construct(){$this->system=new SystemOperations();$this->audit=new AuditLog();}
    public function health():void{AuthMiddleware::authorizeRoles(['platform_admin']);Response::success('Production health retrieved',['health'=>$this->system->health()]);}
    public function backup():void{$user=AuthMiddleware::authorizeRoles(['platform_admin']);$result=$this->system->backup((int)$user['user_id']);$this->audit->log((int)$user['user_id'],'CREATE_DATABASE_BACKUP','SYSTEM_OPERATIONS',"Created verified backup {$result['file']}.");Response::success('Verified backup created',['backup'=>$result],201);}
}

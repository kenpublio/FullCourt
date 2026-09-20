<?php
require_once __DIR__.'/../models/GameDayOperations.php';
require_once __DIR__.'/../models/AuditLog.php';
require_once __DIR__.'/../middleware/auth.php';
require_once __DIR__.'/../middleware/OrganizationAccess.php';
require_once __DIR__.'/../utils/response.php';

class GameDayOperationsController {
    private GameDayOperations $model;private AuditLog $audit;
    private const VIEWERS=['platform_admin','admin','organization_admin','tournament_organizer'];
    private const OPERATORS=['organization_admin','tournament_organizer'];
    public function __construct(){$this->model=new GameDayOperations();$this->audit=new AuditLog();}
    public function index(int $tournamentId):void{$user=AuthMiddleware::authorizeRoles(self::VIEWERS);OrganizationAccess::requireTournament($tournamentId,$user);Response::success('Game-day operations retrieved',['games'=>$this->model->tournamentGames($tournamentId),'incidents'=>$this->model->incidents($tournamentId)]);}
    public function readiness(int $matchId):void{$user=AuthMiddleware::authorizeRoles(self::OPERATORS);OrganizationAccess::requireMatch($matchId,$user);$data=$this->input();$this->model->saveReadiness($matchId,$data,(int)$user['user_id']);$this->audit->log((int)$user['user_id'],'UPDATE_GAME_READINESS','GAME_DAY',"Updated readiness for match {$matchId}.");Response::success('Game readiness saved');}
    public function incident(int $matchId):void{$user=AuthMiddleware::authorizeRoles(self::OPERATORS);OrganizationAccess::requireMatch($matchId,$user);$data=$this->input();$types=['injury','misconduct','technical','venue','security','other'];$severity=['low','medium','high','critical'];if(!in_array($data['incident_type']??'',$types,true)||!in_array($data['severity']??'',$severity,true)||trim((string)($data['description']??''))==='')Response::error('A valid incident type, severity, and description are required.',422);$id=$this->model->createIncident($matchId,$data,(int)$user['user_id']);$this->audit->log((int)$user['user_id'],'REPORT_GAME_INCIDENT','GAME_DAY',"Reported incident {$id} for match {$matchId}.");Response::success('Incident report saved',['id'=>$id],201);}
    public function resolve(int $id):void{$user=AuthMiddleware::authorizeRoles(self::OPERATORS);$tournamentId=$this->model->incidentTournamentId($id);if($tournamentId===null)Response::error('Incident not found.',404);OrganizationAccess::requireTournament($tournamentId,$user);if(!$this->model->resolveIncident($id,(int)$user['user_id']))Response::error('Open incident not found.',404);$this->audit->log((int)$user['user_id'],'RESOLVE_GAME_INCIDENT','GAME_DAY',"Resolved incident {$id}.");Response::success('Incident resolved');}
    private function input():array{return json_decode(file_get_contents('php://input'),true)?:[];}
}

<?php

require_once __DIR__ . '/../models/GameOperations.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/response.php';

class GameOperationsController {
    private GameOperations $model;
    private AuditLog $audit;
    private const MANAGERS = ['platform_admin','admin','organization_admin','tournament_organizer'];

    public function __construct() { $this->model=new GameOperations(); $this->audit=new AuditLog(); }

    public function assignments(): void {
        $user=AuthMiddleware::authenticate();
        $all=in_array($user['role'],self::MANAGERS,true);
        Response::success('Assignments retrieved',['assignments'=>$this->model->assignments((int)$user['user_id'],$all,OrganizationAccess::isPlatform($user))]);
    }
    public function assign(int $matchId): void {
        $user=AuthMiddleware::authorizeRoles(self::MANAGERS); OrganizationAccess::requireMatch($matchId,$user); $in=$this->input();
        if (empty($in['user_id']) || !in_array($in['assignment_role'] ?? '',['referee','scorer','statistician'],true)) Response::error('Valid user and assignment role are required.',422);
        $id=$this->model->assign($matchId,(int)$in['user_id'],$in['assignment_role']);
        $this->audit->log((int)$user['user_id'],'ASSIGN_OFFICIAL','GAME_OPERATIONS',"Assigned {$in['assignment_role']} to match {$matchId}.");
        Response::success('Game official assigned',['id'=>$id],201);
    }
    public function respond(int $id): void {
        $user=AuthMiddleware::authenticate(); $status=$this->input()['status'] ?? '';
        if (!in_array($status,['accepted','declined'],true)) Response::error('Invalid response.',422);
        if (!$this->model->respondAssignment($id,(int)$user['user_id'],$status)) Response::error('Assignment not found.',404);
        Response::success('Assignment response saved');
    }
    public function lineup(int $matchId): void {
        $user=AuthMiddleware::authorizeRoles(array_merge(self::MANAGERS,['coach','coach_manager','official','statistician'])); OrganizationAccess::requireMatch($matchId,$user);
        if($user['role']==='statistician' && !$this->model->hasAcceptedStatisticianAssignment($matchId,(int)$user['user_id'])) Response::forbidden('An accepted statistician assignment is required for this game.');
        try { $this->model->saveLineup($matchId,$this->input()['players'] ?? [],(int)$user['user_id']); }
        catch (InvalidArgumentException $e) { Response::error($e->getMessage(),422); }
        Response::success('Starting lineup confirmed');
    }
    public function getLineup(int $matchId): void { $user=AuthMiddleware::authenticate();OrganizationAccess::requireMatch($matchId,$user);Response::success('Game lineup retrieved',['players'=>$this->model->lineup($matchId)]); }
    public function substitute(int $matchId):void { $user=$this->requireAssignedStatistician($matchId);$in=$this->input();try{$this->model->substitute($matchId,(int)($in['player_out_id']??0),(int)($in['player_in_id']??0),(int)($in['period']??1),(int)($in['game_clock_seconds']??600),(int)$user['user_id']);}catch(InvalidArgumentException $e){Response::error($e->getMessage(),422);}Response::success('Substitution and playing time recorded.'); }
    public function stat(int $matchId): void {
        $user=$this->requireAssignedStatistician($matchId); $in=$this->input();
        $allowed=['2pt_made','2pt_missed','3pt_made','3pt_missed','ft_made','ft_missed','off_rebound','def_rebound','assist','steal','block','turnover','personal_foul','substitution','timeout'];
        if (empty($in['event_uuid']) || !in_array($in['event_type'] ?? '',$allowed,true) || empty($in['team_id'])) Response::error('event_uuid, team_id, and a valid basketball event are required.',422);
        try { $id=$this->model->recordStat($matchId,$in,(int)$user['user_id']); }
        catch (PDOException $e) { if ((string)$e->getCode()==='23000') Response::error('Duplicate stat event ignored.',409); throw $e; }
        Response::success('Basketball stat recorded',['id'=>$id],201);
    }
    public function voidStat(int $matchId,int $eventId): void {
        $user=$this->requireAssignedStatistician($matchId);
        if (!$this->model->voidStat($matchId,$eventId)) Response::error('Active stat event not found.',404);
        Response::success('Stat event voided');
    }
    public function boxScore(int $matchId): void { $user=AuthMiddleware::authenticate(); OrganizationAccess::requireMatch($matchId,$user); Response::success('Box score retrieved',['players'=>$this->model->boxScore($matchId)]); }
    public function corrections(): void { $user=AuthMiddleware::authorizeRoles(self::MANAGERS); Response::success('Corrections retrieved',['corrections'=>$this->model->corrections((int)$user['user_id'],OrganizationAccess::isPlatform($user))]); }
    public function requestCorrection(int $matchId): void {
        $user=AuthMiddleware::authorizeRoles(array_merge(self::MANAGERS,['official','statistician'])); OrganizationAccess::requireMatch($matchId,$user); $in=$this->input();
        if (!isset($in['home_score'],$in['away_score']) || empty($in['reason'])) Response::error('Corrected scores and reason are required.',422);
        $id=$this->model->requestCorrection($matchId,$in,(int)$user['user_id']); Response::success('Correction submitted',['id'=>$id],201);
    }
    public function reviewCorrection(int $id): void {
        $user=AuthMiddleware::authorizeRoles(self::MANAGERS); $tid=$this->model->correctionTournamentId($id);if($tid===null)Response::error('Correction not found.',404);OrganizationAccess::requireTournament($tid,$user); $status=$this->input()['status'] ?? '';
        if (!in_array($status,['approved','rejected'],true)) Response::error('Invalid review status.',422);
        $this->model->reviewCorrection($id,$status,(int)$user['user_id']);
        $this->audit->log((int)$user['user_id'],'REVIEW_SCORE_CORRECTION','GAME_OPERATIONS',"Set correction {$id} to {$status}.");
        Response::success('Correction reviewed and standings recalculated');
    }
    private function input(): array { return json_decode(file_get_contents('php://input'),true) ?: []; }
    private function requireAssignedStatistician(int $matchId): array {
        $user=AuthMiddleware::authorizeRoles(['statistician']);
        OrganizationAccess::requireMatch($matchId,$user);
        if(!$this->model->hasAcceptedStatisticianAssignment($matchId,(int)$user['user_id'])) Response::forbidden('An accepted statistician assignment is required for this game.');
        return $user;
    }
}

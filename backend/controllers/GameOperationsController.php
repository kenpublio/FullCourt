<?php

require_once __DIR__ . '/../models/GameOperations.php';
require_once __DIR__ . '/../models/Scorekeeper.php';
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
        if (empty($in['user_id'])) Response::error('Select a statistician to assign.',422);
        $statisticianId=(int)$in['user_id'];
        if (!$this->model->canAssignStatistician($matchId,$statisticianId,OrganizationAccess::isPlatform($user))) {
            Response::error('Select an active statistician from this tournament organization.',422);
        }
        $id=$this->model->assign($matchId,$statisticianId,'statistician');
        $this->audit->log((int)$user['user_id'],'ASSIGN_STATISTICIAN','GAME_OPERATIONS',"Assigned statistician to match {$matchId}.");
        Response::success('Statistician assigned',['id'=>$id],201);
    }
    public function respond(int $id): void {
        $user=AuthMiddleware::authenticate(); $status=$this->input()['status'] ?? '';
        if (!in_array($status,['accepted','declined'],true)) Response::error('Invalid response.',422);
        if (!$this->model->respondAssignment($id,(int)$user['user_id'],$status)) Response::error('Assignment not found.',404);
        Response::success('Assignment response saved');
    }
    public function lineup(int $matchId): void {
        $user=AuthMiddleware::authorizeRoles(array_merge(self::MANAGERS,['coach','coach_manager','statistician'])); OrganizationAccess::requireMatch($matchId,$user);
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
    public function recentStats(int $matchId):void { $user=$this->requireAssignedStatistician($matchId);Response::success('Recent scoring actions retrieved',['events'=>$this->model->recentStats($matchId)]); }
    public function clock(int $matchId):void {
        $user=$this->requireAssignedStatistician($matchId);$input=$this->input();$action=(string)($input['action']??'');
        if(!in_array($action,['start','pause','resume','set'],true))Response::error('Choose a valid clock action.',422);
        $seconds=max(0,min(3599,(int)($input['timer_seconds']??0)));$period=(string)($input['current_period']??'Q1');
        if(!preg_match('/^(Q[1-4]|OT[1-9])$/',$period))Response::error('Choose Q1-Q4 or a valid overtime period.',422);
        $scorekeeper=new Scorekeeper();$fields=['timer_seconds'=>$seconds,'current_period'=>$period,'is_timer_running'=>in_array($action,['start','resume'],true)?1:0];
        $scorekeeper->updateScoreState($matchId,$fields);if($action==='start')$scorekeeper->startMatch($matchId);
        $this->audit->log((int)$user['user_id'],'UPDATE_GAME_CLOCK','LIVE_SCORING',"Match {$matchId}: {$period}, {$seconds} seconds, {$action}.");
        Response::success('Game clock updated',['timer_seconds'=>$seconds,'current_period'=>$period,'is_timer_running'=>$fields['is_timer_running']]);
    }
    public function boxScore(int $matchId): void { $user=AuthMiddleware::authenticate(); OrganizationAccess::requireMatch($matchId,$user); Response::success('Box score retrieved',['players'=>$this->model->boxScore($matchId)]); }
    public function submitFinal(int $matchId): void {
        $user=$this->requireAssignedStatistician($matchId);
        $scorekeeper=new Scorekeeper();
        $score=$scorekeeper->getMatchScoreState($matchId);
        if (!$score) Response::error('The scoreboard is not ready for final review.',404);
        $home=(int)$score['team1_score'];$away=(int)$score['team2_score'];
        if ($home===$away) Response::error('A tied score cannot be submitted as final. Record overtime or correct the score first.',422);
        $winner=$home>$away?(int)$score['team1_id']:(int)$score['team2_id'];
        $scorekeeper->submitMatchForConfirmation($matchId,$winner);
        $this->audit->log((int)$user['user_id'],'SUBMIT_FINAL_SCORE','LIVE_SCORING',"Staff Admin submitted match {$matchId} for Admin confirmation at {$home}-{$away}.");
        Response::success('Final score submitted for Admin confirmation.',['home_score'=>$home,'away_score'=>$away,'winner_team_id'=>$winner]);
    }
    public function corrections(): void { $user=AuthMiddleware::authorizeRoles(self::MANAGERS); Response::success('Corrections retrieved',['corrections'=>$this->model->corrections((int)$user['user_id'],OrganizationAccess::isPlatform($user))]); }
    public function requestCorrection(int $matchId): void {
        $user=AuthMiddleware::authorizeRoles(array_merge(self::MANAGERS,['statistician'])); OrganizationAccess::requireMatch($matchId,$user); $in=$this->input();
        if (!isset($in['home_score'],$in['away_score']) || empty($in['reason'])) Response::error('Corrected scores and reason are required.',422);
        $id=$this->model->requestCorrection($matchId,$in,(int)$user['user_id']);
        $correction=$this->model->correctionDetails($id);
        $this->audit->log((int)$user['user_id'],'REQUEST_SCORE_CORRECTION','GAME_OPERATIONS',
            "Correction #{$id}, match {$matchId}: " . ($correction['original_home_score'] ?? '?') . '-' . ($correction['original_away_score'] ?? '?')
            . ' -> ' . (int)$in['home_score'] . '-' . (int)$in['away_score'] . '; reason: ' . trim((string)$in['reason']));
        Response::success('Correction submitted and recorded in the audit history',['id'=>$id],201);
    }
    public function reviewCorrection(int $id): void {
        $user=AuthMiddleware::authorizeRoles(self::MANAGERS); $tid=$this->model->correctionTournamentId($id);if($tid===null)Response::error('Correction not found.',404);OrganizationAccess::requireTournament($tid,$user); $status=$this->input()['status'] ?? '';
        if (!in_array($status,['approved','rejected'],true)) Response::error('Invalid review status.',422);
        $correction=$this->model->correctionDetails($id);
        if (!$correction) Response::error('Correction not found.',404);
        $this->model->reviewCorrection($id,$status,(int)$user['user_id']);
        $this->audit->log((int)$user['user_id'],'REVIEW_SCORE_CORRECTION','GAME_OPERATIONS',
            "Correction #{$id}, match {$correction['match_id']}: " . $correction['original_home_score'] . '-' . $correction['original_away_score']
            . ' -> ' . $correction['requested_home_score'] . '-' . $correction['requested_away_score'] . "; decision: {$status}; reason: " . $correction['reason']);
        Response::success('Correction reviewed; decision and score history recorded');
    }
    private function input(): array { return json_decode(file_get_contents('php://input'),true) ?: []; }
    private function requireAssignedStatistician(int $matchId): array {
        $user=AuthMiddleware::authorizeRoles(['statistician']);
        OrganizationAccess::requireMatch($matchId,$user);
        if(!$this->model->hasAcceptedStatisticianAssignment($matchId,(int)$user['user_id'])) Response::forbidden('An accepted statistician assignment is required for this game.');
        return $user;
    }
}

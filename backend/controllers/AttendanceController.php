<?php

require_once __DIR__ . '/../models/QRAttendance.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/response.php';

class AttendanceController {
    private QRAttendance $model;
    private AuditLog $audit;
    private const MANAGERS=['platform_admin','admin','organization_admin','tournament_organizer'];
    private const OPERATORS=['organization_admin','tournament_organizer'];

    public function __construct(){$this->model=new QRAttendance();$this->audit=new AuditLog();}

    public function teamQr(int $teamId):void{
        $user=AuthMiddleware::authorizeRoles(array_merge(self::MANAGERS,['coach','coach_manager']));
        $tournamentId=$this->model->teamTournamentId($teamId);if($tournamentId===null)Response::error('Team not found.',404);
        OrganizationAccess::requireTournament($tournamentId,$user);$team=$this->model->teamQr($teamId);
        Response::success('Printable team QR retrieved',['team'=>$team]);
    }

    public function scan():void{
        $user=AuthMiddleware::authorizeRoles(self::OPERATORS);$input=$this->input();$matchId=(int)($input['match_id']??0);
        if(!$matchId||empty($input['qr_payload'])||empty($input['sync_uuid']))Response::error('Game, QR payload, and sync ID are required.',422);
        OrganizationAccess::requireMatch($matchId,$user);
        try{$result=$this->model->recordTeamCheckin($matchId,trim($input['qr_payload']),$input['player_ids']??[],trim($input['sync_uuid']),(int)$user['user_id']);}
        catch(InvalidArgumentException $error){Response::error($error->getMessage(),422);}
        $this->audit->log((int)$user['user_id'],'TEAM_QR_CHECKIN','ATTENDANCE',"Verified team QR for game {$matchId}.");
        Response::success($result['message'],['checkin'=>$result]);
    }

    public function issueOfficial(int $assignmentId):void{
        $user=AuthMiddleware::authenticate();$matchId=$this->model->assignmentMatchId($assignmentId);if($matchId===null)Response::error('Assignment not found.',404);
        $manager=in_array($user['role'],self::MANAGERS,true);if($manager)OrganizationAccess::requireMatch($matchId,$user);
        try{$access=$this->model->issueOfficialToken($assignmentId,(int)$user['user_id'],$manager);}
        catch(InvalidArgumentException $error){Response::error($error->getMessage(),422);}
        $this->audit->log((int)$user['user_id'],'ISSUE_GAME_ACCESS_QR','GAME_ACCESS',"Issued official game access for assignment {$assignmentId}.");
        Response::success('One-time official QR generated',['access'=>$access]);
    }

    public function validateOfficial():void{
        $user=AuthMiddleware::authorizeRoles(self::OPERATORS);$input=$this->input();$matchId=(int)($input['match_id']??0);
        if(!$matchId||empty($input['qr_payload']))Response::error('Game and official QR payload are required.',422);
        OrganizationAccess::requireMatch($matchId,$user);
        try{$access=$this->model->validateOfficialToken($matchId,trim($input['qr_payload']));}
        catch(InvalidArgumentException $error){Response::error($error->getMessage(),422);}
        $this->audit->log((int)$user['user_id'],'VALIDATE_GAME_ACCESS_QR','GAME_ACCESS',"Granted official access for game {$matchId}.");
        Response::success('Official verified. Game access granted.',['access'=>$access]);
    }

    public function getMatchAttendance(int $matchId):void{$user=AuthMiddleware::authenticate();OrganizationAccess::requireMatch($matchId,$user);Response::success('Attendance records retrieved',['attendance'=>$this->model->getMatchAttendance($matchId)]);}
    private function input():array{return json_decode(file_get_contents('php://input'),true)?:[];}
}

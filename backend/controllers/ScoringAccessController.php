<?php

require_once __DIR__ . '/../models/ScoringAccess.php';
require_once __DIR__ . '/../models/GameOperations.php';
require_once __DIR__ . '/../models/Scorekeeper.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/response.php';

class ScoringAccessController {
    private ScoringAccess $links;
    private GameOperations $operations;
    private Scorekeeper $scores;
    private const MANAGERS=['platform_admin','admin','organization_admin','tournament_organizer'];

    public function __construct(){ $this->links=new ScoringAccess();$this->operations=new GameOperations();$this->scores=new Scorekeeper(); }

    public function create(int $matchId):void{
        $user=AuthMiddleware::authorizeRoles(self::MANAGERS);OrganizationAccess::requireMatch($matchId,$user);$in=$this->input();
        $status=$this->scores->getMatchStatus($matchId);if(in_array($status,['completed','cancelled','awaiting_confirmation'],true))Response::error('Create a scoring link only for an upcoming or active game.',422);
        $label=trim((string)($in['operator_label']??'Game Statistician'));$hours=max(1,min(24,(int)($in['expires_in_hours']??8)));
        if($label==='')Response::error('Enter the scorer or statistician name.',422);
        $link=$this->links->create($matchId,(int)$user['user_id'],$label,$hours);
        Response::success('Secure scoring link generated',['access'=>$link],201);
    }

    public function activate(string $token):void{
        $in=$this->input();$pin=trim((string)($in['pin']??''));$name=trim((string)($in['operator_name']??''));
        if(!preg_match('/^\d{6}$/',$pin)||$name==='')Response::error('Enter your name and the 6-digit access PIN.',422);
        $row=$this->links->activate($token,$pin,$name);if(!$row)Response::error('The scoring link or PIN is invalid, expired, or revoked.',401);
        $remaining=max(60,strtotime((string)$row['expires_at'])-time());
        $session=JWT::generate(['scoring_link_id'=>(int)$row['id'],'match_id'=>(int)$row['match_id'],'role'=>'guest_statistician','operator_name'=>$name],$remaining);
        Response::success('Courtside access granted',['session_token'=>$session,'game'=>$this->gameSummary($row)]);
    }

    public function console():void{
        $access=$this->session();$matchId=(int)$access['match_id'];$score=$this->scores->getMatchScoreState($matchId);
        if(!$score)Response::error('The scoreboard is not ready for this game.',404);
        $score['timer_seconds']=(int)($score['clock_remaining_seconds']??$score['timer_seconds']??0);
        Response::success('Scoring console loaded',['game'=>$score,'players'=>$this->operations->lineup($matchId),'box_score'=>$this->operations->boxScore($matchId),'operator_name'=>$access['operator_name']]);
    }

    public function stat():void{
        $access=$this->session();$in=$this->input();$allowed=['2pt_made','2pt_missed','3pt_made','3pt_missed','ft_made','ft_missed','off_rebound','def_rebound','assist','steal','block','turnover','personal_foul','timeout'];
        if(empty($in['event_uuid'])||empty($in['team_id'])||!in_array($in['event_type']??'',$allowed,true))Response::error('Select a player and a valid basketball statistic.',422);
        $in['period']=$this->periodNumber($in['current_period']??$in['period']??'Q1');
        $id=$this->operations->recordStat((int)$access['match_id'],$in,(int)$access['created_by']);
        Response::success('Basketball statistic recorded',['id'=>$id],201);
    }

    public function updateClock():void{
        $access=$this->session();$in=$this->input();
        $action=(string)($in['action']??'save');
        if(!in_array($action,['save','start','pause','resume'],true))Response::error('Choose Save, Start, Pause, or Resume for the game clock.',422);
        $period=trim((string)($in['current_period']??''));
        $allowed=['Q1','Q2','Q3','Q4','OT1','OT2','OT3','OT4','OT5'];
        $minutes=filter_var($in['minutes']??null,FILTER_VALIDATE_INT);
        $seconds=filter_var($in['seconds']??null,FILTER_VALIDATE_INT);
        if(!in_array($period,$allowed,true)||$minutes===false||$seconds===false||$minutes<0||$minutes>59||$seconds<0||$seconds>59)
            Response::error('Choose a valid quarter and enter minutes and seconds from 0 to 59.',422);
        $total=($minutes*60)+$seconds;
        $running=in_array($action,['start','resume'],true);
        if(!$this->links->updateGameClock((int)$access['match_id'],$period,$total,$running))Response::error('The scoreboard is not ready for this game.',404);
        Response::success('Game clock updated',['current_period'=>$period,'timer_seconds'=>$total,'is_timer_running'=>$running?1:0]);
    }

    public function substitute():void{
        $access=$this->session();$in=$this->input();
        try{$this->operations->substitute((int)$access['match_id'],(int)($in['player_out_id']??0),(int)($in['player_in_id']??0),$this->periodNumber($in['current_period']??$in['period']??'Q1'),(int)($in['game_clock_seconds']??600),(int)$access['created_by']);}
        catch(InvalidArgumentException $e){Response::error($e->getMessage(),422);}Response::success('Substitution and minutes recorded.');
    }

    public function revoke(int $id):void{
        $user=AuthMiddleware::authorizeRoles(self::MANAGERS);$matchId=$this->links->matchIdForLink($id);if(!$matchId)Response::error('Scoring link not found.',404);
        OrganizationAccess::requireMatch($matchId,$user);if(!$this->links->revoke($id))Response::error('Scoring link is already inactive.',409);Response::success('Scoring link revoked.');
    }

    private function session():array{
        $payload=AuthMiddleware::authenticate();if(($payload['role']??'')!=='guest_statistician'||empty($payload['scoring_link_id']))Response::forbidden('A valid scoring-link session is required.');
        $row=$this->links->findActiveById((int)$payload['scoring_link_id']);if(!$row||(int)$row['match_id']!==(int)$payload['match_id'])Response::unauthorized('This scoring session has expired or was revoked.');
        if(in_array($row['match_status'],['completed','cancelled','awaiting_confirmation'],true))Response::forbidden('Scoring is locked while this game awaits organizer confirmation.');
        $this->links->touch((int)$row['id']);return array_merge($payload,['created_by'=>(int)$row['created_by']]);
    }

    private function periodNumber(mixed $period):int{
        $label=strtoupper(trim((string)$period));
        if(preg_match('/^Q([1-4])$/',$label,$match))return(int)$match[1];
        if(preg_match('/^OT([1-5])$/',$label,$match))return 4+(int)$match[1];
        return max(1,(int)$period);
    }

    private function gameSummary(array $row):array{return['match_id'=>(int)$row['match_id'],'tournament_name'=>$row['tournament_name'],'home_team'=>$row['home_team'],'away_team'=>$row['away_team'],'scheduled_start_time'=>$row['scheduled_start_time'],'venue_name'=>$row['venue_name'],'court_name'=>$row['court_name'],'expires_at'=>$row['expires_at']];}
    private function input():array{return json_decode(file_get_contents('php://input'),true)?:[];}
}

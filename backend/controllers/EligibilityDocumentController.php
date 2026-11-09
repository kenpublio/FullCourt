<?php

require_once __DIR__ . '/../models/EligibilityDocument.php';
require_once __DIR__ . '/../models/TeamPlayer.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class EligibilityDocumentController {
    private EligibilityDocument $model;
    private AuditLog $audit;
    public function __construct(){ $this->model=new EligibilityDocument();$this->audit=new AuditLog(); }
    public function index(int $teamPlayerId):void{$u=AuthMiddleware::authenticate();$this->guard($teamPlayerId,$u);Response::success('Eligibility documents retrieved',['documents'=>$this->model->list($teamPlayerId)]);}
    // Accepted document types for EVSU player eligibility
    private const ALLOWED_DOC_TYPES = [
        'Birth Certificate / PSA',
        'Parent Waiver',
        'Parent Permit',
    ];

    public function upload(int $teamPlayerId):void{
        $u=AuthMiddleware::authorizeRoles(['coach']);
        if(!(new TeamPlayer())->belongsToCoach($teamPlayerId,(int)$u['user_id']))Response::forbidden('You can only upload documents for players assigned to your own team.');
        $this->guard($teamPlayerId,$u);if(empty($_FILES['document'])||$_FILES['document']['error']!==UPLOAD_ERR_OK)Response::error('A valid document upload is required.',422);
        $file=$_FILES['document'];if((int)$file['size']>5*1024*1024)Response::error('Document must not exceed 5MB.',413);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);$allowed=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png'];if(!isset($allowed[$mime]))Response::error('Only PDF, JPG, and PNG documents are accepted.',415);
        $type=trim($_POST['document_type']??'');
        if(!in_array($type,self::ALLOWED_DOC_TYPES,true)){
            Response::error('Only Birth Certificate / PSA and Parent Waiver are accepted document types.',422);
        }
        if($type==='Parent Permit')$type='Parent Waiver';
        $dir=__DIR__.'/../uploads/eligibility';if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))Response::error('Document storage is unavailable.',500);
        $name=bin2hex(random_bytes(20)).'.'.$allowed[$mime];$path=$dir.'/'.$name;if(!move_uploaded_file($file['tmp_name'],$path))Response::error('Document could not be stored.',500);
        $identity=[];
        if($type==='Birth Certificate / PSA'){
            $dob=trim($_POST['declared_birth_date']??'');
            if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$dob)){@unlink($path);Response::error('Enter the birth date shown on the Birth Certificate or PSA.',422);}
            $rosterDob=$this->model->profileBirthDate($teamPlayerId);
            $identity=['declared_birth_date'=>$dob,'birthdate_match'=>$rosterDob!==null&&$rosterDob===$dob,'mismatch_flag'=>$rosterDob===$dob?null:'birth_date_mismatch'];
        }
        $id=$this->model->create($teamPlayerId,$type,$path,$mime,$identity);
        $this->audit->log((int)$u['user_id'],'UPLOAD_ELIGIBILITY_DOCUMENT','PLAYER_ELIGIBILITY',"Uploaded {$type} for team player {$teamPlayerId} (document {$id}).");
        Response::success('Eligibility document uploaded',['id'=>$id,'birthdate_match'=>$identity['birthdate_match']??null],201);
    }
    public function download(int $id,bool $selfie=false):void{$u=AuthMiddleware::authenticate();$doc=$this->model->get($id);if(!$doc)Response::error('Document not found.',404);$this->guard((int)$doc['team_player_id'],$u);$path=$selfie?($doc['selfie_path']??''):$doc['file_path'];$mime=$selfie?($doc['selfie_mime_type']??''):$doc['mime_type'];if(!$path||!is_file($path))Response::error('Stored document is unavailable.',404);$this->audit->log((int)$u['user_id'],'VIEW_ELIGIBILITY_DOCUMENT','PLAYER_ELIGIBILITY',"Viewed protected document {$id} for team player {$doc['team_player_id']}.");header('Content-Type: '.$mime);header('Content-Disposition: inline; filename="'.($selfie?'identity-selfie':'eligibility-document').'-'.$id.'"');header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');readfile($path);exit;}
    public function review(int $id):void{$u=AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);$doc=$this->model->get($id);if(!$doc)Response::error('Document not found.',404);$this->guard((int)$doc['team_player_id'],$u);$in=json_decode(file_get_contents('php://input'),true)?:[];$status=$in['status']??'';if(!in_array($status,['verified','rejected'],true))Response::error('Invalid review status.',422);$this->model->review($id,$status,$in['notes']??null,(int)$u['user_id']);$this->audit->log((int)$u['user_id'],'REVIEW_ELIGIBILITY_DOCUMENT','PLAYER_ELIGIBILITY',"Marked protected document {$id} as {$status} for team player {$doc['team_player_id']}.");Response::success('Document review saved');}
    private function guard(int $id,array $u):void{if(!$this->model->canAccessPlayer($id,(int)$u['user_id'],$u['role']))Response::forbidden('You cannot access this private eligibility record.');}
}

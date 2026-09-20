<?php

require_once __DIR__ . '/../models/EligibilityDocument.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class EligibilityDocumentController {
    private EligibilityDocument $model;
    public function __construct(){ $this->model=new EligibilityDocument(); }
    public function index(int $teamPlayerId):void{$u=AuthMiddleware::authenticate();$this->guard($teamPlayerId,$u);Response::success('Eligibility documents retrieved',['documents'=>$this->model->list($teamPlayerId)]);}
    public function upload(int $teamPlayerId):void{
        $u=AuthMiddleware::authenticate();$this->guard($teamPlayerId,$u);if(empty($_FILES['document'])||$_FILES['document']['error']!==UPLOAD_ERR_OK)Response::error('A valid document upload is required.',422);
        $file=$_FILES['document'];if((int)$file['size']>5*1024*1024)Response::error('Document must not exceed 5MB.',413);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);$allowed=['application/pdf'=>'pdf','image/jpeg'=>'jpg','image/png'=>'png'];if(!isset($allowed[$mime]))Response::error('Only PDF, JPG, and PNG documents are accepted.',415);
        $type=trim($_POST['document_type']??'Eligibility Document');if(strlen($type)>80)Response::error('Document type is too long.',422);
        $dir=__DIR__.'/../uploads/eligibility';if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))Response::error('Document storage is unavailable.',500);
        $name=bin2hex(random_bytes(20)).'.'.$allowed[$mime];$path=$dir.'/'.$name;if(!move_uploaded_file($file['tmp_name'],$path))Response::error('Document could not be stored.',500);
        $identity=[];
        if($type==='Identity Verification'){
            if(empty($_FILES['selfie'])||$_FILES['selfie']['error']!==UPLOAD_ERR_OK){@unlink($path);Response::error('A live selfie is required with the ID.',422);}
            if(empty($_POST['consent_confirmed'])){@unlink($path);Response::error('Privacy consent is required.',422);}
            $idType=trim($_POST['id_type']??'');$last4=trim($_POST['id_number_last4']??'');$dob=trim($_POST['id_birth_date']??'');
            if($idType===''||!preg_match('/^[A-Za-z0-9]{4}$/',$last4)||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$dob)){@unlink($path);Response::error('Complete the ID type, last four ID characters, and ID birthdate.',422);}
            $selfie=$_FILES['selfie'];if((int)$selfie['size']>5*1024*1024){@unlink($path);Response::error('Selfie must not exceed 5MB.',413);}
            $selfieMime=(new finfo(FILEINFO_MIME_TYPE))->file($selfie['tmp_name']);$imageTypes=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];if(!isset($imageTypes[$selfieMime])){@unlink($path);Response::error('Selfie must be JPG, PNG, or WEBP.',415);}
            $selfieName=bin2hex(random_bytes(20)).'.'.$imageTypes[$selfieMime];$selfiePath=$dir.'/'.$selfieName;if(!move_uploaded_file($selfie['tmp_name'],$selfiePath)){@unlink($path);Response::error('Selfie could not be stored.',500);}
            $profileDob=$this->model->profileBirthDate($teamPlayerId);
            $identity=['id_type'=>$idType,'id_number_last4'=>strtoupper($last4),'id_birth_date'=>$dob,'selfie_path'=>$selfiePath,'selfie_mime_type'=>$selfieMime,'birthdate_match'=>$profileDob!==null&&$profileDob===$dob,'consent_confirmed'=>true];
        }
        $id=$this->model->create($teamPlayerId,$type,$path,$mime,$identity);Response::success('Eligibility document uploaded',['id'=>$id,'birthdate_match'=>$identity['birthdate_match']??null],201);
    }
    public function download(int $id,bool $selfie=false):void{$u=AuthMiddleware::authenticate();$doc=$this->model->get($id);if(!$doc)Response::error('Document not found.',404);$this->guard((int)$doc['team_player_id'],$u);$path=$selfie?($doc['selfie_path']??''):$doc['file_path'];$mime=$selfie?($doc['selfie_mime_type']??''):$doc['mime_type'];if(!$path||!is_file($path))Response::error('Stored document is unavailable.',404);header('Content-Type: '.$mime);header('Content-Disposition: inline; filename="'.($selfie?'identity-selfie':'eligibility-document').'-'.$id.'"');header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');readfile($path);exit;}
    public function review(int $id):void{$u=AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);$doc=$this->model->get($id);if(!$doc)Response::error('Document not found.',404);$in=json_decode(file_get_contents('php://input'),true)?:[];$status=$in['status']??'';if(!in_array($status,['verified','rejected'],true))Response::error('Invalid review status.',422);$this->model->review($id,$status,$in['notes']??null,(int)$u['user_id']);Response::success('Document review saved');}
    private function guard(int $id,array $u):void{if(!$this->model->canAccessPlayer($id,(int)$u['user_id'],$u['role']))Response::forbidden('You cannot access this private eligibility record.');}
}

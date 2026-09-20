<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../utils/response.php';

class PlatformSettingsController {
    private PDO $db;
    public function __construct(){ $this->db=(new Database())->getConnection(); }
    public function show(): void {
        $row=$this->db->query('SELECT maintenance_enabled, maintenance_message, registration_enabled, updated_at FROM platform_settings WHERE id=1')->fetch();
        Response::success('Platform settings retrieved',['settings'=>$row ?: ['maintenance_enabled'=>false,'maintenance_message'=>'','registration_enabled'=>true]]);
    }
    public function update(): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        $input=json_decode(file_get_contents('php://input'),true) ?: [];
        $message=trim((string)($input['maintenance_message']??''));
        if(mb_strlen($message)>240) Response::error('Maintenance message must not exceed 240 characters.',422);
        if($message==='') $message='FullCourt is being improved. Some features may be temporarily unavailable.';
        $stmt=$this->db->prepare('UPDATE platform_settings SET maintenance_enabled=:maintenance, maintenance_message=:message, registration_enabled=:registration, updated_by=:user_id, updated_at=NOW() WHERE id=1 RETURNING maintenance_enabled,maintenance_message,registration_enabled,updated_at');
        $stmt->bindValue(':maintenance',(bool)($input['maintenance_enabled']??false),PDO::PARAM_BOOL);
        $stmt->bindValue(':message',$message,PDO::PARAM_STR);
        $stmt->bindValue(':registration',(bool)($input['registration_enabled']??true),PDO::PARAM_BOOL);
        $stmt->bindValue(':user_id',(int)$user['user_id'],PDO::PARAM_INT);
        $stmt->execute();
        (new AuditLog())->log((int)$user['user_id'],'UPDATE_PLATFORM_SETTINGS','SYSTEM_SETTINGS','Updated maintenance and registration controls.');
        Response::success('Platform operations settings saved',['settings'=>$stmt->fetch()]);
    }
}

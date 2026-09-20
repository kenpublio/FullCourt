<?php

require_once __DIR__ . '/../config/database.php';

class AuthSession {
    private PDO $db;
    public function __construct(){ $connection=(new Database())->getConnection();if(!$connection)throw new RuntimeException('Database unavailable.');$this->db=$connection; }
    public function issue(int $userId,?string $family=null):array{$token=bin2hex(random_bytes(48));$family=$family??$this->uuid();$stmt=$this->db->prepare("INSERT INTO refresh_tokens (user_id,family_id,token_hash,expires_at) VALUES (:user_id,:family,:hash,NOW() + INTERVAL '30 days')");$stmt->execute([':user_id'=>$userId,':family'=>$family,':hash'=>hash('sha256',$token)]);return['token'=>$token,'family'=>$family];}
    public function rotate(string $token):?array{$hash=hash('sha256',$token);$this->db->beginTransaction();try{$stmt=$this->db->prepare("SELECT * FROM refresh_tokens WHERE token_hash=:hash FOR UPDATE");$stmt->execute([':hash'=>$hash]);$row=$stmt->fetch();if(!$row){$this->db->rollBack();return null;}if($row['used_at']||$row['revoked_at']){$this->db->prepare("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=:family")->execute([':family'=>$row['family_id']]);$this->db->commit();return null;}if(strtotime($row['expires_at'])<time()){$this->db->prepare("UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=:id")->execute([':id'=>$row['id']]);$this->db->commit();return null;}$this->db->prepare("UPDATE refresh_tokens SET used_at=NOW(),revoked_at=NOW() WHERE id=:id")->execute([':id'=>$row['id']]);$next=$this->issue((int)$row['user_id'],$row['family_id']);$this->db->commit();return['user_id'=>(int)$row['user_id'],'refresh_token'=>$next['token']];}catch(Throwable $e){$this->db->rollBack();throw$e;}}
    public function revoke(string $token):void{$this->db->prepare("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE token_hash=:hash")->execute([':hash'=>hash('sha256',$token)]);}
    private function uuid():string{$data=random_bytes(16);$data[6]=chr((ord($data[6])&0x0f)|0x40);$data[8]=chr((ord($data[8])&0x3f)|0x80);return vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex($data),4));}
}

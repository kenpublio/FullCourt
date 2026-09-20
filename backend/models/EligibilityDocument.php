<?php

require_once __DIR__ . '/../config/database.php';

class EligibilityDocument {
    private PDO $db;
    public function __construct(){ $connection=(new Database())->getConnection();if(!$connection)throw new RuntimeException('Database unavailable.');$this->db=$connection; }
    public function canAccessPlayer(int $teamPlayerId,int $userId,string $role):bool{
        if(in_array($role,['platform_admin','admin'],true))return true;
        $stmt=$this->db->prepare("SELECT tp.id FROM team_players tp JOIN teams tm ON tm.id=tp.team_id JOIN tournaments t ON t.id=tm.tournament_id
            LEFT JOIN organization_members om ON om.organization_id=t.organization_id AND om.user_id=:org_user AND om.status='active'
            WHERE tp.id=:id AND (tp.user_id=:player_user OR tm.coach_user_id=:coach_user OR tm.manager_user_id=:manager_user OR t.created_by=:creator_user OR om.id IS NOT NULL) LIMIT 1");
        $stmt->execute([':id'=>$teamPlayerId,':org_user'=>$userId,':player_user'=>$userId,':coach_user'=>$userId,':manager_user'=>$userId,':creator_user'=>$userId]);return(bool)$stmt->fetch();
    }
    public function create(int $teamPlayerId,string $type,string $path,string $mime,array $identity=[]):int{
        $stmt=$this->db->prepare("INSERT INTO eligibility_documents (team_player_id,document_type,file_path,mime_type,id_type,id_number_last4,id_birth_date,selfie_path,selfie_mime_type,birthdate_match,consent_confirmed) VALUES (:player,:type,:path,:mime,:id_type,:last4,:dob,:selfie,:selfie_mime,:match,:consent)");
        $stmt->execute([':player'=>$teamPlayerId,':type'=>$type,':path'=>$path,':mime'=>$mime,':id_type'=>$identity['id_type']??null,':last4'=>$identity['id_number_last4']??null,':dob'=>$identity['id_birth_date']??null,':selfie'=>$identity['selfie_path']??null,':selfie_mime'=>$identity['selfie_mime_type']??null,':match'=>$identity['birthdate_match']??null,':consent'=>(bool)($identity['consent_confirmed']??false)]);return(int)$this->db->lastInsertId();
    }
    public function list(int $teamPlayerId):array{$stmt=$this->db->prepare("SELECT id,team_player_id,document_type,mime_type,status,review_notes,reviewed_at,created_at,id_type,id_number_last4,id_birth_date,selfie_mime_type,birthdate_match,consent_confirmed FROM eligibility_documents WHERE team_player_id=:id ORDER BY created_at DESC");$stmt->execute([':id'=>$teamPlayerId]);return$stmt->fetchAll();}
    public function profileBirthDate(int $teamPlayerId):?string{$stmt=$this->db->prepare("SELECT COALESCE(pp.birth_date,u.birth_date) FROM team_players tp LEFT JOIN users u ON u.id=tp.user_id LEFT JOIN player_profiles pp ON pp.user_id=tp.user_id WHERE tp.id=:id");$stmt->execute([':id'=>$teamPlayerId]);$value=$stmt->fetchColumn();return$value?$value:null;}
    public function get(int $id):?array{$stmt=$this->db->prepare("SELECT * FROM eligibility_documents WHERE id=:id");$stmt->execute([':id'=>$id]);$row=$stmt->fetch();return$row?:null;}
    public function review(int $id,string $status,?string $notes,int $reviewer):bool{$stmt=$this->db->prepare("UPDATE eligibility_documents SET status=:status,review_notes=:notes,reviewed_by=:reviewer,reviewed_at=NOW() WHERE id=:id");return$stmt->execute([':status'=>$status,':notes'=>$notes,':reviewer'=>$reviewer,':id'=>$id]);}
}

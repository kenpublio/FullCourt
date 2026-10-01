<?php
// backend/models/Payment.php

require_once __DIR__ . '/../config/database.php';

class Payment {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getAll(): array {
        $sql = "SELECT p.*, tm.team_name, t.name as tournament_name, u.full_name as verifier_name
                FROM payments p
                JOIN teams tm ON p.team_id = tm.id
                JOIN tournaments t ON p.tournament_id = t.id
                LEFT JOIN users u ON p.verified_by = u.id
                ORDER BY p.created_at DESC";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll();
    }

    public function getForUser(int $userId, string $role): array {
        if (!in_array($role, ['coach','coach_manager'], true)) return [];
        $sql = "SELECT p.*, tm.team_name, t.name AS tournament_name, u.full_name AS verifier_name
                FROM payments p
                JOIN teams tm ON p.team_id = tm.id
                JOIN tournaments t ON p.tournament_id = t.id
                LEFT JOIN users u ON p.verified_by = u.id
                WHERE tm.coach_user_id = :coachId OR tm.manager_user_id = :managerId
                ORDER BY p.created_at DESC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':coachId' => $userId, ':managerId' => $userId]);
        return $stmt->fetchAll();
    }

    public function getForOrganizationUser(int $userId): array {
        $sql="SELECT DISTINCT p.*,tm.team_name,t.name AS tournament_name,v.full_name AS verifier_name
              FROM organization_members om JOIN organizations o ON o.id=om.organization_id AND o.status='active'
              JOIN tournaments t ON t.organization_id=o.id JOIN teams tm ON tm.tournament_id=t.id
              JOIN payments p ON p.team_id=tm.id AND p.tournament_id=t.id LEFT JOIN users v ON v.id=p.verified_by
              WHERE om.user_id=:user_id AND om.status='active' ORDER BY p.created_at DESC";
        $stmt=$this->db->prepare($sql);$stmt->execute([':user_id'=>$userId]);return$stmt->fetchAll();
    }

    public function validateSubmission(int $teamId,int $tournamentId,int $userId,string $role,string $reference,float $amount): array {
        $duplicate=$this->db->prepare("SELECT id FROM payments WHERE LOWER(reference_number)=LOWER(:reference) LIMIT 1");
        $duplicate->execute([':reference'=>$reference]);if($duplicate->fetch())return ['valid'=>false,'message'=>'This payment reference number has already been submitted.'];
        $stmt=$this->db->prepare("SELECT tm.coach_user_id,tm.manager_user_id,t.registration_fee
            FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id WHERE tm.id=:team AND t.id=:tournament");
        $stmt->execute([':team'=>$teamId,':tournament'=>$tournamentId]);$row=$stmt->fetch();
        if(!$row)return ['valid'=>false,'message'=>'The selected team does not belong to this tournament.'];
        if(in_array($role,['coach','coach_manager'],true)&&(int)$row['coach_user_id']!==$userId&&(int)($row['manager_user_id']??0)!==$userId)return ['valid'=>false,'message'=>'You can only submit a payment for your own team.'];
        $pending=$this->db->prepare("SELECT id FROM payments WHERE team_id=:team_id AND tournament_id=:tournament_id AND status IN ('pending','approved') LIMIT 1");
        $pending->execute([':team_id'=>$teamId,':tournament_id'=>$tournamentId]);
        if($pending->fetch())return ['valid'=>false,'message'=>'This team already has a pending or approved payment for this tournament.'];
        $fee=(float)$row['registration_fee'];
        if($fee<=0)return ['valid'=>false,'message'=>'This tournament has no registration fee to pay.'];
        if(abs($amount-$fee)>.009)return ['valid'=>false,'message'=>'Payment amount must match the tournament registration fee of ₱'.number_format($fee,2).'.'];
        return ['valid'=>true];
    }

    public function getById(int $id): ?array {
        $sql = "SELECT p.*, tm.team_name, t.name AS tournament_name, u.full_name AS verifier_name
                FROM payments p
                JOIN teams tm ON p.team_id = tm.id
                JOIN tournaments t ON p.tournament_id = t.id
                LEFT JOIN users u ON p.verified_by = u.id
                WHERE p.id = :id LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function belongsToUser(int $paymentId, int $userId, string $role): bool {
        if (!in_array($role,['coach','coach_manager'],true)) return false;
        $sql = "SELECT p.id FROM payments p
                JOIN teams tm ON p.team_id = tm.id
                WHERE p.id = :pid AND (tm.coach_user_id = :uid OR tm.manager_user_id = :uid) LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':pid' => $paymentId, ':uid' => $userId]);
        return (bool) $stmt->fetch();
    }

    public function attachReceipt(int $id, string $url): bool {
        $stmt = $this->db->prepare("UPDATE payments SET receipt_photo_url = :url WHERE id = :id AND status = 'pending'");
        return $stmt->execute([':url' => $url, ':id' => $id]) && $stmt->rowCount() === 1;
    }

    public function canVerifyForOrganization(int $paymentId, int $userId): bool {
        $sql = "SELECT p.id
                FROM payments p
                JOIN tournaments t ON t.id=p.tournament_id
                LEFT JOIN organizations o ON o.id=t.organization_id
                WHERE p.id=:payment_id AND p.status='pending'
                  AND ((t.organization_id IS NOT NULL AND o.status='active' AND EXISTS (
                        SELECT 1 FROM organization_members om
                        WHERE om.organization_id=t.organization_id AND om.user_id=:member_user
                          AND om.status='active' AND om.role IN ('organization_admin','organizer','tournament_organizer')
                  )) OR t.created_by=:creator_user)
                LIMIT 1";
        $stmt=$this->db->prepare($sql);
        $stmt->execute([':payment_id'=>$paymentId,':member_user'=>$userId,':creator_user'=>$userId]);
        return (bool)$stmt->fetchColumn();
    }

    public function submitPayment(array $data): int {
        $sql = "INSERT INTO payments (team_id, tournament_id, payment_method, reference_number, amount, receipt_photo_url, status)
                VALUES (:team_id, :tournament_id, :payment_method, :reference_number, :amount, :receipt_photo_url, 'pending')";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':team_id' => $data['team_id'],
            ':tournament_id' => $data['tournament_id'],
            ':payment_method' => $data['payment_method'] ?? 'gcash',
            ':reference_number' => $data['reference_number'],
            ':amount' => $data['amount'],
            ':receipt_photo_url' => $data['receipt_photo_url'] ?? null
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function verifyPayment(int $id, string $status, int $verifierId, ?string $remarks): bool {
        $this->db->beginTransaction();
        try {
            $sql = "UPDATE payments
                    SET status=:status, verified_by=:verifier_id, remarks=:remarks, verified_at=NOW()
                    WHERE id=:id AND status='pending'
                    RETURNING team_id";
            $stmt=$this->db->prepare($sql);
            $stmt->execute([':status'=>$status,':verifier_id'=>$verifierId,':remarks'=>$remarks,':id'=>$id]);
            $teamId=$stmt->fetchColumn();
            if($teamId===false){$this->db->rollBack();return false;}

            if($status==='approved'){
                $team=$this->db->prepare("UPDATE teams SET status='registered' WHERE id=:team_id");
                $team->execute([':team_id'=>$teamId]);
            }
            $this->db->commit();
            return true;
        } catch (Throwable $error) {
            if($this->db->inTransaction())$this->db->rollBack();
            throw $error;
        }
    }
}

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
        $sql = "SELECT p.*, tm.team_name, t.name as tournament_name, t.registration_fee,t.payment_methods,t.payment_account_name,t.payment_account_number,t.payment_deadline,t.payment_instructions,t.payment_contact,t.payment_qr_url, u.full_name as verifier_name,
                COALESCE((SELECT SUM(pa.amount) FROM payments pa WHERE pa.team_id=p.team_id AND pa.tournament_id=p.tournament_id AND pa.status='approved'),0) AS approved_total
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
        $sql = "SELECT p.*, tm.team_name, t.name AS tournament_name, t.registration_fee,t.payment_methods,t.payment_account_name,t.payment_account_number,t.payment_deadline,t.payment_instructions,t.payment_contact,t.payment_qr_url, u.full_name AS verifier_name,
                COALESCE((SELECT SUM(pa.amount) FROM payments pa WHERE pa.team_id=p.team_id AND pa.tournament_id=p.tournament_id AND pa.status='approved'),0) AS approved_total
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
        $sql="SELECT DISTINCT p.*,tm.team_name,t.name AS tournament_name,t.registration_fee,t.payment_methods,t.payment_account_name,t.payment_account_number,t.payment_deadline,t.payment_instructions,t.payment_contact,t.payment_qr_url,v.full_name AS verifier_name,
              COALESCE((SELECT SUM(pa.amount) FROM payments pa WHERE pa.team_id=p.team_id AND pa.tournament_id=p.tournament_id AND pa.status='approved'),0) AS approved_total
              FROM organization_members om JOIN organizations o ON o.id=om.organization_id AND o.status='active'
              JOIN tournaments t ON t.organization_id=o.id JOIN teams tm ON tm.tournament_id=t.id
              JOIN payments p ON p.team_id=tm.id AND p.tournament_id=t.id LEFT JOIN users v ON v.id=p.verified_by
              WHERE om.user_id=:user_id AND om.status='active' ORDER BY p.created_at DESC";
        $stmt=$this->db->prepare($sql);$stmt->execute([':user_id'=>$userId]);return$stmt->fetchAll();
    }

    public function validateSubmission(int $teamId,int $tournamentId,int $userId,string $role,string $reference,float $amount,string $method='gcash'): array {
        $duplicate=$this->db->prepare("SELECT id FROM payments WHERE LOWER(reference_number)=LOWER(:reference) LIMIT 1");
        $duplicate->execute([':reference'=>$reference]);if($duplicate->fetch())return ['valid'=>false,'message'=>'This payment reference number has already been submitted.'];
        $stmt=$this->db->prepare("SELECT tm.coach_user_id,tm.manager_user_id,t.registration_fee,t.payment_methods,t.payment_deadline
            FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id WHERE tm.id=:team AND t.id=:tournament");
        $stmt->execute([':team'=>$teamId,':tournament'=>$tournamentId]);$row=$stmt->fetch();
        if(!$row)return ['valid'=>false,'message'=>'The selected team does not belong to this tournament.'];
        if(in_array($role,['coach','coach_manager'],true)&&(int)$row['coach_user_id']!==$userId&&(int)($row['manager_user_id']??0)!==$userId)return ['valid'=>false,'message'=>'You can only submit a payment for your own team.'];
        $allowedMethods=array_filter(array_map('trim',explode(',',strtolower((string)($row['payment_methods']??'gcash,maya,cash')))));
        if(!in_array($method,$allowedMethods,true))return ['valid'=>false,'message'=>'The selected payment method is not enabled for this tournament.'];
        if(!empty($row['payment_deadline'])&&date('Y-m-d')>$row['payment_deadline'])return ['valid'=>false,'message'=>'The payment deadline for this tournament has passed. Contact the Admin for assistance.'];
        $pending=$this->db->prepare("SELECT id FROM payments WHERE team_id=:team_id AND tournament_id=:tournament_id AND status='pending' LIMIT 1");
        $pending->execute([':team_id'=>$teamId,':tournament_id'=>$tournamentId]);
        if($pending->fetch())return ['valid'=>false,'message'=>'This team already has a payment awaiting review. Wait for Admin to review it before adding another installment.'];
        $fee=(float)$row['registration_fee'];
        if($fee<=0)return ['valid'=>false,'message'=>'This tournament has no registration fee to pay.'];
        $paidStmt=$this->db->prepare("SELECT COALESCE(SUM(amount),0) FROM payments WHERE team_id=:team AND tournament_id=:tournament AND status='approved'");
        $paidStmt->execute([':team'=>$teamId,':tournament'=>$tournamentId]);
        $paid=(float)$paidStmt->fetchColumn();$remaining=max(0,$fee-$paid);
        if($remaining<=.009)return ['valid'=>false,'message'=>'This team’s registration fee is already fully paid.'];
        if($amount-$remaining>.009)return ['valid'=>false,'message'=>'Payment cannot exceed the remaining balance of ₱'.number_format($remaining,2).'.'];
        return ['valid'=>true,'fee'=>$fee,'paid'=>$paid,'remaining'=>$remaining];
    }

    public function getById(int $id): ?array {
        $sql = "SELECT p.*, tm.team_name, t.name AS tournament_name, t.registration_fee,t.payment_methods,t.payment_account_name,t.payment_account_number,t.payment_deadline,t.payment_instructions,t.payment_contact,t.payment_qr_url, u.full_name AS verifier_name,
                COALESCE((SELECT SUM(pa.amount) FROM payments pa WHERE pa.team_id=p.team_id AND pa.tournament_id=p.tournament_id AND pa.status='approved'),0) AS approved_total
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
                WHERE p.id = :pid AND (tm.coach_user_id = :coach_uid OR tm.manager_user_id = :manager_uid) LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':pid' => $paymentId, ':coach_uid' => $userId, ':manager_uid' => $userId]);
        return (bool) $stmt->fetch();
    }

    public function attachReceipt(int $id, string $url): bool {
        $stmt = $this->db->prepare("UPDATE payments SET receipt_photo_url = :url WHERE id = :id AND status = 'pending'");
        return $stmt->execute([':url' => $url, ':id' => $id]) && $stmt->rowCount() === 1;
    }

    public function updateTournamentSettings(int $tournamentId, array $data): bool {
        $stmt=$this->db->prepare("UPDATE tournaments SET registration_fee=:fee,payment_methods=:methods,payment_account_name=:account_name,payment_account_number=:account_number,payment_deadline=:deadline,payment_instructions=:instructions,payment_contact=:contact WHERE id=:id");
        return $stmt->execute([
            ':fee'=>$data['registration_fee'], ':methods'=>$data['payment_methods'],
            ':account_name'=>$data['payment_account_name'] ?: null,
            ':account_number'=>$data['payment_account_number'] ?: null,
            ':deadline'=>$data['payment_deadline'] ?: null,
            ':instructions'=>$data['payment_instructions'] ?: null,
            ':contact'=>$data['payment_contact'] ?: null, ':id'=>$tournamentId,
        ]);
    }

    public function attachTournamentQr(int $tournamentId, string $url): bool {
        $stmt=$this->db->prepare("UPDATE tournaments SET payment_qr_url=:url WHERE id=:id");
        return $stmt->execute([':url'=>$url,':id'=>$tournamentId]) && $stmt->rowCount()===1;
    }

    public function notifyReviewers(int $paymentId): int {
        $payment=$this->getById($paymentId);if(!$payment)return 0;
        $stmt=$this->db->prepare("INSERT INTO notifications(user_id,notification_type,title,message,action_url) SELECT id,'payment_review','Payment awaiting review',:message,'/payments' FROM users WHERE role IN ('platform_admin','admin') AND is_active=1");
        $stmt->execute([':message'=>($payment['team_name']??'A team').' submitted a payment for '.($payment['tournament_name']??'a tournament').'.']);return$stmt->rowCount();
    }

    public function notifyTeamStaff(int $paymentId,string $status,?string $remarks): int {
        $payment=$this->getById($paymentId);if(!$payment)return 0;
        $title=$status==='approved'?'Payment approved':'Payment needs correction';
        $message='Your '.($payment['payment_method']??'').' payment for '.($payment['tournament_name']??'the tournament').' was '.$status.'.'.($remarks?' '.$remarks:'');
        $stmt=$this->db->prepare("INSERT INTO notifications(user_id,notification_type,title,message,action_url) SELECT DISTINCT recipient_id,'payment_status',:title,:message,'/payments' FROM (SELECT coach_user_id recipient_id FROM teams WHERE id=:team1 UNION SELECT manager_user_id FROM teams WHERE id=:team2) recipients WHERE recipient_id IS NOT NULL");
        $stmt->execute([':title'=>$title,':message'=>$message,':team1'=>$payment['team_id'],':team2'=>$payment['team_id']]);return$stmt->rowCount();
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
            $driver=$this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
            $sql = "UPDATE payments SET status=:status, verified_by=:verifier_id, remarks=:remarks, verified_at=NOW()
                    WHERE id=:id AND status='pending'".($driver==='mysql'?'':' RETURNING team_id');
            $stmt=$this->db->prepare($sql);
            $stmt->execute([':status'=>$status,':verifier_id'=>$verifierId,':remarks'=>$remarks,':id'=>$id]);
            $teamId=$driver==='mysql' ? ($stmt->rowCount() ? $this->db->query("SELECT team_id FROM payments WHERE id=".(int)$id)->fetchColumn() : false) : $stmt->fetchColumn();
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

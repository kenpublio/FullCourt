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
        if (in_array($role, ['coach','coach_manager'], true)) {
            $sql = "SELECT p.*, tm.team_name, t.name AS tournament_name, u.full_name AS verifier_name
                    FROM payments p
                    JOIN teams tm ON p.team_id = tm.id
                    JOIN tournaments t ON p.tournament_id = t.id
                    LEFT JOIN users u ON p.verified_by = u.id
                    WHERE tm.coach_user_id = :coachId OR tm.manager_user_id = :managerId
                    ORDER BY p.created_at DESC";
        } else {
            $sql = "SELECT DISTINCT p.*, tm.team_name, t.name AS tournament_name, v.full_name AS verifier_name
                    FROM payments p
                    JOIN teams tm ON p.team_id = tm.id
                    JOIN tournaments t ON p.tournament_id = t.id
                    JOIN team_players tp ON tp.team_id = tm.id
                    LEFT JOIN users v ON p.verified_by = v.id
                    WHERE tp.user_id = :userId AND tp.eligibility_status = 'verified'
                    ORDER BY p.created_at DESC";
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute(in_array($role, ['coach','coach_manager'], true)
            ? [':coachId' => $userId, ':managerId' => $userId]
            : [':userId' => $userId]);
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
        $stmt=$this->db->prepare("SELECT tm.coach_user_id,tm.manager_user_id,t.registration_fee,
            EXISTS(SELECT 1 FROM team_players tp WHERE tp.team_id=tm.id AND tp.user_id=:player AND tp.eligibility_status='verified') player_member
            FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id WHERE tm.id=:team AND t.id=:tournament");
        $stmt->execute([':player'=>$userId,':team'=>$teamId,':tournament'=>$tournamentId]);$row=$stmt->fetch();
        if(!$row)return ['valid'=>false,'message'=>'The selected team does not belong to this tournament.'];
        if(in_array($role,['coach','coach_manager'],true)&&(int)$row['coach_user_id']!==$userId&&(int)($row['manager_user_id']??0)!==$userId)return ['valid'=>false,'message'=>'You can only submit a payment for your own team.'];
        if($role==='player'&&!$row['player_member'])return ['valid'=>false,'message'=>'You can only submit a payment for your verified team.'];
        $fee=(float)$row['registration_fee'];if($fee>0&&abs($amount-$fee)>.009)return ['valid'=>false,'message'=>'Payment amount must match the tournament registration fee of ₱'.number_format($fee,2).'.'];
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
        if ($role === 'coach_manager') {
            $sql = "SELECT p.id FROM payments p
                    JOIN teams tm ON p.team_id = tm.id
                    WHERE p.id = :pid AND (tm.coach_user_id = :uid OR tm.manager_user_id = :uid) LIMIT 1";
        } else {
            $sql = "SELECT p.id FROM payments p
                    JOIN teams tm ON p.team_id = tm.id
                    JOIN team_players tp ON tp.team_id = tm.id
                    WHERE p.id = :pid AND tp.user_id = :uid AND tp.eligibility_status = 'verified' LIMIT 1";
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':pid' => $paymentId, ':uid' => $userId]);
        return (bool) $stmt->fetch();
    }

    public function attachReceipt(int $id, string $url): bool {
        $stmt = $this->db->prepare("UPDATE payments SET receipt_photo_url = :url WHERE id = :id");
        return $stmt->execute([':url' => $url, ':id' => $id]);
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
        $sql = "UPDATE payments SET status = :status, verified_by = :verifierId, remarks = :remarks, verified_at = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':status' => $status,
            ':verifierId' => $verifierId,
            ':remarks' => $remarks,
            ':id' => $id
        ]);

        // If approved, update team status to registered
        if ($status === 'approved') {
            $pStmt = $this->db->prepare("SELECT team_id FROM payments WHERE id = :id LIMIT 1");
            $pStmt->execute([':id' => $id]);
            $pay = $pStmt->fetch();
            if ($pay) {
                $tStmt = $this->db->prepare("UPDATE teams SET status = 'registered' WHERE id = :tid");
                $tStmt->execute([':tid' => $pay['team_id']]);
            }
        }

        return true;
    }
}

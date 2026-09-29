<?php
// backend/models/AuditLog.php

require_once __DIR__ . '/../config/database.php';

class AuditLog {
    private ?PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function log(?int $userId, string $action, string $module, string $details = ''): bool {
        if (!$this->db) return false;

        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 250);

        $sql = "INSERT INTO audit_logs (user_id, action, module, ip_address, user_agent, details) 
                VALUES (:user_id, :action, :module, :ip_address, :user_agent, :details)";
        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            ':user_id' => $userId,
            ':action' => $action,
            ':module' => $module,
            ':ip_address' => $ipAddress,
            ':user_agent' => $userAgent,
            ':details' => $details
        ]);
    }

    public function getRecent(int $limit = 50): array {
        if (!$this->db) return [];
        $stmt = $this->db->prepare("
            SELECT a.*, u.full_name, u.email, u.role 
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC 
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getRecentForOrganizationUser(int $userId,int $limit=100):array {
        $stmt=$this->db->prepare("SELECT DISTINCT a.*,u.full_name,u.email,u.role FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id IN (
            SELECT member.user_id FROM organization_members viewer JOIN organization_members member ON member.organization_id=viewer.organization_id WHERE viewer.user_id=:viewer AND viewer.status='active'
            UNION SELECT tm.coach_user_id FROM organization_members viewer JOIN tournaments t ON t.organization_id=viewer.organization_id JOIN teams tm ON tm.tournament_id=t.id WHERE viewer.user_id=:coach_viewer AND viewer.status='active'
            UNION SELECT tp.user_id FROM organization_members viewer JOIN tournaments t ON t.organization_id=viewer.organization_id JOIN teams tm ON tm.tournament_id=t.id JOIN team_players tp ON tp.team_id=tm.id WHERE viewer.user_id=:player_viewer AND viewer.status='active'
        ) ORDER BY a.created_at DESC LIMIT :limit");
        $stmt->bindValue(':viewer',$userId,PDO::PARAM_INT);$stmt->bindValue(':coach_viewer',$userId,PDO::PARAM_INT);$stmt->bindValue(':player_viewer',$userId,PDO::PARAM_INT);$stmt->bindValue(':limit',$limit,PDO::PARAM_INT);$stmt->execute();return$stmt->fetchAll();
    }
}

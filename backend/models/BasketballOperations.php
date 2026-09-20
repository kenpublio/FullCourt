<?php

require_once __DIR__ . '/../config/database.php';

class BasketballOperations {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $connection = $database->getConnection();
        if (!$connection) {
            throw new RuntimeException('Database connection is unavailable.');
        }
        $this->db = $connection;
    }

    public function organizationsForUser(int $userId, string $role): array {
        if (in_array($role, ['platform_admin', 'admin'], true)) {
            $stmt = $this->db->query("SELECT o.*, u.full_name AS creator_name,
                (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id AND om.status = 'active') AS member_count
                FROM organizations o JOIN users u ON u.id = o.created_by ORDER BY o.created_at DESC");
            return $stmt->fetchAll();
        }
        $stmt = $this->db->prepare("SELECT DISTINCT o.* FROM organizations o
            JOIN organization_members om ON om.organization_id = o.id
            WHERE om.user_id = :user_id AND om.status IN ('invited','active') ORDER BY o.name");
        $stmt->execute([':user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public function createOrganization(array $data, int $userId): int {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("INSERT INTO organizations
                (name, organization_type, slug, tagline, primary_color, secondary_color, created_by)
                VALUES (:name,:type,:slug,:tagline,:primary,:secondary,:created_by)");
            $stmt->execute([
                ':name' => $data['name'], ':type' => $data['organization_type'], ':slug' => $data['slug'],
                ':tagline' => $data['tagline'] ?? null, ':primary' => $data['primary_color'] ?? '#F97316',
                ':secondary' => $data['secondary_color'] ?? '#18181B', ':created_by' => $userId
            ]);
            $id = (int)$this->db->lastInsertId();
            $member = $this->db->prepare("INSERT INTO organization_members (organization_id,user_id,role,status)
                VALUES (:organization_id,:user_id,'organization_admin','active')");
            $member->execute([':organization_id' => $id, ':user_id' => $userId]);
            $this->db->commit();
            return $id;
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function reviewOrganization(int $id, string $status, int $reviewerId, ?string $notes): bool {
        $stmt = $this->db->prepare("UPDATE organizations SET status=:status, application_notes=:notes,
            reviewed_by=:reviewer, reviewed_at=NOW() WHERE id=:id");
        return $stmt->execute([':status'=>$status, ':notes'=>$notes, ':reviewer'=>$reviewerId, ':id'=>$id]);
    }

    public function divisions(int $tournamentId): array {
        $stmt = $this->db->prepare("SELECT d.*,
            (SELECT COUNT(*) FROM teams t WHERE t.division_id=d.id) AS team_count
            FROM divisions d WHERE d.tournament_id=:tournament_id ORDER BY d.name");
        $stmt->execute([':tournament_id'=>$tournamentId]);
        return $stmt->fetchAll();
    }

    public function createDivision(int $tournamentId, array $data): int {
        $stmt = $this->db->prepare("INSERT INTO divisions
            (tournament_id,name,age_group,gender_category,format,min_age,max_age,max_roster_size,eligibility_requirements)
            VALUES (:tournament_id,:name,:age_group,:gender,:format,:min_age,:max_age,:max_roster,:requirements)");
        $stmt->execute([
            ':tournament_id'=>$tournamentId, ':name'=>$data['name'], ':age_group'=>$data['age_group'] ?? null,
            ':gender'=>$data['gender_category'] ?? 'open', ':format'=>$data['format'] ?? 'round_robin',
            ':min_age'=>($data['min_age'] ?? '') === '' ? null : (int)$data['min_age'], ':max_age'=>($data['max_age'] ?? '') === '' ? null : (int)$data['max_age'],
            ':max_roster'=>$data['max_roster_size'] ?? 15, ':requirements'=>$data['eligibility_requirements'] ?? null
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function dashboard(int $userId, string $role): array {
        $organizations = $this->organizationsForUser($userId, $role);
        $organizationIds = array_map(static fn(array $row): int => (int)$row['id'], $organizations);
        if (!$organizationIds) {
            return ['organizations'=>0,'tournaments'=>0,'teams'=>0,'players'=>0,'active_games'=>0,'pending_eligibility'=>0];
        }
        $marks = implode(',', array_fill(0, count($organizationIds), '?'));
        $stmt = $this->db->prepare("SELECT
            COUNT(DISTINCT t.id) tournaments, COUNT(DISTINCT tm.id) teams,
            COUNT(DISTINCT tp.id) players,
            COUNT(DISTINCT CASE WHEN m.status='in_progress' THEN m.id END) active_games,
            COUNT(DISTINCT CASE WHEN tp.eligibility_status='pending' THEN tp.id END) pending_eligibility
            FROM tournaments t LEFT JOIN teams tm ON tm.tournament_id=t.id
            LEFT JOIN team_players tp ON tp.team_id=tm.id LEFT JOIN matches m ON m.tournament_id=t.id
            WHERE t.organization_id IN ($marks)");
        $stmt->execute($organizationIds);
        return array_merge(['organizations'=>count($organizationIds)], $stmt->fetch() ?: []);
    }
}

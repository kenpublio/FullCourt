<?php
// backend/models/User.php

require_once __DIR__ . '/../config/database.php';

class User {
    private ?PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        if (!$this->db) {
            throw new Exception("Database connection failed");
        }
    }

    public function findByEmail(string $email): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findByPhone(string $phone): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE phone_number = :phone LIMIT 1");
        $stmt->execute([':phone' => $phone]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findByLogin(string $identifier): ?array {
        return str_contains($identifier, '@') ? $this->findByEmail(strtolower($identifier)) : $this->findByPhone($identifier);
    }

    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT id, student_faculty_id, age_at_registration, birth_date, address, coach_team_name, coaching_experience_years, full_name, email, role, department_course, year_level, phone_number, avatar_url, is_active, created_at, updated_at FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findByStudentId(string $studentId): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE student_faculty_id = :studentId LIMIT 1");
        $stmt->execute([':studentId' => $studentId]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function create(array $data): int {
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) $this->db->beginTransaction();
        try {
        $sql = "INSERT INTO users (student_faculty_id, age_at_registration, birth_date, address, full_name, email, password_hash, role, department_course, year_level, phone_number) 
                VALUES (:student_id, :age, :birth_date, :address, :full_name, :email, :password_hash, :role, :department_course, :year_level, :phone_number)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':student_id' => $data['student_faculty_id'] ?? null,
            ':age' => $data['age'] ?? null,
            ':birth_date' => $data['birth_date'] ?? null,
            ':address' => $data['address'] ?? null,
            ':full_name' => $data['full_name'],
            ':email' => $data['email'],
            ':password_hash' => password_hash($data['password'], PASSWORD_BCRYPT),
            ':role' => $data['role'] ?? 'player',
            ':department_course' => $data['department_course'] ?: null,
            ':year_level' => $data['year_level'] ?: null,
            ':phone_number' => $data['phone_number'] ?? null
        ]);

        $id = (int) $this->db->lastInsertId();
        $details = $data['registration_details'] ?? [];
        if (($data['role'] ?? 'player') === 'player') {
            $profile = $this->db->prepare('INSERT INTO player_profiles (user_id,birth_date,primary_position,height_cm) VALUES (:user_id,:birth_date,:position,:height)');
            $profile->execute([':user_id'=>$id, ':birth_date'=>$data['birth_date'] ?? null, ':position'=>$details['playing_position'] ?? null, ':height'=>$details['height_cm'] ?? null]);
        } elseif ($data['role'] === 'coach') {
            $profile = $this->db->prepare('UPDATE users SET coach_team_name=:team, coaching_experience_years=:experience WHERE id=:id');
            $profile->execute([':team'=>$details['team_name'] ?? null, ':experience'=>$details['coaching_experience'] ?? null, ':id'=>$id]);
        } elseif ($data['role'] === 'organization_admin' && !empty($details['organization_name'])) {
            $organization = $this->db->prepare("INSERT INTO organizations (name,organization_type,slug,address,contact_designation,created_by,status) VALUES (:name,'club',:slug,:address,:designation,:user_id,'pending')");
            $organization->execute([':name'=>$details['organization_name'], ':slug'=>'organization-'.$id.'-'.bin2hex(random_bytes(4)), ':address'=>$details['organization_address'], ':designation'=>null, ':user_id'=>$id]);
            $organizationId = (int)$this->db->lastInsertId();
            $member = $this->db->prepare("INSERT INTO organization_members (organization_id,user_id,role,status) VALUES (:organization_id,:user_id,'organization_admin','active')");
            $member->execute([':organization_id'=>$organizationId, ':user_id'=>$id]);
        }
        if ($ownsTransaction) $this->db->commit();
        return $id;
        } catch (Throwable $e) {
            if ($ownsTransaction) {
                try {
                    $this->db->rollBack();
                } catch (PDOException) {
                    // A failed commit may already have closed the transaction.
                }
            }
            throw $e;
        }
    }

    public function updateProfile(int $id, array $data): bool {
        $sql = "UPDATE users SET full_name = :full_name, phone_number = :phone_number, address = :address WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            ':full_name' => $data['full_name'],
            ':phone_number' => $data['phone_number'] ?? null,
            ':address' => $data['address'] ?: null,
            ':id' => $id
        ]);
    }

    public function updateRole(int $id, string $role): bool {
        $stmt = $this->db->prepare("UPDATE users SET role = :role WHERE id = :id");
        return $stmt->execute([':role' => $role, ':id' => $id]);
    }

    public function updateManagedUser(int $id, array $data): bool {
        $stmt = $this->db->prepare("UPDATE users SET full_name=:full_name, email=:email, phone_number=:phone, address=:address, role=:role WHERE id=:id");
        return $stmt->execute([
            ':full_name'=>$data['full_name'], ':email'=>$data['email'],
            ':phone'=>$data['phone_number'] ?: null, ':address'=>$data['address'] ?: null,
            ':role'=>$data['role'], ':id'=>$id
        ]);
    }

    public function toggleStatus(int $id, bool $isActive): bool {
        $stmt = $this->db->prepare("UPDATE users SET is_active = :status WHERE id = :id");
        return $stmt->execute([':status' => $isActive ? 1 : 0, ':id' => $id]);
    }

    public function getAll(): array {
        $stmt = $this->db->query("SELECT id, full_name, email, role, phone_number, address, birth_date, is_active, created_at FROM users ORDER BY id DESC");
        return $stmt->fetchAll();
    }

    public function getForOrganizationUser(int $userId): array {
        $sql = "SELECT DISTINCT u.id,u.full_name,u.email,u.role,u.phone_number,u.address,u.birth_date,u.is_active,u.created_at
                FROM organization_members viewer
                JOIN organizations o ON o.id=viewer.organization_id AND o.status='active'
                JOIN tournaments t ON t.organization_id=o.id
                JOIN teams tm ON tm.tournament_id=t.id
                JOIN users u ON u.id=tm.coach_user_id OR u.id=tm.manager_user_id
                    OR EXISTS (SELECT 1 FROM team_players tp WHERE tp.team_id=tm.id AND tp.user_id=u.id)
                WHERE viewer.user_id=:user_id AND viewer.status='active'
                ORDER BY u.id DESC";
        $stmt=$this->db->prepare($sql);
        $stmt->execute([':user_id'=>$userId]);
        return $stmt->fetchAll();
    }

    public function saveVerificationCode(string $email, string $purpose, string $code): void {
        $this->db->prepare("DELETE FROM email_verifications WHERE email = :email AND purpose = :purpose")->execute([':email'=>$email, ':purpose'=>$purpose]);
        $stmt=$this->db->prepare("INSERT INTO email_verifications (email,purpose,code_hash,expires_at) VALUES (:email,:purpose,:hash,NOW() + INTERVAL '3 minutes')");
        $stmt->execute([':email'=>$email,':purpose'=>$purpose,':hash'=>password_hash($code,PASSWORD_BCRYPT)]);
    }

    public function verifyCode(string $email, string $purpose, string $code, bool $consume=true): bool {
        $stmt=$this->db->prepare("SELECT id,code_hash FROM email_verifications WHERE email=:email AND purpose=:purpose AND used_at IS NULL AND expires_at>NOW() ORDER BY id DESC LIMIT 1");
        $stmt->execute([':email'=>$email,':purpose'=>$purpose]); $row=$stmt->fetch();
        if(!$row || !password_verify($code,$row['code_hash'])) return false;
        if($consume) $this->db->prepare("UPDATE email_verifications SET used_at=NOW() WHERE id=:id")->execute([':id'=>$row['id']]);
        return true;
    }

    public function updatePasswordByEmail(string $email,string $password): bool {
        $stmt=$this->db->prepare("UPDATE users SET password_hash=:hash WHERE email=:email");
        return $stmt->execute([':hash'=>password_hash($password,PASSWORD_BCRYPT),':email'=>$email]);
    }

    public function updatePasswordByLogin(string $identifier,string $password):bool {
        $sql=str_contains($identifier,'@')
            ? 'UPDATE users SET password_hash=:hash WHERE email=:identifier'
            : 'UPDATE users SET password_hash=:hash WHERE phone_number=:identifier';
        $stmt=$this->db->prepare($sql);
        return $stmt->execute([':hash'=>password_hash($password,PASSWORD_BCRYPT),':identifier'=>$identifier]);
    }

    public function changePassword(int $userId,string $currentPassword,string $newPassword):bool {
        $stmt=$this->db->prepare('SELECT password_hash FROM users WHERE id=:id LIMIT 1');
        $stmt->execute([':id'=>$userId]);
        $hash=$stmt->fetchColumn();
        if(!is_string($hash)||!password_verify($currentPassword,$hash)) return false;
        $update=$this->db->prepare('UPDATE users SET password_hash=:hash WHERE id=:id');
        return $update->execute([':hash'=>password_hash($newPassword,PASSWORD_BCRYPT),':id'=>$userId]);
    }

    public function updateAvatar(int $id, string $url): bool {
        $stmt = $this->db->prepare("UPDATE users SET avatar_url=:url WHERE id=:id");
        return $stmt->execute([':url' => $url, ':id' => $id]);
    }
}

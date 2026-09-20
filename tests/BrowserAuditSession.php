<?php
// CLI-only session fixture for a read-only audit of the existing demo roles.
if (PHP_SAPI !== 'cli') exit(1);
require_once __DIR__ . '/../backend/models/User.php';
require_once __DIR__ . '/../backend/utils/jwt.php';
$db = (new Database())->getConnection();
$sessions = [];
foreach (['platform_admin', 'organization_admin', 'coach', 'player'] as $role) {
    $query = $db->prepare('SELECT * FROM users WHERE role = :role AND is_active = 1 ORDER BY id LIMIT 1');
    $query->execute([':role' => $role]);
    $user = $query->fetch();
    if (!$user || !$user['is_active']) continue;
    unset($user['password_hash']);
    $sessions[] = ['user' => $user, 'token' => JWT::generate([
        'user_id' => $user['id'], 'role' => $user['role'],
        'email' => $user['email'], 'full_name' => $user['full_name'],
        'student_faculty_id' => $user['student_faculty_id'],
    ], 3600)];
}
echo json_encode($sessions, JSON_THROW_ON_ERROR);

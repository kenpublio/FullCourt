<?php
// CLI-only session fixture for a read-only audit of the existing demo roles.
if (PHP_SAPI !== 'cli') exit(1);
require_once __DIR__ . '/../backend/models/User.php';
require_once __DIR__ . '/../backend/utils/jwt.php';
$db = (new Database())->getConnection();
$sessions = [];
foreach (['platform_admin', 'coach', 'assistant_coach', 'statistician'] as $role) {
    $activeTeamOrder = in_array($role, ['coach', 'assistant_coach'], true)
        ? "CASE WHEN EXISTS (SELECT 1 FROM teams tm JOIN tournaments tr ON tr.id=tm.tournament_id WHERE tr.archived_at IS NULL AND (tm.coach_user_id=users.id OR tm.manager_user_id=users.id)) THEN 0 ELSE 1 END, CASE WHEN EXISTS (SELECT 1 FROM payments pay JOIN teams pay_tm ON pay_tm.id=pay.team_id JOIN tournaments pay_tr ON pay_tr.id=pay.tournament_id WHERE pay.status='approved' AND pay_tr.archived_at IS NULL AND (pay_tm.coach_user_id=users.id OR pay_tm.manager_user_id=users.id)) THEN 1 ELSE 0 END,"
        : '';
    $query = $db->prepare("SELECT * FROM users WHERE role = :role AND is_active = 1 ORDER BY {$activeTeamOrder} id LIMIT 1");
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

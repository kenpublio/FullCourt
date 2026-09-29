<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

$db = (new Database())->getConnection();
$teams = $db->query("SELECT id, team_name FROM teams WHERE tournament_id=2 ORDER BY id")->fetchAll();
if (count($teams) < 2) {
    fwrite(STDERR, "Demo tournament teams were not found.\n");
    exit(1);
}

$primaryCoachId = 4;
$password = password_hash('FullCourt2026!', PASSWORD_BCRYPT);
$upsertCoach = $db->prepare("INSERT INTO users
    (student_faculty_id,full_name,email,password_hash,role,department_course,is_active)
    VALUES (:member_id,:name,:email,:password,'coach','Basketball Coach',1)
    ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name,role='coach',is_active=1
    RETURNING id");
$assign = $db->prepare('UPDATE teams SET coach_user_id=:coach_id,manager_user_id=NULL WHERE id=:team_id');

$db->beginTransaction();
try {
    foreach ($teams as $index => $team) {
        if ($index === 0) {
            $coachId = $primaryCoachId;
        } else {
            $email = sprintf('demo.coach%02d@fullcourt.local', $team['id']);
            $upsertCoach->execute([
                ':member_id' => sprintf('FC-COACH-%03d', $team['id']),
                ':name' => $team['team_name'] . ' Coach',
                ':email' => $email,
                ':password' => $password,
            ]);
            $coachId = (int) $upsertCoach->fetchColumn();
        }
        $assign->execute([':coach_id' => $coachId, ':team_id' => $team['id']]);
    }
    $db->commit();
    echo "Assigned one coach account per demo team. Primary coach@ now manages {$teams[0]['team_name']} only.\n";
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}

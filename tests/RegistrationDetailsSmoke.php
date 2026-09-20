<?php
require_once __DIR__ . '/../backend/models/User.php';
require_once __DIR__ . '/../backend/utils/RegistrationDetails.php';

$model = new User();
$property = new ReflectionProperty(User::class, 'db');
$db = $property->getValue($model);
$db->beginTransaction();
function checkRegistration(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException($message);
}
try {
    foreach (['player','coach','organization_admin'] as $role) {
        $input = ['playing_position'=>'Point Guard','height_cm'=>'175.5','team_name'=>'Test team','coaching_experience'=>'0','organization_name'=>'Registration Test','organization_address'=>'Test address'];
        $details = RegistrationDetails::validate($input, $role, 25);
        $id = $model->create(['full_name'=>'Registration Test','role'=>$role,'age'=>25,'birth_date'=>'2001-01-01','address'=>'Test address','email'=>'registration-'.bin2hex(random_bytes(5)).'@example.invalid','password'=>bin2hex(random_bytes(20)), 'department_course'=>'','year_level'=>'','registration_details'=>$details]);
        if ($role === 'player') {
            $stmt = $db->prepare('SELECT * FROM player_profiles WHERE user_id=:id');
            $stmt->execute([':id'=>$id]); $row=$stmt->fetch();
            checkRegistration($row['primary_position']==='Point Guard' && (float)$row['height_cm']===175.5 && $row['birth_date']==='2001-01-01','Player details did not persist.');
        } elseif ($role === 'coach') {
            $row=$model->findById($id);
            checkRegistration($row['coach_team_name']==='Test team' && (int)$row['coaching_experience_years']===0,'Coach details did not persist.');
        } else {
            $stmt=$db->prepare('SELECT * FROM organizations WHERE created_by=:id');$stmt->execute([':id'=>$id]);$row=$stmt->fetch();
            checkRegistration($row['status']==='pending' && $row['address']==='Test address' && $row['contact_designation']===null,'Organization details did not persist.');
            $sql="SELECT om.organization_id FROM organization_members om JOIN organizations o ON o.id=om.organization_id WHERE om.user_id=:user_id AND om.status='active' AND o.status='active' AND om.role IN ('organization_admin','organizer')";
            $stmt=$db->prepare($sql);$stmt->execute([':user_id'=>$id]);
            checkRegistration($stmt->fetchColumn()===false,'Pending organization has tournament access.');
            $stmt=$db->prepare("UPDATE organizations SET status='active' WHERE created_by=:id");$stmt->execute([':id'=>$id]);
            $stmt=$db->prepare($sql);$stmt->execute([':user_id'=>$id]);
            checkRegistration($stmt->fetchColumn()!==false,'Approved organization missing access.');
        }
        echo "$role: PASS\n";
    }
    checkRegistration(RegistrationDetails::validate([], 'player', 25)['height_cm']===null,'Optional height failed.');
    checkRegistration(RegistrationDetails::validate([], 'coach', 25)['coaching_experience']===null,'Optional experience failed.');
    foreach ([['player',['playing_position'=>'invalid']],['player',['height_cm'=>-1]],['coach',['coaching_experience'=>26]],['organization_admin',[]]] as [$role,$input]) {
        try { RegistrationDetails::validate($input,$role,25); throw new RuntimeException('Invalid details accepted.'); }
        catch (InvalidArgumentException $expected) {}
    }
    echo "Validation: PASS\n";
} finally {
    $db->rollBack();
    echo "Test records rolled back.\n";
}

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
    foreach (['coach'] as $role) {
        $input = ['playing_position'=>'Point Guard','height_cm'=>'175.5','team_name'=>'Test team','coaching_experience'=>'0','organization_name'=>'Registration Test','organization_address'=>'Test address'];
        $details = RegistrationDetails::validate($input, $role, 25);
        $id = $model->create(['full_name'=>'Registration Test','role'=>$role,'age'=>25,'birth_date'=>'2001-01-01','address'=>'Test address','email'=>'registration-'.bin2hex(random_bytes(5)).'@example.invalid','password'=>bin2hex(random_bytes(20)), 'department_course'=>'','year_level'=>'','registration_details'=>$details]);
        if ($role === 'coach') {
            $row=$model->findById($id);
            checkRegistration($row['coach_team_name']==='Test team' && (int)$row['coaching_experience_years']===0,'Coach details did not persist.');
        }
        echo "$role: PASS\n";
    }
    checkRegistration(RegistrationDetails::validate([], 'coach', 25)['coaching_experience']===null,'Optional experience failed.');
    foreach ([['coach',['coaching_experience'=>26]]] as [$role,$input]) {
        try { RegistrationDetails::validate($input,$role,25); throw new RuntimeException('Invalid details accepted.'); }
        catch (InvalidArgumentException $expected) {}
    }
    echo "Validation: PASS\n";
} finally {
    $db->rollBack();
    echo "Test records rolled back.\n";
}

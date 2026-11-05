<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/Tournament.php';

$db=(new Database())->getConnection();
$adminId=(int)$db->query("SELECT id FROM users WHERE role IN ('platform_admin','admin') ORDER BY FIELD(role,'platform_admin','admin'),id LIMIT 1")->fetchColumn();
if(!$adminId)throw new RuntimeException('Create an Administrator account before seeding the U21 tournament.');

$basketballId=(int)$db->query("SELECT id FROM sports WHERE LOWER(name)='basketball' LIMIT 1")->fetchColumn();
if(!$basketballId)throw new RuntimeException('Basketball sport configuration is missing.');

$password='FullCourt2026!';
$passwordHash=password_hash($password,PASSWORD_BCRYPT);
$upsertUser=$db->prepare("INSERT INTO users(full_name,email,password_hash,role,phone_number,address,birth_date,age_at_registration,is_active)
    VALUES(:name,:email,:password,:role,:phone,:address,:birth_date,:age,1)
    ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),full_name=VALUES(full_name),password_hash=VALUES(password_hash),role=VALUES(role),phone_number=VALUES(phone_number),address=VALUES(address),is_active=1");

$upsertUser->execute([':name'=>'Nova Serato',':email'=>'nova.serato@fullcourt.local',':password'=>$passwordHash,':role'=>'statistician',':phone'=>'09910000001',':address'=>'Ormoc City, Leyte',':birth_date'=>'1994-04-18',':age'=>32]);
$staffId=(int)$db->lastInsertId();

$coachNames=['Ariel Dela Cruz','Benjie Flores','Christian Ramos','Dennis Abella','Eric Villarin','Francis Gomez','Gerald Herrera','Harold Ignacio','Ian Bautista','Joshua Mendoza'];
$teamNames=['Purok 1 Warriors','Purok 2 Eagles','Purok 3 Titans','Purok 4 Falcons','Purok 5 Chargers','Purok 6 Knights','Purok 7 Phoenix','Purok 8 Guardians','Purok 9 Ballers','Purok 10 Mariners'];
$colors=['#cd2d17','#1d4ed8','#15803d','#7e22ce','#c2410c','#0f766e','#be123c','#4338ca','#a16207','#0369a1'];
$coachIds=[];
foreach($coachNames as $index=>$name){
    $upsertUser->execute([
        ':name'=>$name,':email'=>sprintf('linao.u21.coach%02d@fullcourt.local',$index+1),':password'=>$passwordHash,':role'=>'coach',
        ':phone'=>sprintf('097700000%02d',$index+1),':address'=>'Barangay Linao, Ormoc City, Leyte',':birth_date'=>'1990-06-15',':age'=>36,
    ]);
    $coachIds[]=(int)$db->lastInsertId();
}

$venueLookup=$db->prepare("SELECT id FROM venues WHERE LOWER(name)=LOWER(:name) LIMIT 1");
$venueLookup->execute([':name'=>'Ormoc City Superdome']);$venueId=(int)$venueLookup->fetchColumn();
if(!$venueId){
    $venueInsert=$db->prepare("INSERT INTO venues(name,location,approval_status,submitted_by,reviewed_by,reviewed_at) VALUES(:name,:location,'approved',:submitted,:reviewed,NOW())");
    $venueInsert->execute([':name'=>'Ormoc City Superdome',':location'=>'Aunubing Street, Ormoc City, Leyte, Philippines',':submitted'=>$adminId,':reviewed'=>$adminId]);
    $venueId=(int)$db->lastInsertId();
}
$courtLookup=$db->prepare("SELECT id FROM courts WHERE venue_id=:venue AND LOWER(court_name)=LOWER(:name) LIMIT 1");
$courtLookup->execute([':venue'=>$venueId,':name'=>'Superdome Main Court']);$courtId=(int)$courtLookup->fetchColumn();
if(!$courtId){
    $courtInsert=$db->prepare("INSERT INTO courts(venue_id,court_name,sport_id,is_available) VALUES(:venue,:name,:sport,1)");
    $courtInsert->execute([':venue'=>$venueId,':name'=>'Superdome Main Court',':sport'=>$basketballId]);
    $courtId=(int)$db->lastInsertId();
}

// Keep one approved alternative venue available for deliberate per-game
// venue changes without attaching it as the tournament's default court.
$venueLookup->execute([':name'=>'Linao Barangay Gymnasium']);$alternateVenueId=(int)$venueLookup->fetchColumn();
if(!$alternateVenueId){
    $venueInsert=$db->prepare("INSERT INTO venues(name,location,approval_status,submitted_by,reviewed_by,reviewed_at) VALUES(:name,:location,'approved',:submitted,:reviewed,NOW())");
    $venueInsert->execute([':name'=>'Linao Barangay Gymnasium',':location'=>'Barangay Linao, Ormoc City, Leyte, Philippines',':submitted'=>$adminId,':reviewed'=>$adminId]);
    $alternateVenueId=(int)$db->lastInsertId();
}
$courtLookup->execute([':venue'=>$alternateVenueId,':name'=>'Linao Main Court']);$alternateCourtId=(int)$courtLookup->fetchColumn();
if(!$alternateCourtId){
    $courtInsert=$db->prepare("INSERT INTO courts(venue_id,court_name,sport_id,is_available) VALUES(:venue,:name,:sport,1)");
    $courtInsert->execute([':venue'=>$alternateVenueId,':name'=>'Linao Main Court',':sport'=>$basketballId]);
    $alternateCourtId=(int)$db->lastInsertId();
}

$tournamentName='Linao Inter-Purok Under 21';
$old=$db->prepare('SELECT id FROM tournaments WHERE name=:name');$old->execute([':name'=>$tournamentName]);
foreach($old->fetchAll(PDO::FETCH_COLUMN) as $oldId)$db->prepare('DELETE FROM tournaments WHERE id=:id')->execute([':id'=>$oldId]);

$tournamentId=(new Tournament())->create([
    'organization_id'=>null,'name'=>$tournamentName,'sport_id'=>$basketballId,'format'=>'double_elimination','seeding_type'=>'automatic',
    'rules'=>'FIBA basketball rules. Players must be 21 years old or younger on November 15, 2026. Maximum roster: 15 players.',
    'description'=>'Official Under 21 double-elimination basketball tournament for the ten puroks of Barangay Linao.',
    'start_date'=>'2026-11-15','end_date'=>'2026-12-06','registration_deadline'=>'2026-11-10','registration_fee'=>0,
    'approval_status'=>'approved','is_published'=>0,'operation_mode'=>'official','created_by'=>$adminId,'court_ids'=>[$courtId],
    'max_games_per_team_per_day'=>1,'min_rest_minutes_between_games'=>120,'default_match_duration_minutes'=>90,'default_break_minutes'=>15,
    'schedule_start_time'=>'08:00','schedule_end_time'=>'20:00','available_days'=>'sat,sun',
]);
(new Tournament())->assignStaff($tournamentId,$staffId,$adminId);

$hasCutoff=(bool)$db->query("SHOW COLUMNS FROM divisions LIKE 'age_cutoff_date'")->fetch();
$divisionSql=$hasCutoff
    ? "INSERT INTO divisions(tournament_id,name,age_group,gender_category,format,min_age,max_age,age_cutoff_date,max_roster_size,eligibility_requirements) VALUES(:tid,'Under 21','U21','open','double_elimination',NULL,21,'2026-11-15',15,'Birth Certificate/PSA and Parent Waiver required')"
    : "INSERT INTO divisions(tournament_id,name,age_group,gender_category,format,min_age,max_age,max_roster_size,eligibility_requirements) VALUES(:tid,'Under 21','U21','open','double_elimination',NULL,21,15,'Birth Certificate/PSA and Parent Waiver required')";
$division=$db->prepare($divisionSql);$division->execute([':tid'=>$tournamentId]);$divisionId=(int)$db->lastInsertId();

$teamInsert=$db->prepare("INSERT INTO teams(tournament_id,division_id,team_name,short_name,primary_color,secondary_color,coach_user_id,manager_user_id,qr_code_hash,status) VALUES(:tid,:division,:name,:short,:primary,'#18181B',:coach,:manager,:qr,'registered')");
$playerInsert=$db->prepare("INSERT INTO team_players(team_id,user_id,student_id_number,player_name,birth_date,guardian_name,guardian_contact,jersey_number,position,eligibility_status,request_type,verified_by,remarks) VALUES(:team,NULL,:student,:name,:birth,:guardian,:contact,:jersey,:position,'verified','coach_registration',:admin,'Verified rehearsal roster for Linao Inter-Purok Under 21.')");
$positions=['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'];
$firstNames=['Alvin','Brent','Cedric','Daryl','Ethan','Franz','Gabriel','Harvey','Isaac','Joshua','Kevin','Lance','Mark','Nathan','Owen'];
$lastNames=['Abella','Bautista','Cabigon','Dela Cruz','Enriquez','Flores','Gomez','Herrera','Ignacio','Javier'];
$teamIds=[];
$db->beginTransaction();
try{
    foreach($teamNames as $teamIndex=>$teamName){
        $teamInsert->execute([
            ':tid'=>$tournamentId,':division'=>$divisionId,':name'=>$teamName,':short'=>'P'.($teamIndex+1),':primary'=>$colors[$teamIndex],
            ':coach'=>$coachIds[$teamIndex],':manager'=>$coachIds[$teamIndex],':qr'=>hash('sha256',"linao-u21-purok-".($teamIndex+1)."-2026"),
        ]);
        $teamId=(int)$db->lastInsertId();$teamIds[]=$teamId;
        for($slot=0;$slot<15;$slot++){
            $playerName=$firstNames[$slot].' '.$lastNames[($slot+$teamIndex)%count($lastNames)];
            $playerInsert->execute([
                ':team'=>$teamId,':student'=>sprintf('L-U21-%02d-%02d',$teamIndex+1,$slot+1),':name'=>$playerName,
                ':birth'=>sprintf('2006-%02d-%02d',($slot%12)+1,(($slot*2)%27)+1),':guardian'=>'Parent of '.$playerName,
                ':contact'=>sprintf('0968%07d',($teamIndex*15)+$slot+1),':jersey'=>$slot+1,':position'=>$positions[$slot%5],':admin'=>$adminId,
            ]);
        }
    }
    $db->commit();
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}

$bracketCount=(int)$db->query("SELECT COUNT(*) FROM brackets WHERE tournament_id={$tournamentId}")->fetchColumn();
$matchCount=(int)$db->query("SELECT COUNT(*) FROM matches WHERE tournament_id={$tournamentId}")->fetchColumn();

echo json_encode([
    'tournament_id'=>$tournamentId,'tournament'=>$tournamentName,'format'=>'double_elimination','published'=>false,
    'staff_admin'=>['name'=>'Nova Serato','email'=>'nova.serato@fullcourt.local'],
    'coach_accounts'=>array_map(fn($index,$name)=>['name'=>$name,'email'=>sprintf('linao.u21.coach%02d@fullcourt.local',$index+1),'team'=>$teamNames[$index]],array_keys($coachNames),$coachNames),
    'password'=>$password,'teams'=>count($teamIds),'players_per_team'=>15,'brackets_generated'=>$bracketCount,'scheduled_games'=>$matchCount,
    'default_venue'=>'Ormoc City Superdome · Superdome Main Court','available_replacement_venue'=>'Linao Barangay Gymnasium · Linao Main Court',
    'next_step'=>'Open Automated Bracket Engine and generate the bracket manually, then open Schedule Optimization.',
],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES),PHP_EOL;

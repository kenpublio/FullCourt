<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/Tournament.php';
require_once __DIR__ . '/../models/Bracket.php';
require_once __DIR__ . '/../models/ScoringAccess.php';

$db=(new Database())->getConnection();
$adminId=(int)$db->query("SELECT id FROM users WHERE role IN ('platform_admin','admin') ORDER BY FIELD(role,'platform_admin','admin'),id LIMIT 1")->fetchColumn();
if(!$adminId)throw new RuntimeException('Create an Administrator account before seeding the rehearsal league.');

// Bring awards in line with coach-managed roster records (no Player accounts).
$awardColumn=$db->query("SHOW COLUMNS FROM player_awards LIKE 'team_player_id'")->fetch();
if(!$awardColumn){
    foreach([
        "ALTER TABLE player_awards DROP FOREIGN KEY player_awards_ibfk_2",
        "ALTER TABLE player_awards MODIFY user_id INT NULL",
        "ALTER TABLE player_awards ADD COLUMN team_player_id INT NULL AFTER user_id",
        "ALTER TABLE player_awards ADD CONSTRAINT player_awards_team_player_fk FOREIGN KEY (team_player_id) REFERENCES team_players(id) ON DELETE CASCADE",
        "ALTER TABLE player_awards ADD UNIQUE KEY uniq_roster_player_award (award_category_id,team_player_id)",
    ] as $sql)$db->exec($sql);
}

$password='FullCourt2026!';
$passwordHash=password_hash($password,PASSWORD_BCRYPT);
$upsertUser=$db->prepare("INSERT INTO users(full_name,email,password_hash,role,phone_number,address,birth_date,age_at_registration,is_active)
    VALUES(:name,:email,:password,:role,:phone,:address,:birth_date,:age,1)
    ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),full_name=VALUES(full_name),password_hash=VALUES(password_hash),role=VALUES(role),phone_number=VALUES(phone_number),address=VALUES(address),is_active=1");

$upsertUser->execute([':name'=>'Nova Serato',':email'=>'nova.serato@fullcourt.local',':password'=>$passwordHash,':role'=>'statistician',':phone'=>'09910000001',':address'=>'Ormoc City, Leyte',':birth_date'=>'1994-04-18',':age'=>32]);
$staffId=(int)$db->lastInsertId();

$coachNames=['Adrian Flores','Bianca Ramos','Carlo Mendoza','Diana Villarin','Enzo Bautista','Faith Abella','Gio Herrera','Hazel Ignacio','Ivan Javier','Jessa Cabigon'];
$teamNames=['Linao Eagles','Ipil Warriors','Cogon Falcons','San Pablo Titans','Can-adieng Knights','Punta Chargers','Naungan Mariners','Valencia Phoenix','Milagro Guardians','Alta Vista Ballers'];
$colors=['#cd2d17','#1d4ed8','#15803d','#7e22ce','#c2410c','#0f766e','#be123c','#4338ca','#a16207','#0369a1'];
$coachIds=[];
foreach($coachNames as $index=>$name){
    $upsertUser->execute([':name'=>$name,':email'=>sprintf('summer.coach%02d@fullcourt.local',$index+1),':password'=>$passwordHash,':role'=>'coach',':phone'=>sprintf('099200000%02d',$index+1),':address'=>'Ormoc City, Leyte',':birth_date'=>'1990-05-15',':age'=>36]);
    $coachIds[]=(int)$db->lastInsertId();
}

$basketballId=(int)$db->query("SELECT id FROM sports WHERE LOWER(name)='basketball' LIMIT 1")->fetchColumn();
if(!$basketballId)throw new RuntimeException('Basketball sport configuration is missing.');

$venueLookup=$db->prepare("SELECT id FROM venues WHERE LOWER(name)=LOWER(:name) LIMIT 1");
$venueLookup->execute([':name'=>'Ormoc City Superdome']);$venueId=(int)$venueLookup->fetchColumn();
if(!$venueId){
    $venueInsert=$db->prepare("INSERT INTO venues(name,location,approval_status,created_by,reviewed_by,reviewed_at) VALUES(:name,:location,'approved',:admin,:admin,NOW())");
    $venueInsert->execute([':name'=>'Ormoc City Superdome',':location'=>'Aunubing Street, Ormoc City, Leyte, Philippines',':admin'=>$adminId]);$venueId=(int)$db->lastInsertId();
}
$courtLookup=$db->prepare("SELECT id FROM courts WHERE venue_id=:venue AND LOWER(court_name)=LOWER(:name) LIMIT 1");
$courtLookup->execute([':venue'=>$venueId,':name'=>'Superdome Main Court']);$courtId=(int)$courtLookup->fetchColumn();
if(!$courtId){
    $courtInsert=$db->prepare("INSERT INTO courts(venue_id,court_name,sport_id,is_available) VALUES(:venue,:name,:sport,1)");
    $courtInsert->execute([':venue'=>$venueId,':name'=>'Superdome Main Court',':sport'=>$basketballId]);$courtId=(int)$db->lastInsertId();
}

$old=$db->prepare("SELECT id FROM tournaments WHERE name=:name");$old->execute([':name'=>'Summer League 16 Under']);
foreach($old->fetchAll(PDO::FETCH_COLUMN) as $oldId)$db->prepare('DELETE FROM tournaments WHERE id=:id')->execute([':id'=>$oldId]);

$tournamentId=(new Tournament())->create([
    'organization_id'=>null,'name'=>'Summer League 16 Under','sport_id'=>$basketballId,'format'=>'single_elimination',
    'rules'=>'FIBA basketball rules. Players must be 16 years old or younger on November 16, 2026. Maximum roster: 15 players.',
    'description'=>'Official Ormoc community summer basketball league for players aged 16 and under.',
    'start_date'=>'2026-11-16','end_date'=>'2026-12-05','registration_deadline'=>'2026-11-10','registration_fee'=>0,
    'approval_status'=>'approved','is_published'=>1,'operation_mode'=>'official','created_by'=>$adminId,'court_ids'=>[$courtId],
    'max_games_per_team_per_day'=>1,'min_rest_minutes_between_games'=>1440,'default_match_duration_minutes'=>90,'default_break_minutes'=>15,
    'schedule_start_time'=>'08:00','schedule_end_time'=>'20:00','available_days'=>'mon,tue,wed,thu,fri,sat,sun',
]);
(new Tournament())->assignStaff($tournamentId,$staffId,$adminId);

$hasCutoff=(bool)$db->query("SHOW COLUMNS FROM divisions LIKE 'age_cutoff_date'")->fetch();
$divisionSql=$hasCutoff
    ? "INSERT INTO divisions(tournament_id,name,age_group,gender_category,format,min_age,max_age,age_cutoff_date,max_roster_size,eligibility_requirements) VALUES(:tid,'16 Under','16U','open','single_elimination',NULL,16,'2026-11-16',15,'Birth Certificate/PSA and Parent Waiver required')"
    : "INSERT INTO divisions(tournament_id,name,age_group,gender_category,format,min_age,max_age,max_roster_size,eligibility_requirements) VALUES(:tid,'16 Under','16U','open','single_elimination',NULL,16,15,'Birth Certificate/PSA and Parent Waiver required')";
$division=$db->prepare($divisionSql);$division->execute([':tid'=>$tournamentId]);$divisionId=(int)$db->lastInsertId();

$teamInsert=$db->prepare("INSERT INTO teams(tournament_id,division_id,team_name,short_name,primary_color,secondary_color,coach_user_id,manager_user_id,qr_code_hash,status) VALUES(:tid,:division,:name,:short,:primary,'#18181B',:coach,:manager,:qr,'registered')");
$playerInsert=$db->prepare("INSERT INTO team_players(team_id,user_id,student_id_number,player_name,birth_date,guardian_name,guardian_contact,jersey_number,position,eligibility_status,request_type,verified_by,remarks) VALUES(:team,NULL,:student,:name,:birth,:guardian,:contact,:jersey,:position,'verified','coach_registration',:admin,'Verified rehearsal roster for Summer League 16 Under.')");
$positions=['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'];
$firstNames=['Aldrin','Bryan','Cedric','Daryl','Ethan','Franz','Gabriel','Harvey','Isaac','Joshua','Kevin','Lance','Mark','Nathan','Owen'];
$lastNames=['Abella','Bautista','Cabigon','Dela Cruz','Enriquez','Flores','Gomez','Herrera','Ignacio','Javier'];
$teamIds=[];$rosters=[];
$db->beginTransaction();
try{
    foreach($teamNames as $teamIndex=>$teamName){
        $teamInsert->execute([':tid'=>$tournamentId,':division'=>$divisionId,':name'=>$teamName,':short'=>implode('',array_map(fn($word)=>$word[0],array_slice(explode(' ',$teamName),0,2))),':primary'=>$colors[$teamIndex],':coach'=>$coachIds[$teamIndex],':manager'=>$coachIds[$teamIndex],':qr'=>hash('sha256',"summer-u16-{$teamIndex}-2026")]);
        $teamId=(int)$db->lastInsertId();$teamIds[]=$teamId;$rosters[$teamId]=[];
        for($slot=0;$slot<15;$slot++){
            $playerName=$firstNames[$slot].' '.$lastNames[($slot+$teamIndex)%count($lastNames)];
            $playerInsert->execute([':team'=>$teamId,':student'=>sprintf('SL16-%02d-%02d',$teamIndex+1,$slot+1),':name'=>$playerName,':birth'=>sprintf('2010-%02d-%02d',($slot%12)+1,(($slot*2)%27)+1),':guardian'=>'Parent of '.$playerName,':contact'=>sprintf('0988%07d',($teamIndex*15)+$slot+1),':jersey'=>$slot+1,':position'=>$positions[$slot%5],':admin'=>$adminId]);
            $rosters[$teamId][]=(int)$db->lastInsertId();
        }
    }
    $db->commit();
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}

(new Bracket())->generateSingleElimination($tournamentId,$teamIds,1);
$validGames=$db->prepare("SELECT id,team1_id,team2_id FROM matches WHERE tournament_id=:tid AND round_number=1 AND team1_id IS NOT NULL AND team2_id IS NOT NULL ORDER BY match_number");
$validGames->execute([':tid'=>$tournamentId]);$games=$validGames->fetchAll();
$schedule=$db->prepare("UPDATE matches SET court_id=:court,scheduled_start_time=:starts,scheduled_end_time=:ends,schedule_status='published',status='scheduled',lineups_confirmed_at=NOW() WHERE id=:id");
$score=$db->prepare("INSERT INTO match_scores(match_id,team1_score,team2_score,current_period,timer_seconds,is_timer_running) VALUES(:match,0,0,'Q1',600,0) ON DUPLICATE KEY UPDATE team1_score=0,team2_score=0,current_period='Q1',timer_seconds=600,is_timer_running=0");
$lineup=$db->prepare("INSERT INTO game_lineups(match_id,team_player_id,is_present,is_starter,confirmed_by) VALUES(:match,:player,1,:starter,:coach) ON DUPLICATE KEY UPDATE is_present=1,is_starter=VALUES(is_starter),confirmed_by=VALUES(confirmed_by)");
foreach($games as $index=>$game){
    $starts=(new DateTimeImmutable('2026-11-16 08:00:00'))->modify('+'.($index*105).' minutes');$ends=$starts->modify('+90 minutes');
    $schedule->execute([':court'=>$courtId,':starts'=>$starts->format('Y-m-d H:i:s'),':ends'=>$ends->format('Y-m-d H:i:s'),':id'=>$game['id']]);
    $score->execute([':match'=>$game['id']]);
    foreach([(int)$game['team1_id'],(int)$game['team2_id']] as $teamId)foreach($rosters[$teamId] as $slot=>$playerId)$lineup->execute([':match'=>$game['id'],':player'=>$playerId,':starter'=>$slot<5?1:0,':coach'=>$coachIds[array_search($teamId,$teamIds,true)]]);
}

$scoring=null;
if($games){$scoring=(new ScoringAccess())->create((int)$games[0]['id'],$staffId,'Nova Serato',720);}
$db->prepare("UPDATE tournaments SET is_published=0,archived_at=COALESCE(archived_at,NOW()) WHERE id<>:id AND is_published=1")->execute([':id'=>$tournamentId]);

echo json_encode([
    'tournament_id'=>$tournamentId,'tournament'=>'Summer League 16 Under','staff_admin'=>['name'=>'Nova Serato','email'=>'nova.serato@fullcourt.local'],
    'coach_accounts'=>array_map(fn($index,$name)=>['name'=>$name,'email'=>sprintf('summer.coach%02d@fullcourt.local',$index+1),'team'=>$teamNames[$index]],array_keys($coachNames),$coachNames),
    'password'=>$password,'teams'=>count($teamIds),'players_per_team'=>15,'scheduled_opening_games'=>count($games),
    'scoring_link'=>$scoring?['url'=>'http://127.0.0.1:5180/score/'.$scoring['token'],'pin'=>$scoring['pin'],'match_id'=>(int)$games[0]['id']]:null,
],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES),PHP_EOL;

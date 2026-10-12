<?php
require_once __DIR__ . '/../backend/models/TeamPlayer.php';

$db=(new Database())->getConnection();
$teamId=(int)$db->query("SELECT tm.id FROM teams tm JOIN tournaments t ON t.id=tm.tournament_id WHERE t.name LIKE 'FullCourt Scoring Link E2E%' ORDER BY tm.id DESC LIMIT 1")->fetchColumn();
if(!$teamId)throw new RuntimeException('A FullCourt E2E team fixture is required.');

$db->beginTransaction();
try {
    $countStmt=$db->prepare("SELECT COUNT(*) FROM team_players WHERE team_id=:team_id AND eligibility_status<>'rejected'");
    $countStmt->execute([':team_id'=>$teamId]);
    $count=(int)$countStmt->fetchColumn();
    $insert=$db->prepare("INSERT INTO team_players(team_id,student_id_number,player_name,birth_date,eligibility_status,request_type) VALUES(:team_id,:student_id,:player_name,'2005-01-01','pending','coach_registration')");
    for($index=$count;$index<15;$index++){
        $insert->execute([':team_id'=>$teamId,':student_id'=>'CAPACITY-'.$index,':player_name'=>'Capacity Test '.$index]);
    }
    $capacity=(new TeamPlayer())->rosterCapacity($teamId);
    if($capacity['limit']!==15||$capacity['count']!==15)throw new RuntimeException('The 15-player roster capacity was not calculated correctly.');
    echo json_encode(['roster_capacity'=>$capacity,'transaction_rolled_back'=>true],JSON_PRETTY_PRINT).PHP_EOL;
    $db->rollBack();
} catch(Throwable $error){
    if($db->inTransaction())$db->rollBack();
    throw $error;
}

<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/Engagement.php';
require_once __DIR__ . '/../models/MatchScore.php';

function takeBracketWinner(array &$winners, int $round): int
{
    $winner = array_shift($winners);
    if (!is_int($winner)) {
        throw new RuntimeException('Bracket progression is incomplete for round ' . $round . '.');
    }
    return $winner;
}

$db = (new Database())->getConnection();
if (!$db) {
    fwrite(STDERR, "Database connection is unavailable.\n");
    exit(1);
}

$tournamentId = 2;
$teams = $db->prepare('SELECT id, team_name, primary_color FROM teams WHERE tournament_id=:tid ORDER BY id');
$teams->execute([':tid' => $tournamentId]);
$teams = $teams->fetchAll();
if (count($teams) !== 8) {
    fwrite(STDERR, "Expected 8 teams in tournament 2; found " . count($teams) . ".\n");
    exit(1);
}

$firstNames = ['Andre','Marco','Jules','Paolo','Nico','Carlo','Miguel','Enzo','Luis','Rafael'];
$lastNames = ['Abella','Bautista','Cabigon','Dela Cruz','Enriquez','Flores','Gomez','Herrera','Ignacio','Javier'];
$positions = ['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'];
$heights = [170,176,181,187,193];
$palette = ['#cd2d17','#d4a72c','#2563eb','#059669','#7c3aed','#ea580c','#0891b2','#be123c'];
$avatarDir = dirname(__DIR__) . '/uploads/avatars';
if (!is_dir($avatarDir)) mkdir($avatarDir, 0775, true);

$db->beginTransaction();
try {
    $insertUser = $db->prepare("INSERT INTO users
        (student_faculty_id,full_name,email,password_hash,role,department_course,year_level,avatar_url,is_active,age_at_registration,birth_date,address)
        VALUES (:member_id,:name,:email,:password,'player','Basketball Athlete',NULL,:avatar,1,:age,:birth_date,:address)
        ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name,avatar_url=EXCLUDED.avatar_url,
        age_at_registration=EXCLUDED.age_at_registration,birth_date=EXCLUDED.birth_date,address=EXCLUDED.address
        RETURNING id");
    $insertProfile = $db->prepare("INSERT INTO player_profiles (user_id,first_name,last_name,birth_date,height_cm,primary_position,is_public)
        VALUES (:uid,:first,:last,:birth_date,:height,:position,1)
        ON CONFLICT (user_id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,
        birth_date=EXCLUDED.birth_date,height_cm=EXCLUDED.height_cm,primary_position=EXCLUDED.primary_position,is_public=1");
    $findRoster = $db->prepare('SELECT id FROM team_players WHERE team_id=:team AND user_id=:uid LIMIT 1');
    $insertRoster = $db->prepare("INSERT INTO team_players
        (team_id,user_id,student_id_number,jersey_number,position,eligibility_status,request_type,verified_by,remarks)
        VALUES (:team,:uid,:member_id,:jersey,:position,'verified','coach_invitation',2,'Demo roster verified for system testing.')
        RETURNING id");
    $updateRoster = $db->prepare("UPDATE team_players SET jersey_number=:jersey,position=:position,
        eligibility_status='verified',verified_by=2,remarks='Demo roster verified for system testing.' WHERE id=:id");
    $password = password_hash('FullCourt2026!', PASSWORD_BCRYPT);
    $rosters = [];

    foreach ($teams as $teamIndex => $team) {
        $rosters[(int)$team['id']] = [];
        for ($slot = 0; $slot < 10; $slot++) {
            $number = ($teamIndex * 10) + $slot + 1;
            $first = $firstNames[$slot];
            $last = $lastNames[($slot + $teamIndex) % count($lastNames)];
            $name = $first . ' ' . $last;
            $email = sprintf('demo.player%02d@fullcourt.local', $number);
            $memberId = sprintf('FC-DEMO-%03d', $number);
            $position = $positions[$slot % 5];
            $birthYear = 2007 + ($slot % 3);
            $birthDate = sprintf('%04d-%02d-%02d', $birthYear, ($slot % 12) + 1, (($slot * 2) % 27) + 1);
            $age = (int)date('Y') - $birthYear;
            $avatarName = sprintf('demo_player_%02d.svg', $number);
            $avatarUrl = '/uploads/avatars/' . $avatarName;
            $initials = strtoupper($first[0] . $last[0]);
            $color = $palette[$teamIndex % count($palette)];
            $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">'
                . '<rect width="320" height="320" rx="54" fill="#111113"/><circle cx="160" cy="122" r="62" fill="' . $color . '"/>'
                . '<path d="M54 300c8-74 48-111 106-111s98 37 106 111" fill="' . $color . '"/>'
                . '<circle cx="138" cy="112" r="6" fill="#fff"/><circle cx="182" cy="112" r="6" fill="#fff"/>'
                . '<path d="M137 144c15 12 31 12 46 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>'
                . '<text x="160" y="286" text-anchor="middle" font-family="Arial,sans-serif" font-size="35" font-weight="800" fill="#fff">' . $initials . '</text></svg>';
            file_put_contents($avatarDir . '/' . $avatarName, $svg);

            $insertUser->execute([':member_id'=>$memberId,':name'=>$name,':email'=>$email,':password'=>$password,
                ':avatar'=>$avatarUrl,':age'=>$age,':birth_date'=>$birthDate,':address'=>'Ormoc City, Leyte']);
            $userId = (int)$insertUser->fetchColumn();
            $insertProfile->execute([':uid'=>$userId,':first'=>$first,':last'=>$last,':birth_date'=>$birthDate,
                ':height'=>$heights[$slot % 5] + intdiv($slot, 5),':position'=>$position]);
            $findRoster->execute([':team'=>(int)$team['id'],':uid'=>$userId]);
            $teamPlayerId = $findRoster->fetchColumn();
            if ($teamPlayerId === false) {
                $insertRoster->execute([':team'=>(int)$team['id'],':uid'=>$userId,':member_id'=>$memberId,
                    ':jersey'=>($slot + 1) * 2,':position'=>$position]);
                $teamPlayerId = $insertRoster->fetchColumn();
            } else {
                $updateRoster->execute([':jersey'=>($slot + 1) * 2,':position'=>$position,':id'=>(int)$teamPlayerId]);
            }
            $rosters[(int)$team['id']][] = (int)$teamPlayerId;
        }
    }

    $genericAvatar = '/uploads/avatars/demo_player_generic.svg';
    file_put_contents($avatarDir . '/demo_player_generic.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" rx="54" fill="#111113"/><circle cx="160" cy="115" r="65" fill="#cd2d17"/><path d="M45 320c8-84 52-126 115-126s107 42 115 126" fill="#cd2d17"/><text x="160" y="290" text-anchor="middle" font-family="Arial" font-size="34" font-weight="800" fill="white">FC</text></svg>');
    $db->exec("UPDATE users SET avatar_url='{$genericAvatar}' WHERE role='player' AND avatar_url IS NULL");
    // Reset only generated competition outputs so this demo command is safe to rerun.
    $db->prepare('DELETE FROM basketball_stat_events WHERE match_id IN (SELECT id FROM matches WHERE tournament_id=:tid)')
        ->execute([':tid'=>$tournamentId]);
    $db->prepare('DELETE FROM award_categories WHERE tournament_id=:tid')->execute([':tid'=>$tournamentId]);

    $matches = $db->prepare('SELECT id,round_number,match_number,team1_id,team2_id FROM matches WHERE tournament_id=:tid ORDER BY round_number,match_number');
    $matches->execute([':tid'=>$tournamentId]);
    $matches = $matches->fetchAll();
    $byRound = [];
    foreach ($matches as $match) $byRound[(int)$match['round_number']][] = $match;
    $scoreUpsert = $db->prepare("INSERT INTO match_scores (match_id,team1_score,team2_score,current_period,timer_seconds,is_timer_running)
        VALUES (:match,:s1,:s2,'FINAL',0,0) ON CONFLICT (match_id) DO UPDATE SET team1_score=EXCLUDED.team1_score,
        team2_score=EXCLUDED.team2_score,current_period='FINAL',timer_seconds=0,is_timer_running=0");
    $matchUpdate = $db->prepare("UPDATE matches SET team1_id=:t1,team2_id=:t2,winner_team_id=:winner,status='completed',
        schedule_status='published',scheduled_start_time=:start_time,scheduled_end_time=:end_time,
        actual_start_time=:start_time,actual_end_time=:end_time WHERE id=:id");
    $eventRows = [];
    $playedMatches = [];
    $gameIndex = 0;
    $previousWinners = [];
    foreach ($byRound as $round => $roundMatches) {
        $roundWinners = [];
        foreach ($roundMatches as $index => $match) {
            if ($round === 1) {
                $team1 = (int)$match['team1_id']; $team2 = (int)$match['team2_id'];
            } else {
                $team1 = takeBracketWinner($previousWinners, $round);
                $team2 = takeBracketWinner($previousWinners, $round);
            }
            $winner = (($gameIndex + $round) % 3 === 0) ? $team2 : $team1;
            $score1 = $winner === $team1 ? 78 + $gameIndex : 64 + $gameIndex;
            $score2 = $winner === $team2 ? 79 + $gameIndex : 65 + $gameIndex;
            $start = sprintf('2026-10-%02d %02d:00:00', 10 + $gameIndex, 9 + ($gameIndex % 4) * 2);
            $end = date('Y-m-d H:i:s', strtotime($start . ' +90 minutes'));
            $matchUpdate->execute([':t1'=>$team1,':t2'=>$team2,':winner'=>$winner,':start_time'=>$start,':end_time'=>$end,':id'=>(int)$match['id']]);
            $scoreUpsert->execute([':match'=>(int)$match['id'],':s1'=>$score1,':s2'=>$score2]);
            foreach ([$team1,$team2] as $teamId) {
                foreach (array_slice($rosters[$teamId], 0, 8) as $playerIndex => $teamPlayerId) {
                    $madeTwos = 1 + (($gameIndex + $playerIndex) % 4);
                    $madeThrees = ($playerIndex + $gameIndex) % 3;
                    $rebounds = 1 + (($playerIndex * 2 + $gameIndex) % 7);
                    $assists = ($playerIndex + $gameIndex) % 6;
                    $events = array_merge(array_fill(0,$madeTwos,'2pt_made'),array_fill(0,$madeThrees,'3pt_made'),
                        array_fill(0,$rebounds,'def_rebound'),array_fill(0,$assists,'assist'),
                        array_fill(0,($playerIndex+$gameIndex)%3,'steal'),array_fill(0,$playerIndex%2,'block'),
                        array_fill(0,($playerIndex+1)%3,'turnover'));
                    foreach ($events as $eventNo => $event) {
                        $uuid = sprintf('%08x-%04x-4%03x-8%03x-%012x', (int)$match['id'], $teamId, $teamPlayerId % 4096, $eventNo % 4096, ($teamPlayerId * 1000) + $eventNo);
                        $eventRows[] = [$uuid,(int)$match['id'],$teamId,$teamPlayerId,$event];
                    }
                }
            }
            $roundWinners[] = $winner;
            $playedMatches[] = (int)$match['id'];
            $gameIndex++;
        }
        $previousWinners = $roundWinners;
    }
    foreach (array_chunk($eventRows, 200) as $chunkIndex => $chunk) {
        $values = [];
        $params = [];
        foreach ($chunk as $rowIndex => $row) {
            $key = $chunkIndex . '_' . $rowIndex;
            $values[] = "(:uuid_{$key},:match_{$key},:team_{$key},:player_{$key},:event_{$key},4,0,'{}',0,2)";
            $params[":uuid_{$key}"]=$row[0]; $params[":match_{$key}"]=$row[1];
            $params[":team_{$key}"]=$row[2]; $params[":player_{$key}"]=$row[3]; $params[":event_{$key}"]=$row[4];
        }
        $sql = 'INSERT INTO basketball_stat_events (event_uuid,match_id,team_id,team_player_id,event_type,period,game_clock_seconds,metadata_json,is_void,recorded_by) VALUES ' . implode(',', $values);
        $db->prepare($sql)->execute($params);
    }
    $db->prepare("UPDATE tournaments SET status='completed',is_published=1 WHERE id=:tid")->execute([':tid'=>$tournamentId]);
    $db->commit();

    (new MatchScore())->recomputeStandings($tournamentId);
    $awards = (new Engagement())->recommendAwards($tournamentId);
    echo 'Seeded ' . (count($teams) * 10) . " demo players with avatars.\n";
    echo 'Completed ' . count($playedMatches) . " bracket games with official demo statistics.\n";
    echo 'Generated ' . count($awards) . " award recommendations, including MVP and Mythical Five.\n";
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}

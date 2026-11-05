<?php
// backend/models/Bracket.php

require_once __DIR__ . '/../config/database.php';

class Bracket {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->ensureAdvancementTable();
    }

    private function ensureAdvancementTable(): void {
        $this->db->exec("CREATE TABLE IF NOT EXISTS bracket_advancements (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            bracket_id INT NOT NULL,
            source_match_id INT NOT NULL,
            outcome VARCHAR(10) NOT NULL,
            target_match_id INT NOT NULL,
            target_slot TINYINT NOT NULL,
            UNIQUE KEY uniq_bracket_advance (source_match_id,outcome,target_match_id,target_slot),
            KEY idx_bracket_advance_target (target_match_id),
            CONSTRAINT bracket_advancement_bracket_fk FOREIGN KEY (bracket_id) REFERENCES brackets(id) ON DELETE CASCADE,
            CONSTRAINT bracket_advancement_source_fk FOREIGN KEY (source_match_id) REFERENCES matches(id) ON DELETE CASCADE,
            CONSTRAINT bracket_advancement_target_fk FOREIGN KEY (target_match_id) REFERENCES matches(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    // Dispatcher: clears the existing bracket for the tournament first, then
    // delegates to the format-specific generator. Returns the assembled bracket.
    public function generate(int $tournamentId, array $teamIds, string $format, int $groups = 1): array {
        $totalTeams = count($teamIds);
        if ($totalTeams < 2) {
            throw new Exception("At least 2 teams are required to generate a bracket.");
        }

        // Clear the current draft bracket and its generated matches. The match
        // rows are separate from brackets, so deleting only the bracket would
        // otherwise leave duplicate fixtures behind.
        $existing = $this->db->prepare("SELECT m.id,m.status,COALESCE(ms.team1_score,0) team1_score,COALESCE(ms.team2_score,0) team2_score,
            EXISTS(SELECT 1 FROM basketball_stat_events e WHERE e.match_id=m.id AND e.is_void=0) has_stats
            FROM brackets b JOIN bracket_nodes n ON n.bracket_id=b.id JOIN matches m ON m.id=n.match_id
            LEFT JOIN match_scores ms ON ms.match_id=m.id WHERE b.tournament_id=:tid");
        $existing->execute([':tid'=>$tournamentId]);
        $oldMatches = $existing->fetchAll();
        if (array_filter($oldMatches, static fn(array $m): bool => in_array($m['status'],['in_progress','completed'],true)
            || (int)$m['team1_score']>0 || (int)$m['team2_score']>0 || (int)$m['has_stats']===1)) {
            throw new Exception('Team placement is locked because a bracket game has already started.');
        }
        $this->db->prepare("DELETE FROM brackets WHERE tournament_id = :tid")->execute([':tid' => $tournamentId]);
        if ($oldMatches) {
            $ids = array_map(static fn(array $m): int => (int)$m['id'], $oldMatches);
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $this->db->prepare("DELETE FROM matches WHERE id IN ($marks)")->execute($ids);
        }

        $format = $this->normalizeFormat($format);
        $generator = 'generate' . $this->formatGeneratorName($format);
        if (!method_exists($this, $generator)) {
            throw new Exception("Bracket format '{$format}' is not yet supported.");
        }

        return $this->$generator($tournamentId, $teamIds, $groups);
    }

    private function normalizeFormat(string $format): string {
        $supported = ['single_elimination', 'double_elimination', 'round_robin', 'group_stage', 'league'];
        return in_array($format, $supported, true) ? $format : 'single_elimination';
    }

    private function formatGeneratorName(string $format): string {
        return match ($format) {
            'single_elimination'  => 'SingleElimination',
            'double_elimination'  => 'DoubleElimination',
            'round_robin'         => 'RoundRobin',
            'group_stage'         => 'GroupStage',
            'league'              => 'League',
            default               => 'SingleElimination',
        };
    }

    private function createBracket(int $tournamentId, string $format, int $rounds, int $totalTeams): int {
        $stmt = $this->db->prepare("INSERT INTO brackets (tournament_id, format, total_rounds, total_teams, seeding_type) VALUES (:tid, :fmt, :rounds, :teams, 'automatic')");
        $stmt->execute([':tid' => $tournamentId, ':fmt' => $format, ':rounds' => $rounds, ':teams' => $totalTeams]);
        return (int) $this->db->lastInsertId();
    }

    // Create one match, its score row, and bracket node. Returns the node id.
    private function seedNode(int $bracketId, int $tournamentId, int $round, int $position, int $matchNumber, string $stage, ?int $team1, ?int $team2, ?int $parentNode1 = null, ?int $parentNode2 = null): int {
        $mStmt = $this->db->prepare("INSERT INTO matches (tournament_id, round_number, match_number, stage_name, team1_id, team2_id, status) VALUES (:tid, :r, :mn, :stage, :t1, :t2, 'scheduled')");
        $mStmt->execute([
            ':tid' => $tournamentId, ':r' => $round, ':mn' => $matchNumber,
            ':stage' => $stage, ':t1' => $team1, ':t2' => $team2
        ]);
        $matchId = (int) $this->db->lastInsertId();

        $this->db->prepare("INSERT INTO match_scores (match_id, team1_score, team2_score) VALUES (:mid, 0, 0)")
            ->execute([':mid' => $matchId]);

        $nodeStmt = $this->db->prepare("INSERT INTO bracket_nodes (bracket_id, match_id, round, position_in_round, parent_node_1_id, parent_node_2_id) VALUES (:bid, :mid, :r, :pos, :p1, :p2)");
        $nodeStmt->execute([
            ':bid' => $bracketId, ':mid' => $matchId, ':r' => $round, ':pos' => $position,
            ':p1' => $parentNode1, ':p2' => $parentNode2
        ]);

        return (int) $this->db->lastInsertId();
    }

    private function matchIdForNode(int $nodeId): int {
        $stmt=$this->db->prepare('SELECT match_id FROM bracket_nodes WHERE id=:id');$stmt->execute([':id'=>$nodeId]);
        return (int)$stmt->fetchColumn();
    }

    private function connectAdvance(int $bracketId,int $sourceMatch,string $outcome,int $targetMatch,int $slot):void {
        $stmt=$this->db->prepare("INSERT IGNORE INTO bracket_advancements(bracket_id,source_match_id,outcome,target_match_id,target_slot) VALUES(:bracket,:source,:outcome,:target,:slot)");
        $stmt->execute([':bracket'=>$bracketId,':source'=>$sourceMatch,':outcome'=>$outcome,':target'=>$targetMatch,':slot'=>$slot]);
    }

    public function advanceDoubleElimination(int $matchId,int $winnerTeamId,int $loserTeamId):void {
        $node=$this->db->prepare("SELECT b.id bracket_id,b.format,m.stage_name,m.team1_id,m.team2_id FROM bracket_nodes bn JOIN brackets b ON b.id=bn.bracket_id JOIN matches m ON m.id=bn.match_id WHERE bn.match_id=:match LIMIT 1");
        $node->execute([':match'=>$matchId]);$info=$node->fetch();
        if(!$info||$info['format']!=='double_elimination')return;
        if($info['stage_name']==='Grand Final'){
            $reset=$this->db->prepare("SELECT m.id FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id WHERE bn.bracket_id=:bracket AND m.stage_name='Grand Final Reset' LIMIT 1");
            $reset->execute([':bracket'=>$info['bracket_id']]);$resetId=(int)$reset->fetchColumn();
            if($resetId){
                if($winnerTeamId===(int)$info['team2_id'])$this->db->prepare("UPDATE matches SET team1_id=:winner,team2_id=:loser,status='scheduled' WHERE id=:id")->execute([':winner'=>$winnerTeamId,':loser'=>$loserTeamId,':id'=>$resetId]);
                else $this->db->prepare("UPDATE matches SET status='cancelled',winner_team_id=:winner WHERE id=:id")->execute([':winner'=>$winnerTeamId,':id'=>$resetId]);
            }
            return;
        }
        $this->applyMappedOutcome((int)$info['bracket_id'],$matchId,'winner',$winnerTeamId);
        $this->applyMappedOutcome((int)$info['bracket_id'],$matchId,'loser',$loserTeamId);
        $this->resolveAutomaticAdvances((int)$info['bracket_id']);
    }

    private function applyMappedOutcome(int $bracketId,int $sourceMatch,string $outcome,int $teamId):void {
        $stmt=$this->db->prepare('SELECT target_match_id,target_slot FROM bracket_advancements WHERE bracket_id=:bracket AND source_match_id=:source AND outcome=:outcome');
        $stmt->execute([':bracket'=>$bracketId,':source'=>$sourceMatch,':outcome'=>$outcome]);
        foreach($stmt->fetchAll() as $row){$column=(int)$row['target_slot']===1?'team1_id':'team2_id';$this->db->prepare("UPDATE matches SET {$column}=:team WHERE id=:match AND ({$column} IS NULL OR {$column}=:same)")->execute([':team'=>$teamId,':same'=>$teamId,':match'=>(int)$row['target_match_id']]);}
    }

    private function resolveAutomaticAdvances(int $bracketId):void {
        for($pass=0;$pass<40;$pass++){
            $changed=false;
            $stmt=$this->db->prepare("SELECT DISTINCT m.id,m.team1_id,m.team2_id FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id WHERE bn.bracket_id=:bracket AND m.status='scheduled' AND (m.team1_id IS NULL OR m.team2_id IS NULL) AND EXISTS(SELECT 1 FROM bracket_advancements ba WHERE ba.target_match_id=m.id)");
            $stmt->execute([':bracket'=>$bracketId]);
            foreach($stmt->fetchAll() as $match){
                $sources=$this->db->prepare("SELECT COUNT(DISTINCT source_match_id) total,COUNT(DISTINCT CASE WHEN sm.status IN ('completed','cancelled') THEN source_match_id END) finished FROM bracket_advancements ba JOIN matches sm ON sm.id=ba.source_match_id WHERE ba.target_match_id=:target");
                $sources->execute([':target'=>$match['id']]);$state=$sources->fetch();
                if((int)$state['total']===0||(int)$state['finished']!==(int)$state['total'])continue;
                // A previous source processed in this same pass may have just
                // filled the missing slot. Re-read before declaring a bye.
                $fresh=$this->db->prepare('SELECT team1_id,team2_id FROM matches WHERE id=:id');$fresh->execute([':id'=>$match['id']]);$current=$fresh->fetch();
                if($current['team1_id']!==null&&$current['team2_id']!==null)continue;
                $team=(int)($current['team1_id']?:$current['team2_id']);
                $this->db->prepare("UPDATE matches SET status='cancelled',winner_team_id=:winner WHERE id=:id")->execute([':winner'=>$team?:null,':id'=>$match['id']]);
                if($team)$this->applyMappedOutcome($bracketId,(int)$match['id'],'winner',$team);
                $changed=true;
            }
            if(!$changed)break;
        }
    }

    // MatchScoring::finalizeMatch() advances the winner of a match at (round R,
    // position P) into round R+1 at position ceil(P/2) -- team1 if P odd, team2
    // if P even. So each round just needs matches at positions 1..N, and the
    // parent_node pointers (for the bracket view) point at the two prior nodes.
    // Single elimination: proper seeded pairing (1 vs N, 2 vs N-1, ...). Honors
    // the order of $teamIds (BracketController passes seed-ordered when manual,
    // shuffled when automatic). Byes go to the top seeds as nulls.
    public function generateSingleElimination(int $tournamentId, array $teamIds, int $groups = 1): array {
        $totalTeams = count($teamIds);
        $powerOfTwo = 1;
        while ($powerOfTwo < $totalTeams) $powerOfTwo *= 2;
        $byes = $powerOfTwo - $totalTeams;

        // Append byes (nulls) to reach the next power of two.
        for ($i = 0; $i < $byes; $i++) $teamIds[] = null;

        $rounds = (int) log($powerOfTwo, 2);
        $bracketId = $this->createBracket($tournamentId, 'single_elimination', $rounds, $totalTeams);

        $matchCount = 0;
        $prevNodes = [];
        // Mirror pairing: index k plays index (powerOfTwo-1-k).
        for ($i = 0; $i < $powerOfTwo / 2; $i++) {
            $j = $powerOfTwo - 1 - $i;
            $matchCount++;
            $nodeId = $this->seedNode($bracketId, $tournamentId, 1, $matchCount, $matchCount, 'Round 1', $teamIds[$i], $teamIds[$j] ?? null);
            $prevNodes[$matchCount] = $nodeId;
        }

        $round = 2;
        while (count($prevNodes) > 1) {
            $matchCount = 0;
            $nextNodes = [];
            $positions = array_keys($prevNodes);
            for ($i = 0; $i < count($positions); $i += 2) {
                $matchCount++;
                $nodeId = $this->seedNode(
                    $bracketId, $tournamentId, $round, $matchCount, $matchCount,
                    'Round ' . $round, null, null,
                    $prevNodes[$positions[$i]], $prevNodes[$positions[$i + 1]]
                );
                $nextNodes[$matchCount] = $nodeId;
            }
            $prevNodes = $nextNodes;
            $round++;
        }

        // A first-round bye is not a played game and must not count as a win,
        // but its seeded team still needs to enter the next bracket round.
        // Mark the empty pairing as cancelled and carry the lone team forward.
        $byeStmt = $this->db->prepare("SELECT bn.position_in_round,m.id,m.team1_id,m.team2_id
            FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id
            WHERE bn.bracket_id=:bracket AND bn.round=1
              AND ((m.team1_id IS NOT NULL AND m.team2_id IS NULL) OR (m.team1_id IS NULL AND m.team2_id IS NOT NULL))");
        $byeStmt->execute([':bracket'=>$bracketId]);
        $cancelBye = $this->db->prepare("UPDATE matches SET status='cancelled',winner_team_id=:team WHERE id=:match");
        $nextMatch = $this->db->prepare("SELECT m.id FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id
            WHERE bn.bracket_id=:bracket AND bn.round=2 AND bn.position_in_round=:position LIMIT 1");
        foreach ($byeStmt->fetchAll() as $bye) {
            $teamId=(int)($bye['team1_id'] ?: $bye['team2_id']);
            $position=(int)$bye['position_in_round'];
            $cancelBye->execute([':team'=>$teamId,':match'=>(int)$bye['id']]);
            $nextMatch->execute([':bracket'=>$bracketId,':position'=>(int)ceil($position/2)]);
            $nextId=(int)$nextMatch->fetchColumn();
            if($nextId){
                $column=$position%2!==0?'team1_id':'team2_id';
                $this->db->prepare("UPDATE matches SET {$column}=:team WHERE id=:match")
                    ->execute([':team'=>$teamId,':match'=>$nextId]);
            }
        }

        return $this->getBracket($tournamentId);
    }

    // Round-robin: every team plays every other team once (circle method).
    // Odd team counts get a dummy "bye" so fixtures are balanced. Scores feed
    // the standings engine automatically.
    public function generateRoundRobin(int $tournamentId, array $teamIds, int $groups = 1, string $bracketFormat = 'round_robin'): array {
        $totalTeams = count($teamIds);
        $useBye = ($totalTeams % 2) !== 0;
        if ($useBye) {
            $teamIds[] = null; // fixed dummy bye
            $totalTeams++;
        }
        $rounds = $totalTeams - 1;

        $bracketId = $this->createBracket($tournamentId, $bracketFormat, $rounds, count($teamIds) - ($useBye ? 1 : 0));
        shuffle($teamIds);

        $matchCount = 0;
        for ($round = 1; $round <= $rounds; $round++) {
            for ($i = 0; $i < $totalTeams / 2; $i++) {
                $j = $totalTeams - 1 - $i;
                $t1 = $teamIds[$i];
                $t2 = $teamIds[$j];
                if ($t1 === null && $t2 === null) {
                    continue;
                }
                $matchCount++;
                // Skip fixtures that involve the dummy bye team.
                if ($t1 === null || $t2 === null) continue;
                $this->seedNode($bracketId, $tournamentId, $round, $matchCount, $matchCount, 'Round ' . $round, $t1, $t2);
            }
            // Rotate all but the fixed bye (index 0) -- circle method.
            $teamIds = $this->rotateCircle($teamIds);
        }

        return $this->getBracket($tournamentId);
    }

    // Group stage: split teams into `groups` pools, round-robin within each, then
    // seed a single-elimination knockout bracket from the group winners (and
    // best runners-up when there are enough). Winners auto-advance via
    // MatchScore::finalizeMatch() exactly like single elimination.
    public function generateGroupStage(int $tournamentId, array $teamIds, int $groups = 2): array {
        $totalTeams = count($teamIds);
        $groups = max(1, min($groups, $totalTeams));
        $groupSize = intdiv($totalTeams, $groups);
        $extras = $totalTeams % $groups;

        $bracketId = $this->createBracket($tournamentId, 'group_stage', 2, $totalTeams);

        $pods = [];
        $cursor = 0;
        for ($g = 0; $g < $groups; $g++) {
            $size = $groupSize + ($g < $extras ? 1 : 0);
            $pods[] = array_splice($teamIds, 0, $size);
        }

        $matchCount = 0;
        $qualifiers = [];
        foreach ($pods as $gi => $pod) {
            $gn = $groups > 1 ? 'Group ' . chr(65 + $gi) : 'Round Robin';
            $n = count($pod);
            for ($i = 0; $i < $n; $i++) {
                for ($j = $i + 1; $j < $n; $j++) {
                    $matchCount++;
                    $this->seedNode($bracketId, $tournamentId, 1, $matchCount, $matchCount, $gn, $pod[$i], $pod[$j]);
                }
            }
        }

        // Top two teams from every group enter a knockout skeleton. Slots are
        // populated only after all group games are completed.
        $numQual = min($totalTeams,count($pods)*2);
        if ($numQual >= 2) {
            $pow = 1; while ($pow < $numQual) $pow *= 2;
            $koNodes=[];
            for($i=0;$i<$pow/2;$i++){
                $matchCount++;$position=$i+1;
                $koNodes[$position]=$this->seedNode($bracketId,$tournamentId,2,$position,$matchCount,'Knockout · Quarterfinals',null,null);
            }
            $round = 3;
            $current = $koNodes;
            while (count($current) > 1) {
                $next = [];
                $mc = 0;
                for ($i = 0; $i < count($current); $i += 2) {
                    $mc++;
                    $label=count($current)===2?'Knockout · Final':'Knockout · Semifinals';
                    $nodeId = $this->seedNode($bracketId, $tournamentId, $round, $mc, $matchCount, $label, null, null, $current[$i], $current[$i + 1] ?? null);
                    $next[$mc] = $nodeId;
                    $matchCount++;
                }
                $current = $next;
                $round++;
            }
        }

        return $this->getBracket($tournamentId);
    }

    // League = round-robin (everyone plays everyone).
    public function generateLeague(int $tournamentId, array $teamIds, int $groups = 1): array {
        return $this->generateRoundRobin($tournamentId, $teamIds, $groups, 'league');
    }

    public function populateGroupStageKnockout(int $matchId):void {
        $lookup=$this->db->prepare("SELECT b.id bracket_id,b.tournament_id FROM bracket_nodes bn JOIN brackets b ON b.id=bn.bracket_id WHERE bn.match_id=:match AND b.format='group_stage' LIMIT 1");
        $lookup->execute([':match'=>$matchId]);$bracket=$lookup->fetch();if(!$bracket)return;
        $pending=$this->db->prepare("SELECT COUNT(*) FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id WHERE bn.bracket_id=:bracket AND bn.round=1 AND m.status<>'completed'");
        $pending->execute([':bracket'=>$bracket['bracket_id']]);if((int)$pending->fetchColumn()>0)return;
        $first=$this->db->prepare("SELECT m.id,m.team1_id,m.team2_id FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id WHERE bn.bracket_id=:bracket AND bn.round=2 ORDER BY bn.position_in_round");
        $first->execute([':bracket'=>$bracket['bracket_id']]);$knockouts=$first->fetchAll();if(!$knockouts)return;
        if(array_filter($knockouts,fn($m)=>$m['team1_id']!==null||$m['team2_id']!==null))return;
        $groups=$this->db->prepare("SELECT DISTINCT m.stage_name FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id WHERE bn.bracket_id=:bracket AND bn.round=1 ORDER BY m.stage_name");
        $groups->execute([':bracket'=>$bracket['bracket_id']]);$winners=[];$runners=[];
        foreach($groups->fetchAll(PDO::FETCH_COLUMN) as $group){
            $games=$this->db->prepare("SELECT m.team1_id,m.team2_id,ms.team1_score,ms.team2_score FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id JOIN match_scores ms ON ms.match_id=m.id WHERE bn.bracket_id=:bracket AND bn.round=1 AND m.stage_name=:stage");
            $games->execute([':bracket'=>$bracket['bracket_id'],':stage'=>$group]);$table=[];
            foreach($games->fetchAll() as $game){foreach([(int)$game['team1_id'],(int)$game['team2_id']] as $team)$table[$team]??=['wins'=>0,'diff'=>0];$s1=(int)$game['team1_score'];$s2=(int)$game['team2_score'];$table[(int)$game['team1_id']]['diff']+=$s1-$s2;$table[(int)$game['team2_id']]['diff']+=$s2-$s1;if($s1>$s2)$table[(int)$game['team1_id']]['wins']++;else $table[(int)$game['team2_id']]['wins']++;}
            uksort($table,fn($a,$b)=>$table[$b]['wins']<=>$table[$a]['wins']?:$table[$b]['diff']<=>$table[$a]['diff']?:$a<=>$b);$ranked=array_keys($table);if(isset($ranked[0]))$winners[]=(int)$ranked[0];if(isset($ranked[1]))$runners[]=(int)$ranked[1];
        }
        $seeds=array_merge($winners,array_reverse($runners));$slots=count($knockouts)*2;while(count($seeds)<$slots)$seeds[]=null;
        foreach($knockouts as $index=>$game){$opponent=$slots-1-$index;$this->db->prepare('UPDATE matches SET team1_id=:team1,team2_id=:team2 WHERE id=:id')->execute([':team1'=>$seeds[$index]??null,':team2'=>$seeds[$opponent]??null,':id'=>$game['id']]);}
        // Carry qualifier byes into the next knockout round.
        foreach($knockouts as $index=>$game){$fresh=$this->db->prepare('SELECT team1_id,team2_id FROM matches WHERE id=:id');$fresh->execute([':id'=>$game['id']]);$row=$fresh->fetch();if(($row['team1_id']===null)!==($row['team2_id']===null)){$team=(int)($row['team1_id']?:$row['team2_id']);$this->db->prepare("UPDATE matches SET status='cancelled',winner_team_id=:team WHERE id=:id")->execute([':team'=>$team,':id'=>$game['id']]);$position=$index+1;$next=$this->db->prepare('SELECT m.id FROM bracket_nodes bn JOIN matches m ON m.id=bn.match_id WHERE bn.bracket_id=:bracket AND bn.round=3 AND bn.position_in_round=:position LIMIT 1');$next->execute([':bracket'=>$bracket['bracket_id'],':position'=>(int)ceil($position/2)]);$nextId=(int)$next->fetchColumn();if($nextId){$column=$position%2?'team1_id':'team2_id';$this->db->prepare("UPDATE matches SET {$column}=:team WHERE id=:id")->execute([':team'=>$team,':id'=>$nextId]);}}}
    }
    public function generateDoubleElimination(int $tournamentId, array $teamIds, int $groups = 1): array {
        $totalTeams = count($teamIds);
        $powerOfTwo = 1;
        while ($powerOfTwo < $totalTeams) $powerOfTwo *= 2;

        $rounds = (int) log($powerOfTwo, 2);
        $bracketId = $this->createBracket($tournamentId, 'double_elimination', ($rounds*3), $totalTeams);
        $wb=[];$prevNodes=[];
        // Every available team competes in the opening round before structural
        // bracket byes are resolved. For ten teams this creates five real games
        // (1v10, 2v9, 3v8, 4v7, 5v6), instead of showing six teams as opening
        // round auto-advances in a sixteen-slot bracket.
        $openingPairs=[];$left=0;$right=$totalTeams-1;
        while($left<$right){$openingPairs[]=[$teamIds[$left],$teamIds[$right]];$left++;$right--;}
        if($left===$right)$openingPairs[]=[$teamIds[$left],null];
        while(count($openingPairs)<$powerOfTwo/2)$openingPairs[]=[null,null];
        foreach($openingPairs as $index=>$pair) {
            $position=$index+1;$nodeId=$this->seedNode($bracketId,$tournamentId,1,$position,$position,'Winners · Round 1',$pair[0],$pair[1]);
            $prevNodes[$position]=$nodeId;$wb[1][$position]=['node'=>$nodeId,'match'=>$this->matchIdForNode($nodeId)];
        }
        $round = 2;
        while (count($prevNodes) > 1) {
            $nextNodes=[];$positions=array_keys($prevNodes);
            for ($i = 0; $i < count($positions); $i += 2) {
                $position=(int)($i/2)+1;$nodeId=$this->seedNode($bracketId,$tournamentId,$round,$position,$position,'Winners · Round '.$round,null,null,$prevNodes[$positions[$i]],$prevNodes[$positions[$i+1]]);
                $nextNodes[$position]=$nodeId;$wb[$round][$position]=['node'=>$nodeId,'match'=>$this->matchIdForNode($nodeId)];
            }
            $prevNodes=$nextNodes;$round++;
        }

        $lb=[];$loserRounds=($rounds*2)-2;
        for($lr=1;$lr<=$loserRounds;$lr++){
            $pair=(int)ceil($lr/2);$count=(int)($powerOfTwo/(2**($pair+1)));
            for($position=1;$position<=$count;$position++){
                $globalRound=$rounds+$lr;$nodeId=$this->seedNode($bracketId,$tournamentId,$globalRound,$position,$position,'Losers · Round '.$lr,null,null);
                $lb[$lr][$position]=['node'=>$nodeId,'match'=>$this->matchIdForNode($nodeId)];
            }
        }

        for($r=1;$r<$rounds;$r++)foreach($wb[$r] as $position=>$source)$this->connectAdvance($bracketId,$source['match'],'winner',$wb[$r+1][(int)ceil($position/2)]['match'],$position%2?1:2);
        foreach($wb[1] as $position=>$source)$this->connectAdvance($bracketId,$source['match'],'loser',$lb[1][(int)ceil($position/2)]['match'],$position%2?1:2);
        for($r=2;$r<=$rounds;$r++)foreach($wb[$r] as $position=>$source)$this->connectAdvance($bracketId,$source['match'],'loser',$lb[2*($r-1)][$position]['match'],2);
        for($lr=1;$lr<$loserRounds;$lr++)foreach($lb[$lr] as $position=>$source){
            if($lr%2===1)$this->connectAdvance($bracketId,$source['match'],'winner',$lb[$lr+1][$position]['match'],1);
            else $this->connectAdvance($bracketId,$source['match'],'winner',$lb[$lr+1][(int)ceil($position/2)]['match'],$position%2?1:2);
        }

        $grandRound=($rounds*3)-1;$grandNode=$this->seedNode($bracketId,$tournamentId,$grandRound,1,1,'Grand Final',null,null);
        $grandMatch=$this->matchIdForNode($grandNode);
        $this->connectAdvance($bracketId,$wb[$rounds][1]['match'],'winner',$grandMatch,1);
        $this->connectAdvance($bracketId,$lb[$loserRounds][1]['match'],'winner',$grandMatch,2);
        $this->seedNode($bracketId,$tournamentId,$grandRound+1,1,1,'Grand Final Reset',null,null);

        foreach($wb[1] as $source){
            $match=$this->db->prepare('SELECT team1_id,team2_id FROM matches WHERE id=:id');$match->execute([':id'=>$source['match']]);$row=$match->fetch();
            if(($row['team1_id']===null)!==($row['team2_id']===null)){
                $team=(int)($row['team1_id']?:$row['team2_id']);
                $this->db->prepare("UPDATE matches SET status='cancelled',winner_team_id=:winner WHERE id=:id")->execute([':winner'=>$team,':id'=>$source['match']]);
                $this->applyMappedOutcome($bracketId,$source['match'],'winner',$team);
            } elseif($row['team1_id']===null&&$row['team2_id']===null) {
                $this->db->prepare("UPDATE matches SET status='cancelled',winner_team_id=NULL WHERE id=:id")->execute([':id'=>$source['match']]);
            }
        }
        $this->resolveAutomaticAdvances($bracketId);

        return $this->getBracket($tournamentId);
    }

    private function rotateCircle(array $arr): array {
        if (count($arr) <= 1) return $arr;
        $first = $arr[0];
        $rest = array_slice($arr, 1);
        $last = array_pop($rest);
        array_unshift($rest, $last);
        return array_merge([$first], $rest);
    }

    public function getBracket(int $tournamentId): array {
        $stmt = $this->db->prepare("SELECT * FROM brackets WHERE tournament_id = :tid LIMIT 1");
        $stmt->execute([':tid' => $tournamentId]);
        $bracket = $stmt->fetch();

        if (!$bracket) return [];

        $mStmt = $this->db->prepare("
            SELECT m.*, t1.team_name as team1_name, t2.team_name as team2_name, w.team_name as winner_name,
                   ms.team1_score, ms.team2_score, ms.current_period, c.court_name
            FROM bracket_nodes bn
            JOIN matches m ON m.id = bn.match_id
            LEFT JOIN teams t1 ON m.team1_id = t1.id
            LEFT JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN teams w ON m.winner_team_id = w.id
            LEFT JOIN match_scores ms ON m.id = ms.match_id
            LEFT JOIN courts c ON m.court_id = c.id
            WHERE bn.bracket_id = :bid
            ORDER BY m.round_number ASC, m.match_number ASC
        ");
        $mStmt->execute([':bid' => $bracket['id']]);
        $matches = $mStmt->fetchAll();

        return [
            'bracket' => $bracket,
            'matches' => $matches
        ];
    }
}

<?php
// backend/models/Bracket.php

require_once __DIR__ . '/../config/database.php';

class Bracket {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
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
        $existing = $this->db->prepare("SELECT m.id,m.status FROM brackets b JOIN bracket_nodes n ON n.bracket_id=b.id JOIN matches m ON m.id=n.match_id WHERE b.tournament_id=:tid");
        $existing->execute([':tid'=>$tournamentId]);
        $oldMatches = $existing->fetchAll();
        if (array_filter($oldMatches, static fn(array $m): bool => $m['status'] === 'completed')) {
            throw new Exception('A bracket with completed games cannot be regenerated.');
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

        return $this->getBracket($tournamentId);
    }

    // Round-robin: every team plays every other team once (circle method).
    // Odd team counts get a dummy "bye" so fixtures are balanced. Scores feed
    // the standings engine automatically.
    public function generateRoundRobin(int $tournamentId, array $teamIds, int $groups = 1): array {
        $totalTeams = count($teamIds);
        $useBye = ($totalTeams % 2) !== 0;
        if ($useBye) {
            $teamIds[] = null; // fixed dummy bye
            $totalTeams++;
        }
        $rounds = $totalTeams - 1;

        $bracketId = $this->createBracket($tournamentId, 'round_robin', $rounds, count($teamIds) - ($useBye ? 1 : 0));
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

        // Knockouts seeded from each group winner (mirrors single-elim pairing).
        $wb = $qualifiers; // filled by finalizeMatch as group winners advance; but to seed a KO
        // bracket we need placeholder nodes whose slots get filled on group completion.
        // We create the knockout skeleton; MatchScore::finalizeMatch fills team slots.
        $numQual = count($pods);
        if ($numQual >= 2) {
            $pow = 1; while ($pow < $numQual) $pow *= 2;
            $koNodes = [];
            for ($i = 0; $i < $pow; $i++) {
                if ($i < $numQual) {
                    $matchCount++;
                    $koNodes[$i] = $this->seedNode($bracketId, $tournamentId, 2, $i + 1, $matchCount, 'Knockout Round ' . ($i + 1), null, null);
                } else {
                    $matchCount++;
                    $koNodes[$i] = $this->seedNode($bracketId, $tournamentId, 2, $i + 1, $matchCount, 'Knockout Round ' . ($i + 1), null, null);
                }
            }
            // Pair winners of round 1 (group winners) against each other progressively.
            $round = 3;
            $current = $koNodes;
            while (count($current) > 1) {
                $next = [];
                $mc = 0;
                for ($i = 0; $i < count($current); $i += 2) {
                    $mc++;
                    $nodeId = $this->seedNode($bracketId, $tournamentId, $round, $mc, $matchCount, 'Knockout Round ' . ($mc + $numQual), null, null, $current[$i], $current[$i + 1] ?? null);
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
        return $this->generateRoundRobin($tournamentId, $teamIds, $groups);
    }
    public function generateDoubleElimination(int $tournamentId, array $teamIds, int $groups = 1): array {
        $totalTeams = count($teamIds);
        $powerOfTwo = 1;
        while ($powerOfTwo < $totalTeams) $powerOfTwo *= 2;
        $byes = $powerOfTwo - $totalTeams;

        for ($i = 0; $i < $byes; $i++) $teamIds[] = null;

        $rounds = (int) log($powerOfTwo, 2);
        $bracketId = $this->createBracket($tournamentId, 'double_elimination', $rounds, $totalTeams);

        // Winners bracket (proper seeded pairing). Losers bracket is advanced by
        // MatchScore::finalizeMatch() once winners-bracket results land.
        $matchCount = 0;
        $prevNodes = [];
        for ($i = 0; $i < $powerOfTwo / 2; $i++) {
            $j = $powerOfTwo - 1 - $i;
            $matchCount++;
            $nodeId = $this->seedNode($bracketId, $tournamentId, 1, $matchCount, $matchCount, 'WB Round 1', $teamIds[$i], $teamIds[$j] ?? null);
            $prevNodes[$matchCount] = $nodeId;
        }

        $round = 2;
        while (count($prevNodes) > 1) {
            $matchCount = 0;
            $nextNodes = [];
            $positions = array_keys($prevNodes);
            for ($i = 0; $i < count($positions); $i += 2) {
                $matchCount++;
                $nodeId = $this->seedNode($bracketId, $tournamentId, $round, $matchCount, $matchCount, 'WB Round ' . $round, null, null, $prevNodes[$positions[$i]], $prevNodes[$positions[$i + 1]]);
                $nextNodes[$matchCount] = $nodeId;
            }
            $prevNodes = $nextNodes;
            $round++;
        }

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

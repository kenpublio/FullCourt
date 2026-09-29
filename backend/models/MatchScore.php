<?php
// backend/models/MatchScore.php

require_once __DIR__ . '/../config/database.php';

class MatchScore {
    private PDO $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    public function getScore(int $matchId): ?array {
        $sql = "SELECT ms.*, m.tournament_id, m.team1_id, m.team2_id, m.winner_team_id, m.status as match_status,
                t1.team_name as team1_name, t2.team_name as team2_name
                FROM match_scores ms
                JOIN matches m ON ms.match_id = m.id
                LEFT JOIN teams t1 ON m.team1_id = t1.id
                LEFT JOIN teams t2 ON m.team2_id = t2.id
                WHERE ms.match_id = :mid LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':mid' => $matchId]);
        $res = $stmt->fetch();
        return $res ?: null;
    }

    public function updateScore(int $matchId, int $team1Score, int $team2Score, string $currentPeriod, int $timerSeconds, bool $isTimerRunning): bool {
        $sql = "UPDATE match_scores 
                SET team1_score = :s1, team2_score = :s2, current_period = :cp, timer_seconds = :ts, is_timer_running = :tr
                WHERE match_id = :mid";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':s1' => $team1Score,
            ':s2' => $team2Score,
            ':cp' => $currentPeriod,
            ':ts' => $timerSeconds,
            ':tr' => $isTimerRunning ? 1 : 0,
            ':mid' => $matchId
        ]);

        // Also update match status to in_progress if scheduled
        $mStmt = $this->db->prepare("UPDATE matches SET status = 'in_progress', actual_start_time = COALESCE(actual_start_time, NOW()) WHERE id = :mid AND status = 'scheduled'");
        $mStmt->execute([':mid' => $matchId]);

        return true;
    }

    public function finalizeMatch(int $matchId, int $winnerTeamId, int $team1Score, int $team2Score, string $currentPeriod, int $timerSeconds, int $expectedTeam1Score, int $expectedTeam2Score): bool {
        if ($team1Score === $team2Score) {
            throw new InvalidArgumentException('The final score is tied. Update the score or record overtime before confirming a winner.');
        }
        if (!in_array($currentPeriod, ['Q1','Q2','Q3','Q4','OT1','OT2','OT3','OT4','OT5'], true) || $timerSeconds < 0 || $timerSeconds > 3599) {
            throw new InvalidArgumentException('The game period or remaining time is invalid.');
        }

        $this->db->beginTransaction();
        try {
            $matchStmt = $this->db->prepare("SELECT tournament_id,team1_id,team2_id,status FROM matches WHERE id=:mid FOR UPDATE");
            $matchStmt->execute([':mid' => $matchId]);
            $match = $matchStmt->fetch();
            if (!$match) throw new InvalidArgumentException('Game not found.');
            if (in_array($match['status'], ['completed','cancelled'], true)) throw new InvalidArgumentException('This game is already closed.');
            if (!in_array($winnerTeamId, [(int)$match['team1_id'], (int)$match['team2_id']], true)) throw new InvalidArgumentException('The selected winner is not one of the teams in this game.');
            $scoreWinner = $team1Score > $team2Score ? (int)$match['team1_id'] : (int)$match['team2_id'];
            if ($winnerTeamId !== $scoreWinner) throw new InvalidArgumentException('The selected winner does not match the final score.');

            $currentScoreStmt = $this->db->prepare("SELECT team1_score,team2_score FROM match_scores WHERE match_id=:mid FOR UPDATE");
            $currentScoreStmt->execute([':mid'=>$matchId]);
            $currentScore = $currentScoreStmt->fetch();
            if (!$currentScore) throw new InvalidArgumentException('Scoreboard is not ready for this game.');
            if ((int)$currentScore['team1_score'] !== $expectedTeam1Score || (int)$currentScore['team2_score'] !== $expectedTeam2Score) {
                throw new InvalidArgumentException('The live score changed after you opened the review. Refresh this game and confirm the updated score.');
            }

            $scoreStmt = $this->db->prepare("UPDATE match_scores SET team1_score=:s1,team2_score=:s2,current_period=:period,timer_seconds=:seconds,is_timer_running=0 WHERE match_id=:mid");
            $scoreStmt->execute([':s1'=>$team1Score,':s2'=>$team2Score,':period'=>$currentPeriod,':seconds'=>$timerSeconds,':mid'=>$matchId]);

            $end = $this->db->prepare("UPDATE matches SET status='completed',winner_team_id=:winner,actual_end_time=NOW(),actual_start_time=COALESCE(actual_start_time,NOW()) WHERE id=:mid");
            $end->execute([':winner'=>$winnerTeamId,':mid'=>$matchId]);

            // Advance the confirmed winner to its next bracket slot.
            $nodeStmt = $this->db->prepare("SELECT * FROM bracket_nodes WHERE match_id=:mid LIMIT 1");
            $nodeStmt->execute([':mid'=>$matchId]);
            $currentNode = $nodeStmt->fetch();
            if ($currentNode) {
                $nextRound = $currentNode['round'] + 1;
                $nextPos = (int) ceil($currentNode['position_in_round'] / 2);
                $nextMatchStmt = $this->db->prepare("SELECT m.id FROM bracket_nodes bn JOIN matches m ON bn.match_id=m.id WHERE bn.bracket_id=:bid AND bn.round=:round AND bn.position_in_round=:position LIMIT 1");
                $nextMatchStmt->execute([':bid'=>$currentNode['bracket_id'],':round'=>$nextRound,':position'=>$nextPos]);
                $nextMatchId = $nextMatchStmt->fetchColumn();
                if ($nextMatchId) {
                    $column = ((int)$currentNode['position_in_round'] % 2 !== 0) ? 'team1_id' : 'team2_id';
                    $advance = $this->db->prepare("UPDATE matches SET {$column}=:winner WHERE id=:next_match");
                    $advance->execute([':winner'=>$winnerTeamId,':next_match'=>$nextMatchId]);
                }
            }

            $this->recomputeStandings((int)$match['tournament_id']);
            $this->db->commit();
            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $e;
        }
    }

    // Rebuild the standings for a tournament from every completed match that
    // has a final score. This is what populates the leaderboard, public
    // rankings, and medal tally (previously never written, so always empty).
    public function recomputeStandings(int $tournamentId): void {
        if (!$tournamentId) return;

        $del = $this->db->prepare("DELETE FROM standings WHERE tournament_id = :tid");
        $del->execute([':tid' => $tournamentId]);

        $stmt = $this->db->prepare("
            SELECT m.team1_id, m.team2_id, m.status, ms.team1_score, ms.team2_score
            FROM matches m
            LEFT JOIN match_scores ms ON ms.match_id = m.id
            WHERE m.tournament_id = :tid AND m.status = 'completed'
              AND m.team1_id IS NOT NULL AND m.team2_id IS NOT NULL
        ");
        $stmt->execute([':tid' => $tournamentId]);
        $matches = $stmt->fetchAll();

        $acc = []; // team_id => [played, won, lost, drawn, scored, against]

        foreach ($matches as $m) {
            $t1 = (int)$m['team1_id'];
            $t2 = (int)$m['team2_id'];
            $s1 = (int)($m['team1_score'] ?? 0);
            $s2 = (int)($m['team2_score'] ?? 0);
            foreach ([$t1, $t2] as $t) {
                if (!isset($acc[$t])) $acc[$t] = ['p'=>0,'w'=>0,'l'=>0,'d'=>0,'ps'=>0,'pa'=>0];
            }
            $acc[$t1]['p']++; $acc[$t2]['p']++;
            $acc[$t1]['ps'] += $s1; $acc[$t1]['pa'] += $s2;
            $acc[$t2]['ps'] += $s2; $acc[$t2]['pa'] += $s1;
            if ($s1 === $s2) {
                $acc[$t1]['d']++; $acc[$t2]['d']++;
            } elseif ($s1 > $s2) {
                $acc[$t1]['w']++; $acc[$t2]['l']++;
            } else {
                $acc[$t2]['w']++; $acc[$t1]['l']++;
            }
        }

        if (!$acc) return;

        // Build + sort by tournament points, then net points, then team id.
        $rows = [];
        foreach ($acc as $teamId => $s) {
            $net = $s['ps'] - $s['pa'];
            $tp = ($s['w'] * 3) + $s['d'];
            $rows[] = [
                'team_id' => $teamId,
                'played' => $s['p'],
                'won' => $s['w'],
                'lost' => $s['l'],
                'drawn' => $s['d'],
                'points_scored' => $s['ps'],
                'points_against' => $s['pa'],
                'net_points' => $net,
                'tournament_points' => $tp,
            ];
        }
        usort($rows, function ($a, $b) {
            if ($b['tournament_points'] !== $a['tournament_points']) return $b['tournament_points'] <=> $a['tournament_points'];
            if ($b['net_points'] !== $a['net_points']) return $b['net_points'] <=> $a['net_points'];
            return $a['team_id'] <=> $b['team_id'];
        });

        $ins = $this->db->prepare("
            INSERT INTO standings (tournament_id, team_id, played, won, lost, drawn,
                                   points_scored, points_against, net_points, tournament_points, rank_position)
            VALUES (:tid, :team, :p, :w, :l, :d, :ps, :pa, :net, :tp, :rank)
        ");
        $rank = 1;
        foreach ($rows as $r) {
            $ins->execute([
                ':tid' => $tournamentId,
                ':team' => $r['team_id'],
                ':p' => $r['played'],
                ':w' => $r['won'],
                ':l' => $r['lost'],
                ':d' => $r['drawn'],
                ':ps' => $r['points_scored'],
                ':pa' => $r['points_against'],
                ':net' => $r['net_points'],
                ':tp' => $r['tournament_points'],
                ':rank' => $rank++,
            ]);
        }
    }
}

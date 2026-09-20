<?php
// backend/models/Schedule.php

require_once __DIR__ . '/../config/database.php';

class Schedule {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function publish(int $tournamentId): int {
        $stmt=$this->db->prepare("UPDATE matches SET schedule_status='published' WHERE tournament_id=:tournament_id AND scheduled_start_time IS NOT NULL AND court_id IS NOT NULL");
        $stmt->execute([':tournament_id'=>$tournamentId]);
        $this->db->prepare("UPDATE tournaments SET is_published=1 WHERE id=:id")->execute([':id'=>$tournamentId]);
        $notify=$this->db->prepare("INSERT INTO notifications (user_id,notification_type,title,message,action_url)
            SELECT DISTINCT tp.user_id,'schedule_publication','Basketball schedule published',CONCAT(t.name,' schedule is now available.'),'/schedules'
            FROM teams tm JOIN team_players tp ON tp.team_id=tm.id AND tp.user_id IS NOT NULL JOIN tournaments t ON t.id=tm.tournament_id
            WHERE tm.tournament_id=:tournament_id");
        $notify->execute([':tournament_id'=>$tournamentId]);
        return $stmt->rowCount();
    }

    private function tournamentInfo(int $tournamentId): ?array {
        $stmt = $this->db->prepare("
            SELECT t.start_date, t.end_date, t.format, t.seeding_type,
                   s.default_match_duration_mins AS duration_mins
            FROM tournaments t
            JOIN sports s ON t.sport_id = s.id
            WHERE t.id = :tid LIMIT 1
        ");
        $stmt->execute([':tid' => $tournamentId]);
        return $stmt->fetch() ?: null;
    }

    private function constraints(int $tournamentId): ?array {
        $stmt = $this->db->prepare("SELECT max_games_per_team_per_day, min_rest_minutes_between_games, default_match_duration_minutes, default_break_minutes FROM schedule_constraints WHERE tournament_id = :tid LIMIT 1");
        $stmt->execute([':tid' => $tournamentId]);
        $c = $stmt->fetch();
        if (!$c) return null;
        return [
            'max_games_per_team_per_day' => (int)$c['max_games_per_team_per_day'],
            'min_rest_minutes_between_games' => (int)$c['min_rest_minutes_between_games'],
            'duration_mins' => (int)$c['default_match_duration_minutes'],
            'break_mins' => (int)$c['default_break_minutes'],
        ];
    }

    // All courts with their venue + unavailable dates for the tournament window.
    private function availableCourts(int $tournamentId): array {
        $stmt = $this->db->prepare("
            SELECT c.id AS court_id, c.court_name, v.id AS venue_id, v.name AS venue_name,
                   s.default_match_duration_mins AS duration_mins
            FROM courts c
            JOIN venues v ON c.venue_id = v.id
            JOIN tournaments t ON t.id = :tid
            JOIN sports s ON t.sport_id = s.id
            WHERE c.is_available = 1 AND v.approval_status='approved'
            ORDER BY c.id ASC
        ");
        $stmt->execute([':tid' => $tournamentId]);
        $courts = $stmt->fetchAll();

        $unavail = [];
        foreach ($courts as &$court) {
            $u = $this->db->prepare("SELECT unavailable_date FROM venue_availability WHERE venue_id = :vid");
            $u->execute([':vid' => $court['venue_id']]);
            $court['unavailable_dates'] = array_column($u->fetchAll(), 'unavailable_date');
        }
        unset($court);
        return $courts;
    }

    private function isVenueOpen($venueDates, string $d): bool {
        return !in_array($d, $venueDates ?? [], true);
    }

    private function teamGamesToday(int $tournamentId, int $teamId, string $day): int {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM matches
            WHERE tournament_id = :tid AND (team1_id = :tid2 OR team2_id = :tid2)
              AND DATE(scheduled_start_time) = :day AND status IN ('scheduled','in_progress','completed')
        ");
        $stmt->execute([':tid' => $tournamentId, ':tid2' => $teamId, ':day' => $day]);
        return (int)$stmt->fetchColumn();
    }

    // Enhanced conflict-aware scheduler. Respects schedule_constraints, venue
    // availability, tournament window, team rest + max-games-per-day, court clashes.
    public function autoSchedule(int $tournamentId, string $startDate, string $startTimeStr = '08:00:00'): array {
        $tinfo = $this->tournamentInfo($tournamentId);
        if (!$tinfo) throw new Exception("Tournament not found.");

        $c = $this->constraints($tournamentId);
        if (!$c) {
            // Ensure a constraints row exists with sensible defaults.
            $duration = (int)($tinfo['duration_mins'] ?? 40);
            $c = ['max_games_per_team_per_day' => 2, 'min_rest_minutes_between_games' => 120, 'duration_mins' => $duration, 'break_mins' => 15];
            $this->db->prepare("INSERT INTO schedule_constraints (tournament_id, max_games_per_team_per_day, min_rest_minutes_between_games, default_match_duration_minutes, default_break_minutes) VALUES (:tid, 2, 120, :dur, 15) ON CONFLICT (tournament_id) DO NOTHING")
                ->execute([':tid' => $tournamentId, ':dur' => $duration]);
        }

        $courts = $this->availableCourts($tournamentId);
        if (empty($courts)) throw new Exception("No available courts configured in venue system.");

        $start = new DateTime($startDate . ' ' . $startTimeStr);
        if ($start < new DateTime($tinfo['start_date'])) $start = new DateTime($tinfo['start_date'] . ' 00:00:00');
        $endTournament = new DateTime($tinfo['end_date'] . ' 23:59:59');

        // Matches to schedule, ordered by round (knockouts must keep seeding order; RR can reshuffle but we keep order).
        // Later knockout rounds do not have teams until earlier winners advance.
        // Schedule only playable fixtures; the next round can be scheduled after
        // both winner slots have been filled.
        $stmt = $this->db->prepare("SELECT id, round_number, team1_id, team2_id FROM matches WHERE tournament_id = :tid AND status = 'scheduled' AND team1_id IS NOT NULL AND team2_id IS NOT NULL AND scheduled_start_time IS NULL ORDER BY round_number ASC, id ASC");
        $stmt->execute([':tid' => $tournamentId]);
        $pending = $stmt->fetchAll();

        $durationSec = (int)$c['duration_mins'] * 60;
        $advanceSec = ($c['duration_mins'] + $c['break_mins']) * 60;
        $minRestSec = (int)$c['min_rest_minutes_between_games'] * 60;
        $maxPerDay = (int)$c['max_games_per_team_per_day'];

        $scheduled = 0;
        $conflicts = [];
        $cursor = clone $start;

        foreach ($pending as $m) {
            $placed = false;
            // Try each candidate slot in break-step increments across the tournament window.
            $candidate = clone $cursor;
            $attempts = 0;
            while ($candidate <= $endTournament && $attempts < 20000) {
                $slotStart = clone $candidate;
                $slotEnd = (clone $slotStart)->modify("+{$c['duration_mins']} minutes");
                $day = $slotStart->format('Y-m-d');

                foreach ($courts as $court) {
                    // Venue unavailable on this date?
                    if (!$this->isVenueOpen($court['unavailable_dates'], $day)) continue;
                    // Court busy?
                    if ($this->rangeOverlaps($court['court_id'], $slotStart, $slotEnd, 'court')) continue;
                    // Teams free & rest respected & max-games-per-day?
                    if (!$this->teamsAvailableAt($m['team1_id'], $m['team2_id'], $slotStart, $slotEnd, $minRestSec, $maxPerDay, $tournamentId, $day)) continue;

                    $this->db->prepare("UPDATE matches SET court_id = :court, scheduled_start_time = :s, scheduled_end_time = :e WHERE id = :mid")
                        ->execute([
                            ':court' => $court['court_id'],
                            ':s' => $slotStart->format('Y-m-d H:i:s'),
                            ':e' => $slotEnd->format('Y-m-d H:i:s'),
                            ':mid' => $m['id'],
                        ]);
                    $scheduled++;
                    $placed = true;
                    // Advance cursor to right after this match (staggered per court handled by next iteration).
                    $cursor = (clone $slotEnd)->modify("+{$c['break_mins']} minutes");
                    break 2;
                }
                $candidate->modify("+{$c['break_mins']} minutes");
                $attempts++;
            }

            if (!$placed) {
                $conflicts[] = ['match_id' => $m['id'], 'round_number' => $m['round_number'], 'reason' => 'No feasible slot within tournament window / venue constraints / team rest'];
            }
        }

        // Refresh constraints row with applied values.
        return ['scheduled_matches' => $scheduled, 'conflicts' => $conflicts, 'constraints' => $c];
    }

    private function rangeOverlaps(int $id, DateTime $start, DateTime $end, string $kind): bool {
        // Live DB lookup of intervals for this court/team (excludes this match via caller).
        if ($kind === 'court') {
            $r = $this->db->prepare("SELECT scheduled_start_time, scheduled_end_time FROM matches WHERE court_id = :cid AND status IN ('scheduled','in_progress') AND scheduled_start_time IS NOT NULL");
            $r->execute([':cid' => $id]);
        } else {
            $r = $this->db->prepare("SELECT scheduled_start_time, scheduled_end_time FROM matches WHERE (team1_id = :tid OR team2_id = :tid) AND status IN ('scheduled','in_progress') AND scheduled_start_time IS NOT NULL");
            $r->execute([':tid' => $id]);
        }
        $sTs = $start->getTimestamp();
        $eTs = $end->getTimestamp();
        foreach ($r as $row) {
            $a = strtotime($row['scheduled_start_time']);
            $b = strtotime($row['scheduled_end_time']);
            if (!$a || !$b) continue;
            // Half-open overlap: [a,b) vs [sTs,eTs)
            if ($a < $eTs && $sTs < $b) return true;
        }
        return false;
    }

    // Check both teams are free and rest/min/max constraints satisfied.
    private function teamsAvailableAt($t1, $t2, DateTime $start, DateTime $end, int $minRestSec, int $maxPerDay, int $tournamentId, string $day): bool {
        $sTs = $start->getTimestamp();
        $eTs = $end->getTimestamp();
        foreach ([$t1, $t2] as $tid) {
            if (!$tid) return false;
            if ($this->rangeOverlaps((int)$tid, $start, $end, 'team')) return false;
            // Rest from any prior match of this team at/after start of day.
            $rest = $this->db->prepare("SELECT scheduled_end_time FROM matches WHERE (team1_id = :tid OR team2_id = :tid) AND tournament_id = :tid2 AND scheduled_end_time <= :now AND status IN ('scheduled','in_progress','completed') ORDER BY scheduled_end_time DESC LIMIT 1");
            $rest->execute([':tid' => $tid, ':tid2' => $tournamentId, ':now' => $start->format('Y-m-d H:i:s')]);
            $lastEnd = $rest->fetchColumn();
            if ($lastEnd) {
                $gap = $sTs - strtotime($lastEnd);
                if ($gap < $minRestSec) return false;
            }
            if ($this->teamGamesToday($tournamentId, (int)$tid, $day) >= $maxPerDay) return false;
        }
        return true;
    }

    public function getMasterSchedule(int $tournamentId): array {
        $stmt = $this->db->prepare("
            SELECT m.*, t1.team_name as team1_name, t2.team_name as team2_name, w.team_name as winner_name,
                   c.court_name, v.name as venue_name, s.name as sport_name,
                   ms.team1_score, ms.team2_score
            FROM matches m
            LEFT JOIN teams t1 ON m.team1_id = t1.id
            LEFT JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN teams w ON m.winner_team_id = w.id
            LEFT JOIN courts c ON m.court_id = c.id
            LEFT JOIN venues v ON c.venue_id = v.id
            LEFT JOIN tournaments t ON m.tournament_id = t.id
            LEFT JOIN sports s ON t.sport_id = s.id
            LEFT JOIN match_scores ms ON ms.match_id = m.id
            WHERE m.tournament_id = :tid
            ORDER BY m.scheduled_start_time ASC, m.round_number ASC, m.id ASC
        ");
        $stmt->execute([':tid' => $tournamentId]);
        return $stmt->fetchAll();
    }

    // Conflict detection: returns court clashes, team clashes, and venue-unavailability violations.
    public function detectConflicts(int $tournamentId): array {
        $matches = $this->getMasterSchedule($tournamentId);
        $courtClashes = [];
        $teamClashes = [];
        $venueViolations = [];
        $byCourt = [];
        $byTeam = [];

        foreach ($matches as $m) {
            if (!$m['scheduled_start_time']) continue;
            $s = strtotime($m['scheduled_start_time']);
            $e = strtotime($m['scheduled_end_time']);
            if (!$s || !$e) continue;

            // Venue availability check
            $vid = $this->db->prepare("SELECT venue_id FROM courts WHERE id = :cid");
            $vid->execute([':cid' => $m['court_id']]);
            $venueId = $vid->fetchColumn();
            if ($venueId) {
                $u = $this->db->prepare("SELECT 1 FROM venue_availability WHERE venue_id = :vid AND unavailable_date = :day LIMIT 1");
                $u->execute([':vid' => $venueId, ':day' => date('Y-m-d', $s)]);
                if ($u->fetchColumn()) {
                    $venueViolations[] = ['match_id' => $m['id'], 'venue_id' => $venueId, 'date' => date('Y-m-d', $s)];
                }
            }

            // Court clash (excluding self) — matches already grouped by court as we iterate.
            if ($m['court_id']) {
                foreach (($byCourt[$m['court_id']] ?? []) as $other) {
                    $os = strtotime($other['scheduled_start_time']);
                    $oe = strtotime($other['scheduled_end_time']);
                    if ($os < $e && $s < $oe) {
                        $courtClashes[] = ['match_ids' => [$m['id'], $other['id']], 'court_id' => $m['court_id']];
                    }
                }
                $byCourt[$m['court_id']][] = $m;
            }

            foreach ([$m['team1_id'], $m['team2_id']] as $tid) {
                if (!$tid) continue;
                foreach (($byTeam[$tid] ?? []) as $other) {
                    $os = strtotime($other['scheduled_start_time']);
                    $oe = strtotime($other['scheduled_end_time']);
                    if ($os < $e && $s < $oe) {
                        $teamClashes[] = ['match_ids' => [$m['id'], $other['id']], 'team_id' => $tid, 'overlap_minutes' => max(0, (min($e, $oe) - max($s, $os)) / 60)];
                    }
                }
                $byTeam[$tid][] = $m;
            }
        }

        return ['court_clashes' => $courtClashes, 'team_clashes' => $teamClashes, 'venue_violations' => $venueViolations];
    }

    // Reschedule a single match (drag/time edit). Rejects completed/postponed matches.
    public function updateMatchSlot(int $matchId, string $start, ?int $courtId): array {
        $stmt = $this->db->prepare("SELECT id, tournament_id, court_id, scheduled_start_time, scheduled_end_time, status FROM matches WHERE id = :mid LIMIT 1");
        $stmt->execute([':mid' => $matchId]);
        $m = $stmt->fetch();
        if (!$m) throw new Exception("Match not found.");
        if (in_array($m['status'], ['completed', 'cancelled'])) throw new Exception("Cannot reschedule a completed/cancelled match.");

        $startDt = new DateTime($start);
        $tinfo = $this->tournamentInfo((int)$m['tournament_id']);
        $c = $this->constraints((int)$m['tournament_id']) ?: ['duration_mins' => (int)($tinfo['duration_mins'] ?? 40), 'min_rest_minutes_between_games' => 120, 'max_games_per_team_per_day' => 2, 'break_mins' => 15];
        $endDt = (clone $startDt)->modify("+{$c['duration_mins']} minutes");
        $day = $startDt->format('Y-m-d');
        $sTs = $startDt->getTimestamp();
        $eTs = $endDt->getTimestamp();

        $conflicts = [];

        // Court clash (excluding self)
        if ($courtId) {
            $r = $this->db->prepare("SELECT id, scheduled_start_time, scheduled_end_time FROM matches WHERE court_id = :cid AND id != :mid AND status IN ('scheduled','in_progress') AND scheduled_start_time IS NOT NULL");
            $r->execute([':cid' => $courtId, ':mid' => $matchId]);
            foreach ($r as $row) {
                $a = strtotime($row['scheduled_start_time']); $b = strtotime($row['scheduled_end_time']);
                if ($a && $b && $a < $eTs && $sTs < $b) $conflicts[] = ['type' => 'court', 'match_id' => (int)$row['id']];
            }
            // Venue unavailability
            $vstmt = $this->db->prepare("SELECT venue_id FROM courts WHERE id = :cid");
            $vstmt->execute([':cid' => $courtId]);
            $venueId = $vstmt->fetchColumn();
            if ($venueId) {
                $u = $this->db->prepare("SELECT 1 FROM venue_availability WHERE venue_id = :vid AND unavailable_date = :day LIMIT 1");
                $u->execute([':vid' => $venueId, ':day' => $day]);
                if ($u->fetchColumn()) $conflicts[] = ['type' => 'venue_unavailable', 'date' => $day];
            }
        }

        // Team clash + rest + max-games-per-day
        $ms = $this->db->prepare("SELECT team1_id, team2_id FROM matches WHERE id = :mid");
        $ms->execute([':mid' => $matchId]);
        $mrow = $ms->fetch();
        foreach ([$mrow['team1_id'], $mrow['team2_id']] as $tid) {
            if (!$tid) continue;
            $tr = $this->db->prepare("SELECT scheduled_start_time, scheduled_end_time FROM matches WHERE (team1_id = :tid OR team2_id = :tid) AND id != :mid AND status IN ('scheduled','in_progress','completed') AND scheduled_start_time IS NOT NULL");
            $tr->execute([':tid' => $tid, ':mid' => $matchId]);
            foreach ($tr as $row) {
                $a = strtotime($row['scheduled_start_time']); $b = strtotime($row['scheduled_end_time']);
                if ($a && $b && $a < $eTs && $sTs < $b) $conflicts[] = ['type' => 'team', 'match_id' => (int)$row['id'], 'team_id' => (int)$tid];
            }
            // Rest: most recent match ending before the new start
            $rest = $this->db->prepare("SELECT scheduled_end_time FROM matches WHERE (team1_id = :tid OR team2_id = :tid) AND id != :mid AND scheduled_end_time <= :now ORDER BY scheduled_end_time DESC LIMIT 1");
            $rest->execute([':tid' => $tid, ':mid' => $matchId, ':now' => $startDt->format('Y-m-d H:i:s')]);
            $lastEnd = $rest->fetchColumn();
            if ($lastEnd && ($sTs - strtotime($lastEnd)) < (int)$c['min_rest_minutes_between_games'] * 60) {
                $conflicts[] = ['type' => 'rest', 'team_id' => (int)$tid];
            }
            if ($this->teamGamesToday((int)$m['tournament_id'], (int)$tid, $day) >= (int)$c['max_games_per_team_per_day']) {
                $conflicts[] = ['type' => 'max_games_per_day', 'team_id' => (int)$tid];
            }
        }

        if ($conflicts) return ['scheduled' => false, 'conflicts' => $conflicts];

        $this->db->prepare("UPDATE matches SET court_id = :court, scheduled_start_time = :s, scheduled_end_time = :e WHERE id = :mid")
            ->execute([':court' => $courtId, ':s' => $startDt->format('Y-m-d H:i:s'), ':e' => $endDt->format('Y-m-d H:i:s'), ':mid' => $matchId]);

        return ['scheduled' => true, 'start' => $startDt->format('Y-m-d H:i:s'), 'end' => $endDt->format('Y-m-d H:i:s')];
    }

    public function saveConstraints(int $tournamentId, array $c): bool {
        $stmt = $this->db->prepare("
            INSERT INTO schedule_constraints (tournament_id, max_games_per_team_per_day, min_rest_minutes_between_games, default_match_duration_minutes, default_break_minutes)
            VALUES (:tid, :m, :r, :d, :b)
            ON CONFLICT (tournament_id) DO UPDATE SET
                max_games_per_team_per_day = EXCLUDED.max_games_per_team_per_day,
                min_rest_minutes_between_games = EXCLUDED.min_rest_minutes_between_games,
                default_match_duration_minutes = EXCLUDED.default_match_duration_minutes,
                default_break_minutes = EXCLUDED.default_break_minutes
        ");
        return $stmt->execute([
            ':tid' => $tournamentId,
            ':m' => (int)$c['max_games_per_team_per_day'],
            ':r' => (int)$c['min_rest_minutes_between_games'],
            ':d' => (int)$c['default_match_duration_minutes'],
            ':b' => (int)$c['default_break_minutes'],
        ]);
    }
}

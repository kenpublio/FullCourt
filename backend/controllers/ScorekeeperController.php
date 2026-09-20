<?php
// backend/controllers/ScorekeeperController.php

require_once __DIR__ . '/../models/Scorekeeper.php';
require_once __DIR__ . '/../models/MatchScore.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class ScorekeeperController {
    private Scorekeeper $skModel;

    public function __construct() {
        $this->skModel = new Scorekeeper();
    }

    // GET /scorekeeper/assigned
    public function assigned(): void {
        $user = AuthMiddleware::authenticate();
        // Admins/organizers can request another scorekeeper's assigned list.
        $targetUserId = $user['role'] === 'admin' || $user['role'] === 'tournament_organizer'
            ? (int)($this->getQueryParam('user_id') ?: $user['user_id'])
            : (int)$user['user_id'];
        Response::success('Assigned games retrieved', [
            'matches' => $this->skModel->getAssignedMatches($targetUserId),
        ]);
    }

    // GET /matches/{id}/scoreboard
    public function scoreboard(int $matchId): void {
        AuthMiddleware::authenticate();
        $state = $this->skModel->getMatchScoreState($matchId);
        if (!$state) {
            Response::error('Scoreboard state not found for this match. The bracket may not have been generated.', 404);
        }
        Response::success('Scoreboard state retrieved', [
            'score' => $state,
            'roster' => $this->skModel->getMatchRoster($matchId),
            'fouls' => $this->skModel->getFoulCounts($matchId),
            'timeouts' => $this->skModel->getTimeoutHistory($matchId),
            'events' => $this->skModel->getEventLog($matchId),
            'officials' => $this->skModel->getOfficialAssignment($matchId),
        ]);
    }

    // POST /matches/{id}/events
    // Flexible play-by-play recorder. Supported event_type values:
    //   score_1, score_2, score_manual, foul, timeout, timeout_cancel,
    //   substitution, clock_start, clock_pause, clock_resume, clock_reset,
    //   period_start, period_end, game_start, game_pause, game_end.
    public function recordEvent(int $matchId): void {
        $user = $this->requireScorer($matchId);
        $matchStatus = $this->skModel->getMatchStatus($matchId);
        if ($matchStatus === 'completed' || $matchStatus === 'cancelled') {
            Response::forbidden('Cannot modify a completed/cancelled match.');
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $type = $input['event_type'] ?? '';
        $allowed = ['score_1','score_2','score_manual','foul','timeout','timeout_cancel','substitution',
                    'clock_start','clock_pause','clock_resume','clock_reset','period_start','period_end',
                    'game_start','game_pause','game_end'];
        if (!in_array($type, $allowed, true)) {
            Response::error('Invalid or unsupported event type.', 400);
        }

        $detail = [];
        $scoreFields = [];
        $state = $this->skModel->getMatchScoreState($matchId);
        if (!$state) {
            Response::error('Match has no score row. Generate a bracket first.', 404);
        }

        switch ($type) {
            case 'score_1':
                $delta = (int)($input['value'] ?? 1);
                $scoreFields['team1_score'] = (int)$state['team1_score'] + $delta;
                $scoreFields['timer_seconds'] = (int)($input['clock_seconds'] ?? $state['timer_seconds'] ?? 600);
                $detail = ['delta' => $delta, 'manual' => false];
                break;
            case 'score_2':
                $delta = (int)($input['value'] ?? 1);
                $scoreFields['team2_score'] = (int)$state['team2_score'] + $delta;
                $scoreFields['timer_seconds'] = (int)($input['clock_seconds'] ?? $state['timer_seconds'] ?? 600);
                $detail = ['delta' => $delta, 'manual' => false];
                break;
            case 'score_manual':
                $scoreFields['team1_score'] = (int)($input['team1_score'] ?? $state['team1_score']);
                $scoreFields['team2_score'] = (int)($input['team2_score'] ?? $state['team2_score']);
                $detail = ['manual' => true];
                break;
            case 'foul':
                $pid = (int)($input['player_id'] ?? 0);
                if (!$pid) Response::error('player_id is required for a foul event.', 400);
                $tid = (int)($input['team_id'] ?? 0);
                $ftype = in_array($input['foul_type'] ?? '', ['personal','technical','unsportsmanlike','disqualification'], true)
                    ? $input['foul_type'] : 'personal';
                $this->skModel->recordFoul($matchId, $pid, $tid ?: (int)$state['team1_id'], $ftype, (int)$user['user_id']);
                $detail = ['foul_type' => $ftype, 'player_id' => $pid];
                break;
            case 'timeout':
                $tid = (int)($input['team_id'] ?? 0);
                $dur = (int)($input['duration_seconds'] ?? 60);
                $this->skModel->recordTimeout($matchId, $tid ?: (int)$state['team1_id'], $dur, (int)$user['user_id']);
                $detail = ['team_id' => $tid, 'duration_seconds' => $dur];
                break;
            case 'timeout_cancel':
                if (!isset($input['timeout_id'])) Response::error('timeout_id is required to cancel a timeout.', 400);
                $this->skModel->cancelTimeout($matchId, (int)$input['timeout_id']);
                $detail = ['timeout_id' => (int)$input['timeout_id']];
                break;
            case 'substitution':
                $pin = (int)($input['player_in_id'] ?? 0);
                $pout = (int)($input['player_out_id'] ?? 0);
                if (!$pin || !$pout) Response::error('player_in_id and player_out_id are required for a substitution.', 400);
                $tid = (int)($input['team_id'] ?? 0);
                $period = $input['period'] ?? $state['current_period'];
                $clock = isset($input['clock_seconds']) ? (int)$input['clock_seconds'] : (int)$state['timer_seconds'];
                $this->skModel->recordSubstitution($matchId, $tid ?: (int)$state['team1_id'], $pin, $pout, $period, $clock, (int)$user['user_id']);
                $detail = ['player_in_id' => $pin, 'player_out_id' => $pout, 'team_id' => $tid];
                break;
            case 'clock_start':
                $scoreFields['timer_seconds'] = (int)($input['clock_seconds'] ?? $state['timer_seconds'] ?? 600);
                $scoreFields['is_timer_running'] = 1;
                $detail = ['action' => 'clock_start'];
                $this->skModel->startMatch($matchId);
                break;
            case 'clock_pause':
                $scoreFields['is_timer_running'] = 0;
                if (isset($input['clock_seconds'])) $scoreFields['timer_seconds'] = (int)$input['clock_seconds'];
                $detail = ['action' => 'clock_pause'];
                break;
            case 'clock_resume':
                $scoreFields['is_timer_running'] = 1;
                $detail = ['action' => 'clock_resume'];
                break;
            case 'clock_reset':
                $scoreFields['timer_seconds'] = 600;
                $scoreFields['is_timer_running'] = 0;
                $detail = ['action' => 'clock_reset'];
                break;
            case 'period_start':
                $scoreFields['current_period'] = $input['period'] ?? 'Q1';
                $detail = ['period' => $input['period'] ?? 'Q1'];
                break;
            case 'period_end':
                $detail = ['period' => $state['current_period']];
                break;
            case 'game_start':
                $scoreFields['is_timer_running'] = 1;
                $detail = ['action' => 'game_start'];
                break;
            case 'game_pause':
                $scoreFields['is_timer_running'] = 0;
                $detail = ['action' => 'game_pause'];
                break;
            case 'game_end':
                $winner = (int)($input['winner_team_id'] ?? 0);
                $scoreFields['is_timer_running'] = 0;
                $detail = ['winner_team_id' => $winner];
                if ($winner) {
                    $this->skModel->completeMatch($matchId, $winner);
                }
                break;
        }

        // Persist score state changes before the event so undo is accurate.
        if ($scoreFields) $this->skModel->updateScoreState($matchId, $scoreFields);

        $event = [
            'event_type' => $type,
            'team_id' => $input['team_id'] ?? null,
            'player_id' => $input['player_id'] ?? null,
            'clock_seconds' => $input['clock_seconds'] ?? null,
            'period' => $input['period'] ?? $state['current_period'],
            'detail_json' => $detail,
        ];
        $eventId = $this->skModel->recordEvent($matchId, $event);

        Response::success('Event recorded', ['event_id' => $eventId], 201);
    }

    // DELETE /matches/{matchId}/events/{eventId}  (undo)
    public function undoEvent(int $matchId, int $eventId): void {
        $user = $this->requireScorer($matchId, ['admin', 'tournament_organizer']);
        if (!$this->skModel->deleteEvent($eventId, $matchId)) {
            Response::error('Event not found for this match.', 404);
        }
        Response::success('Event removed (undo)');
    }

    // POST /matches/{id}/assign-scorekeeper  { user_id }
    public function assign(int $matchId): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);
        $uid = (int)($input['user_id'] ?? 0);
        if (!$uid) Response::error('user_id is required.', 400);
        $this->skModel->assignOfficial($matchId, $uid, 'scorekeeper', (int)$user['user_id']);
        Response::success('Scorekeeper assigned to match.');
    }

    private function getQueryParam(string $key): ?string {
        if (isset($_GET[$key])) return $_GET[$key];
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY);
        if (!$path) return null;
        parse_str($path, $params);
        return $params[$key] ?? null;
    }

    // Any admin/organizer can record, otherwise the user must be an assigned
    // scorekeeper for this match.
    private function requireScorer(int $matchId, array $extraRoles = []): array {
        $user = AuthMiddleware::authenticate();
        $privileged = array_merge(['admin', 'tournament_organizer'], $extraRoles);
        if (in_array($user['role'], $privileged, true)) return $user;
        if ($this->skModel->isAssignedScorekeeper($matchId, (int)$user['user_id'])) return $user;
        Response::forbidden('You are not authorized to scorekeep this match.');
    }
}

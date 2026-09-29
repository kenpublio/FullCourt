<?php
// backend/controllers/ScoringController.php

require_once __DIR__ . '/../models/MatchScore.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class ScoringController {
    private MatchScore $scoreModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->scoreModel = new MatchScore();
        $this->auditLog = new AuditLog();
    }

    public function getScore(int $matchId): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireMatch($matchId,$user);
        $score = $this->scoreModel->getScore($matchId);
        if (!$score) {
            Response::error('Match score not found', 404);
        }
        Response::success('Score data retrieved', ['score' => $score]);
    }

    public function updateScore(int $matchId): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);
        OrganizationAccess::requireMatch($matchId,$user);
        $current = $this->scoreModel->getScore($matchId);
        if (!$current) Response::error('Match score not found.', 404);
        if (in_array($current['match_status'], ['completed','cancelled','awaiting_confirmation'], true)) {
            Response::forbidden('This game is closed for scoring or is waiting for the organizer to confirm its final score.');
        }
        $input = json_decode(file_get_contents('php://input'), true);

        $team1Score = (int) ($input['team1_score'] ?? 0);
        $team2Score = (int) ($input['team2_score'] ?? 0);
        $currentPeriod = $input['current_period'] ?? 'Q1';
        $timerSeconds = (int) ($input['timer_seconds'] ?? 600);
        $isTimerRunning = (bool) ($input['is_timer_running'] ?? false);

        $this->scoreModel->updateScore($matchId, $team1Score, $team2Score, $currentPeriod, $timerSeconds, $isTimerRunning);
        Response::success('Match score updated live');
    }

    public function finalizeMatch(int $matchId): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);
        OrganizationAccess::requireMatch($matchId,$user);
        $input = json_decode(file_get_contents('php://input'), true);

        $winnerTeamId = (int) ($input['winner_team_id'] ?? 0);
        $team1Score = filter_var($input['team1_score'] ?? null, FILTER_VALIDATE_INT);
        $team2Score = filter_var($input['team2_score'] ?? null, FILTER_VALIDATE_INT);
        $expectedTeam1Score = filter_var($input['expected_team1_score'] ?? null, FILTER_VALIDATE_INT);
        $expectedTeam2Score = filter_var($input['expected_team2_score'] ?? null, FILTER_VALIDATE_INT);
        $currentPeriod = trim((string) ($input['current_period'] ?? 'Q1'));
        $timerSeconds = filter_var($input['timer_seconds'] ?? 0, FILTER_VALIDATE_INT);

        if (!$winnerTeamId || $team1Score === false || $team2Score === false || $expectedTeam1Score === false || $expectedTeam2Score === false || min($team1Score, $team2Score, $expectedTeam1Score, $expectedTeam2Score) < 0) {
            Response::error('Confirm a valid final score and winning team.', 422);
        }

        try {
            $this->scoreModel->finalizeMatch($matchId, $winnerTeamId, $team1Score, $team2Score, $currentPeriod, max(0, (int) $timerSeconds), $expectedTeam1Score, $expectedTeam2Score);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
        $this->auditLog->log($user['user_id'], 'FINALIZE_MATCH', 'LIVE_SCORING', "Finalized match ID {$matchId}. Winner: Team ID {$winnerTeamId}.");

        Response::success('Final score confirmed, published to official results, and winner advanced in bracket');
    }
}

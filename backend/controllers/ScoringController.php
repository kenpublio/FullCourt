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
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        OrganizationAccess::requireMatch($matchId,$user);
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
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        OrganizationAccess::requireMatch($matchId,$user);
        $input = json_decode(file_get_contents('php://input'), true);

        $winnerTeamId = (int) ($input['winner_team_id'] ?? 0);

        if (!$winnerTeamId) {
            Response::error('Winner Team ID is required to finalize match.', 400);
        }

        $this->scoreModel->finalizeMatch($matchId, $winnerTeamId);
        $this->auditLog->log($user['user_id'], 'FINALIZE_MATCH', 'LIVE_SCORING', "Finalized match ID {$matchId}. Winner: Team ID {$winnerTeamId}.");

        Response::success('Match finalized and winner advanced in bracket');
    }
}

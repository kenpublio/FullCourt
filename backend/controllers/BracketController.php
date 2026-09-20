<?php
// backend/controllers/BracketController.php

require_once __DIR__ . '/../models/Bracket.php';
require_once __DIR__ . '/../models/Team.php';
require_once __DIR__ . '/../models/Tournament.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class BracketController {
    private Bracket $bracketModel;
    private Team $teamModel;
    private Tournament $tournamentModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->bracketModel = new Bracket();
        $this->teamModel = new Team();
        $this->tournamentModel = new Tournament();
        $this->auditLog = new AuditLog();
    }

    public function generate(int $tournamentId): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        OrganizationAccess::requireTournament($tournamentId,$user);

        $tournament = $this->tournamentModel->getById($tournamentId);
        if (!$tournament) Response::error('Tournament not found.', 404);

        $teams = $this->teamModel->getByTournament($tournamentId);
        $teamIds = array_column($teams, 'id');

        if (count($teamIds) < 2) {
            Response::error('At least 2 registered teams are required to generate a bracket.', 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $format = trim($input['format'] ?? $tournament['format'] ?? 'single_elimination');

        // Honour seeding_type: manual => teams already ordered by seed in getByTournament;
        // automatic => random draw so the bracket isn't deterministic.
        if (!empty($input['shuffle']) || ($tournament['seeding_type'] ?? 'automatic') !== 'manual') {
            shuffle($teamIds);
        }

        try {
            $groups = (int)($input['groups'] ?? 1);
            $data = $this->bracketModel->generate($tournamentId, $teamIds, $format, $groups);
            $this->auditLog->log($user['user_id'], 'GENERATE_BRACKET', 'BRACKET_ENGINE', "Generated {$format} bracket for tournament ID {$tournamentId}.");
            Response::success('Bracket generated successfully', $data);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function show(int $tournamentId): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($tournamentId,$user);
        $data = $this->bracketModel->getBracket($tournamentId);
        Response::success('Bracket data retrieved', $data);
    }
}

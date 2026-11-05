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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        OrganizationAccess::requireTournament($tournamentId, $user);

        $tournament = $this->tournamentModel->getById($tournamentId);
        if (!$tournament) Response::error('Tournament not found.', 404);

        $teams = $this->teamModel->getByTournament($tournamentId);
        $teamIds = array_column($teams, 'id');

        if (count($teamIds) < 2) {
            Response::error('At least 2 registered teams are required to generate a bracket.', 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $format = trim($input['format'] ?? $tournament['format'] ?? 'single_elimination');

        if(isset($input['team_ids'])){
            if(!is_array($input['team_ids']))Response::error('Choose a valid team order.',422);
            $requested=array_values(array_unique(array_map('intval',$input['team_ids'])));
            $available=array_map('intval',$teamIds);
            $requestedCheck=$requested;$availableCheck=$available;sort($requestedCheck);sort($availableCheck);
            if($requestedCheck!==$availableCheck)Response::error('The seed list must include every registered team exactly once.',422);
            $teamIds=$requested;
        }

        // Honour seeding_type: manual => teams already ordered by seed in getByTournament;
        // automatic => random draw so the bracket isn't deterministic.
        if (!isset($input['team_ids']) && (!empty($input['shuffle']) || ($tournament['seeding_type'] ?? 'automatic') !== 'manual')) {
            shuffle($teamIds);
        }

        try {
            $groups = (int)($input['groups'] ?? 1);
            $data = $this->bracketModel->generate($tournamentId, $teamIds, $format, $groups);
            if(isset($input['team_ids']))$this->teamModel->saveSeedOrder($tournamentId,$teamIds);
            $action=isset($input['team_ids'])?'RESEED_BRACKET':'GENERATE_BRACKET';
            $message=isset($input['team_ids'])?'Saved a new manual team placement':'Generated bracket';
            $this->auditLog->log($user['user_id'], $action, 'BRACKET_ENGINE', "{$message} for tournament ID {$tournamentId}.");
            Response::success(isset($input['team_ids'])?'Team placement updated successfully':'Bracket generated successfully', $data);
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

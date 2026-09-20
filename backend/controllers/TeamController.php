<?php
// backend/controllers/TeamController.php

require_once __DIR__ . '/../models/Team.php';
require_once __DIR__ . '/../models/TeamPlayer.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class TeamController {
    private Team $teamModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->teamModel = new Team();
        $this->auditLog = new AuditLog();
    }

    public function index(): void {
        $user = AuthMiddleware::authenticate();
        if (in_array($user['role'], ['coach','coach_manager'], true)) {
            $teams = $this->teamModel->getForCoach((int) $user['user_id']);
        } elseif (OrganizationAccess::isPlatform($user)) {
            $teams = $this->teamModel->getAll();
        } else {
            $teams = $this->teamModel->getForOrganizationUser((int) $user['user_id']);
        }
        Response::success('Teams retrieved', ['teams' => $teams]);
    }

    public function store(): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer', 'coach_manager']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['team_name']) || empty($input['tournament_id'])) {
            Response::error('Team Name and Tournament ID are required.', 400);
        }
        OrganizationAccess::requireTournament((int) $input['tournament_id'], $user);

        $input['coach_user_id'] = $input['coach_user_id'] ?? $user['user_id'];
        $teamId = $this->teamModel->create($input);

        $this->auditLog->log($user['user_id'], 'REGISTER_TEAM', 'TEAM_MGMT', "Registered team '{$input['team_name']}' for tournament ID {$input['tournament_id']}.");

        Response::success('Team registered successfully', ['team_id' => $teamId], 201);
    }

    public function getByTournament(int $tournamentId): void {
        $user = AuthMiddleware::authenticate();
        OrganizationAccess::requireTournament($tournamentId, $user);
        $teams = $this->teamModel->getByTournament($tournamentId);
        Response::success('Teams for tournament retrieved', ['teams' => $teams]);
    }

    public function update(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer', 'coach_manager']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($input['team_name']) || empty($input['tournament_id'])) {
            Response::error('Team name and tournament are required.', 400);
        }

        $this->teamModel->update($id, $input);
        $this->auditLog->log($user['user_id'], 'UPDATE_TEAM', 'TEAM_MGMT', "Updated team '{$input['team_name']}' (ID: {$id}).");
        Response::success('Team updated successfully');
    }

    public function destroy(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer', 'coach_manager']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);
        if ($this->teamModel->hasMatches($id)) {
            Response::error('This team already has scheduled or recorded games and cannot be deleted. You may edit it instead.', 409);
        }

        $this->teamModel->delete($id);
        $this->auditLog->log($user['user_id'], 'DELETE_TEAM', 'TEAM_MGMT', "Deleted team '{$team['team_name']}' (ID: {$id}).");
        Response::success('Team deleted successfully');
    }

    public function players(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer', 'coach_manager']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);
        $players = (new TeamPlayer())->getByTeam($id);
        Response::success('Team roster retrieved', ['team' => $team, 'players' => $players]);
    }

    public function uploadLogo(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer', 'coach_manager']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);
        if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
            Response::error('A team logo image is required.', 400);
        }

        $file = $_FILES['logo'];
        $mimeMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (!isset($mimeMap[$mime])) {
            Response::error('Team logo must be a JPG, PNG, or WEBP image.', 400);
        }
        if ($file['size'] > 3 * 1024 * 1024) {
            Response::error('Team logo must be 3MB or smaller.', 400);
        }

        $filename = 'team_' . $id . '_' . time() . '.' . $mimeMap[$mime];
        $dir = __DIR__ . '/../uploads/team-logos';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            Response::error('Could not save the team logo.', 500);
        }
        $url = '/uploads/team-logos/' . $filename;
        $this->teamModel->updateLogo($id, $url);
        $this->auditLog->log($user['user_id'], 'UPDATE_TEAM_LOGO', 'TEAM_MGMT', "Updated logo for team ID {$id}.");
        Response::success('Team logo updated successfully', ['logo_url' => $url]);
    }

    private function authorizeTeamOwner(array $user, array $team): void {
        if (in_array($user['role'], ['coach', 'coach_manager'], true)
            && (int) $team['coach_user_id'] !== (int) $user['user_id']
            && (int) ($team['manager_user_id'] ?? 0) !== (int) $user['user_id']) {
            Response::forbidden('You can only manage your own teams.');
        }
    }
}

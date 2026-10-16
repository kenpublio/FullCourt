<?php
// backend/controllers/TeamController.php

require_once __DIR__ . '/../models/Team.php';
require_once __DIR__ . '/../models/Tournament.php';
require_once __DIR__ . '/../models/TeamPlayer.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../models/Bracket.php';
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
        if ($user['role'] === 'coach') {
            $teams = $this->teamModel->getForCoach((int) $user['user_id']);
        } elseif ($user['role'] === 'statistician') {
            $teams = $this->teamModel->getForTournamentManager((int)$user['user_id']);
        } elseif (OrganizationAccess::isPlatform($user)) {
            $teams = $this->teamModel->getAll();
        } else {
            $teams = $this->teamModel->getForOrganizationUser((int) $user['user_id']);
        }
        Response::success('Teams retrieved', ['teams' => $teams]);
    }

    public function store(): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'coach']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['team_name']) || empty($input['tournament_id'])) {
            Response::error('Team Name and Tournament ID are required.', 400);
        }
        $tournamentId=(int)$input['tournament_id'];
        $isCoach=$user['role']==='coach';
        if ($isCoach) {
            $tournament=(new Tournament())->getById($tournamentId);
            if (!$tournament || ($tournament['approval_status'] ?? 'approved') !== 'approved' || !in_array($tournament['status'],['upcoming','ongoing'],true)) {
                Response::error('This tournament is not open for team applications.',409);
            }
            if ($this->teamModel->findCoachApplication($tournamentId,(int)$user['user_id'])) {
                Response::error('You already submitted a team application for this tournament.',409);
            }
            $input['coach_user_id']=$user['user_id'];
            $input['manager_user_id']=$user['user_id'];
            $input['status']='draft';
        } else {
            OrganizationAccess::requireTournament($tournamentId, $user);
            $input['coach_user_id'] = $input['coach_user_id'] ?? $user['user_id'];
        }
        $teamId = $this->teamModel->create($input);

        $this->auditLog->log($user['user_id'], 'REGISTER_TEAM', 'TEAM_MGMT', "Registered team '{$input['team_name']}' for tournament ID {$input['tournament_id']}.");

        Response::success($isCoach ? 'Team submitted for Admin approval.' : 'Team registered successfully', ['team_id' => $teamId], 201);
    }

    public function reviewApplication(int $id): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        $team=$this->teamModel->getById($id);
        if (!$team) Response::error('Team application not found.',404);
        OrganizationAccess::requireTournament((int)$team['tournament_id'],$user);
        $input=json_decode(file_get_contents('php://input'),true) ?: [];
        $decision=$input['decision'] ?? '';
        if (!in_array($decision,['approve','reject'],true)) Response::error('Decision must be approve or reject.',400);
        if ($team['status'] !== 'draft') Response::error('Only pending team applications can be reviewed.',409);
        $status=$decision === 'approve' ? 'registered' : 'disqualified';
        $this->teamModel->updateStatus($id,$status);
        $bracketGenerated=false;
        if($decision==='approve'){
            $teams=$this->teamModel->getByTournament((int)$team['tournament_id']);
            $teamIds=array_map('intval',array_column($teams,'id'));
            if(count($teamIds)>=2){
                try{
                    $tournament=(new Tournament())->getById((int)$team['tournament_id']);
                    shuffle($teamIds);
                    (new Bracket())->generate((int)$team['tournament_id'],$teamIds,$tournament['format']??'single_elimination',1);
                    $bracketGenerated=true;
                }catch(Exception $e){
                    $this->auditLog->log((int)$user['user_id'],'AUTO_BRACKET_DEFERRED','BRACKET_ENGINE',$e->getMessage());
                }
            }
        }
        $this->auditLog->log((int)$user['user_id'],strtoupper($decision).'_TEAM_APPLICATION','TEAM_MGMT',ucfirst($decision)."d team application '{$team['team_name']}' (ID: {$id}).");
        Response::success($decision === 'approve' ? ($bracketGenerated?'Team approved and the bracket was updated automatically.':'Team approved. The bracket will be created automatically when at least two teams are approved.') : 'Team application rejected.');
    }

    public function getByTournament(int $tournamentId): void {
        $user = AuthMiddleware::authenticate();
        OrganizationAccess::requireTournament($tournamentId, $user);
        $teams = $this->teamModel->getByTournament($tournamentId);
        if ($user['role']==='coach') {
            $uid=(int)$user['user_id'];
            $teams=array_values(array_filter($teams,static fn(array $team):bool=>(int)$team['coach_user_id']===$uid || (int)($team['manager_user_id']??0)===$uid));
        }
        Response::success('Teams for tournament retrieved', ['teams' => $teams]);
    }

    public function update(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'coach']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($input['team_name']) || empty($input['tournament_id'])) {
            Response::error('Team name and tournament are required.', 400);
        }
        if ($user['role']==='coach') {
            $input['tournament_id']=$team['tournament_id'];
            $input['division_id']=$team['division_id'];
        } else {
            OrganizationAccess::requireTournament((int)$team['tournament_id'],$user);
        }

        $this->teamModel->update($id, $input);
        $this->auditLog->log($user['user_id'], 'UPDATE_TEAM', 'TEAM_MGMT', "Updated team '{$input['team_name']}' (ID: {$id}).");
        Response::success('Team updated successfully');
    }

    public function destroy(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'statistician']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);
        OrganizationAccess::requireTournament((int)$team['tournament_id'],$user);
        if ($this->teamModel->hasMatches($id)) {
            Response::error('This team already has scheduled or recorded games and cannot be deleted. You may edit it instead.', 409);
        }

        $this->teamModel->delete($id);
        $this->auditLog->log($user['user_id'], 'DELETE_TEAM', 'TEAM_MGMT', "Deleted team '{$team['team_name']}' (ID: {$id}).");
        Response::success('Team deleted successfully');
    }

    public function players(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'coach']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);
        if ($user['role']!=='coach') OrganizationAccess::requireTournament((int)$team['tournament_id'],$user);
        $players = (new TeamPlayer())->getByTeam($id);
        Response::success('Team roster retrieved', ['team' => $team, 'players' => $players]);
    }

    public function uploadLogo(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'coach']);
        $team = $this->teamModel->getById($id);
        if (!$team) {
            Response::error('Team not found.', 404);
        }
        $this->authorizeTeamOwner($user, $team);
        if ($user['role']!=='coach') OrganizationAccess::requireTournament((int)$team['tournament_id'],$user);
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

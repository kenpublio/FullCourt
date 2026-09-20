<?php
// backend/controllers/EligibilityController.php

require_once __DIR__ . '/../models/TeamPlayer.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Team.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/NotificationMailer.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class EligibilityController {
    private TeamPlayer $playerModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->playerModel = new TeamPlayer();
        $this->auditLog = new AuditLog();
    }

    public function index(): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']);
        if (in_array($user['role'], ['coach','coach_manager'], true)) {
            $players=$this->playerModel->getForCoach((int)$user['user_id']);
        } elseif (OrganizationAccess::isPlatform($user)) {
            $players=$this->playerModel->getAllPending();
        } else {
            $players=$this->playerModel->getForOrganizationUser((int)$user['user_id']);
        }
        Response::success('Roster eligibility records retrieved', ['players' => $players]);
    }

    public function myMembership(): void {
        $user = AuthMiddleware::authenticate();
        $membership = $this->playerModel->getMembershipForUser((int) $user['user_id']);
        Response::success('Player team membership retrieved', [
            'has_team' => $membership !== null,
            'membership' => $membership
        ]);
    }

    public function myInvitations(): void {
        $user = AuthMiddleware::authorizeRoles(['player']);
        Response::success('Team invitations retrieved', [
            'invitations' => $this->playerModel->getInvitationsForUser((int) $user['user_id'])
        ]);
    }

    public function respondToInvitation(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['player']);
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        if (!in_array($action, ['accept', 'decline'], true)) {
            Response::error('Choose accept or decline.', 400);
        }
        if (!$this->playerModel->findInvitation($id, (int) $user['user_id'])) {
            Response::error('This invitation is unavailable or already answered.', 404);
        }
        $this->playerModel->respondToInvitation($id, (int) $user['user_id'], $action === 'accept');
        Response::success($action === 'accept' ? 'You joined the team successfully.' : 'Team invitation declined.');
    }

    public function verify(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']);
        $input = json_decode(file_get_contents('php://input'), true);

        $status = $input['status'] ?? 'verified'; // 'verified' or 'rejected'
        $remarks = $input['remarks'] ?? null;

        if (!in_array($status, ['verified', 'rejected'], true)) {
            Response::error('Invalid status specified.', 400);
        }

        if (in_array($user['role'], ['coach','coach_manager'], true) && !$this->playerModel->belongsToCoach($id, (int) $user['user_id'])) {
            Response::forbidden('You can only review players assigned to your own team.');
        }
        $this->requirePlayerRecordAccess($id,$user);

        try {
            $this->playerModel->updateEligibility($id, $status, (int)$user['user_id'], $remarks);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 422);
        }
        $this->auditLog->log($user['user_id'], 'VERIFY_ELIGIBILITY', 'PLAYER_ELIGIBILITY', "Set player ID {$id} status to '{$status}'. Remarks: {$remarks}");

        Response::success("Player eligibility updated to '{$status}'.");
    }

    public function updateRoster(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager']);
        if (in_array($user['role'], ['coach','coach_manager'], true) && !$this->playerModel->belongsToCoach($id, (int) $user['user_id'])) {
            Response::forbidden('You can only edit players assigned to your own team.');
        }
        $this->requirePlayerRecordAccess($id,$user);
        $input = json_decode(file_get_contents('php://input'), true);
        $jersey = ($input['jersey_number'] ?? '') === '' ? null : (int) $input['jersey_number'];
        $position = trim($input['position'] ?? '');
        if ($jersey !== null && ($jersey < 0 || $jersey > 999)) {
            Response::error('Jersey number must be between 0 and 999.', 400);
        }
        if (strlen($position) > 50) Response::error('Position must be 50 characters or fewer.', 400);
        $this->playerModel->updateRosterDetails($id, $jersey, $position);
        Response::success('Jersey number and position updated.');
    }

    public function addPlayer(): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'organization_admin', 'tournament_organizer', 'coach', 'coach_manager']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['team_id']) || empty($input['player_identifier'])) {
            Response::error('Team and player email or mobile number are required.', 400);
        }

        $team = (new Team())->getById((int) $input['team_id']);
        if (!$team) Response::error('Team not found.', 404);
        OrganizationAccess::requireTournament((int)$team['tournament_id'],$user);
        if (in_array($user['role'], ['coach','coach_manager'], true) && (int) $team['coach_user_id'] !== (int) $user['user_id'] && (int)($team['manager_user_id'] ?? 0) !== (int)$user['user_id']) {
            Response::forbidden('You can only invite players to your own team.');
        }
        $player = (new User())->findByLogin(trim($input['player_identifier']));
        if (!$player || $player['role'] !== 'player') {
            Response::error('No player account was found with that email or mobile number.', 404);
        }
        if ($this->playerModel->hasActiveInvitation((int) $input['team_id'], (int) $player['id'])) {
            Response::error('This player already has an invitation or belongs to this team.', 409);
        }
        $input['user_id'] = $player['id'];
        $input['student_id_number'] = $player['student_faculty_id'] ?? null;
        $id = $this->playerModel->addPlayer($input);

        $this->auditLog->log($user['user_id'], 'ADD_PLAYER', 'PLAYER_ELIGIBILITY', "Added player ID {$id} to team ID {$input['team_id']}.");

        (new NotificationMailer())->sendToUser((int)$player['id'],'You have a FullCourt team invitation',($team['team_name']??'A basketball team').' invited you to join its official tournament roster. Open FullCourt to review and respond to the invitation.','/notifications','Review invitation');

        Response::success('Team invitation sent to the player.', ['id' => $id], 201);
    }

    private function requirePlayerRecordAccess(int $id,array $user):void {
        if(OrganizationAccess::isPlatform($user)||in_array($user['role'],['coach','coach_manager'],true))return;
        $tournamentId=$this->playerModel->getTournamentId($id);
        if(!$tournamentId)Response::error('Player roster record was not found.',404);
        OrganizationAccess::requireTournament($tournamentId,$user);
    }
}

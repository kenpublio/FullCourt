<?php
// backend/controllers/EligibilityController.php

require_once __DIR__ . '/../models/TeamPlayer.php';
require_once __DIR__ . '/../models/AuditLog.php';
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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','coach']);
        if ($user['role'] === 'coach') {
            $players=$this->playerModel->getForCoach((int)$user['user_id']);
        } else {
            $players=$this->playerModel->getAllPending();
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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        $input = json_decode(file_get_contents('php://input'), true);

        $status = $input['status'] ?? 'verified'; // 'verified' or 'rejected'
        $remarks = $input['remarks'] ?? null;

        if (!in_array($status, ['verified', 'rejected'], true)) {
            Response::error('Invalid status specified.', 400);
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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','coach']);
        if ($user['role'] === 'coach' && !$this->playerModel->belongsToCoach($id, (int) $user['user_id'])) {
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
        $user = AuthMiddleware::authorizeRoles(['platform_admin', 'admin', 'coach']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['team_id']) || empty(trim((string)($input['player_name'] ?? ''))) || empty($input['birth_date'])) {
            Response::error('Team, player name, and birth date are required.', 400);
        }

        $team = (new Team())->getById((int) $input['team_id']);
        if (!$team) Response::error('Team not found.', 404);
        if ($user['role'] === 'coach' && (int) $team['coach_user_id'] !== (int) $user['user_id']) {
            Response::forbidden('You can only add players to your own team.');
        }
        $birthDate = DateTimeImmutable::createFromFormat('Y-m-d', (string)$input['birth_date']);
        if (!$birthDate || $birthDate->format('Y-m-d') !== $input['birth_date'] || $birthDate > new DateTimeImmutable('today')) {
            Response::error('Enter a valid player birth date.', 400);
        }
        $input['player_name'] = trim($input['player_name']);
        $capacity=$this->playerModel->rosterCapacity((int)$input['team_id']);
        if($capacity['count'] >= $capacity['limit']) {
            Response::error("This roster is full. A team can register up to {$capacity['limit']} active players.", 422, ['roster_count'=>$capacity['count'],'roster_limit'=>$capacity['limit']]);
        }
        if ($this->playerModel->hasRosterDuplicate((int)$input['team_id'], $input['player_name'], $input['birth_date'])) {
            Response::error('A player with the same name and birth date is already on this roster.', 409);
        }
        $input['student_id_number'] = 'ROSTER-' . strtoupper(substr(hash('sha256', $input['team_id'].'|'.$input['player_name'].'|'.$input['birth_date']), 0, 12));
        $id = $this->playerModel->addPlayer($input);

        $this->auditLog->log($user['user_id'], 'ADD_PLAYER', 'PLAYER_ELIGIBILITY', "Added player ID {$id} to team ID {$input['team_id']}.");

        Response::success('Player added to the roster. Upload the birth record and parent permit for admin verification.', ['id' => $id], 201);
    }

    private function requirePlayerRecordAccess(int $id,array $user):void {
        if(in_array($user['role'],['platform_admin','admin','coach'],true))return;
        Response::forbidden('You cannot access this roster record.');
    }
}

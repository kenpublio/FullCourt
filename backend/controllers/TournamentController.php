<?php
// backend/controllers/TournamentController.php

require_once __DIR__ . '/../models/Tournament.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class TournamentController {
    private Tournament $tournamentModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->tournamentModel = new Tournament();
        $this->auditLog = new AuditLog();
    }

    public function index(): void {
        $user=AuthMiddleware::authenticate();
        $tournaments = in_array($user['role'], ['coach','coach_manager'], true)
            ? $this->tournamentModel->getAvailableForCoach((int)$user['user_id'])
            : $this->tournamentModel->getAll((int)$user['user_id'],OrganizationAccess::isPlatform($user));
        $sports = $this->tournamentModel->getSports();
        Response::success('Tournaments retrieved', [
            'tournaments' => $tournaments,
            'sports' => $sports
        ]);
    }

    public function show(int $id): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($id,$user);
        $tournament = $this->tournamentModel->getById($id);
        if (!$tournament) {
            Response::error('Tournament not found', 404);
        }
        if (($tournament['approval_status'] ?? 'approved') !== 'approved'
            && !OrganizationAccess::isPlatform($user)
            && (int)$tournament['created_by'] !== (int)$user['user_id']) {
            Response::forbidden('This tournament is waiting for platform review.');
        }
        Response::success('Tournament details retrieved', ['tournament' => $tournament]);
    }

    public function store(): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin','tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['name']) || empty($input['start_date']) || empty($input['end_date'])) {
            Response::error('Name, Start Date, and End Date are required.', 400);
        }

        $basketballSportId = $this->tournamentModel->getBasketballSportId();
        if ($basketballSportId === null) {
            Response::error('Basketball is not configured in the system.', 500);
        }

        $input['sport_id'] = $basketballSportId;
        if(!OrganizationAccess::isPlatform($user)){$input['organization_id']=OrganizationAccess::defaultOrganizationId((int)$user['user_id']);if(!$input['organization_id'])Response::error('Join an approved organization before creating a tournament.',403);}
        $courtIds=array_values(array_unique(array_filter(array_map('intval',$input['court_ids']??[]),fn($id)=>$id>0)));
        if(!$courtIds)Response::error('Select at least one court for this tournament.',422);
        if(!$this->tournamentModel->canUseCourts($courtIds,(int)$input['organization_id'],$basketballSportId))Response::error('One or more selected courts are unavailable, unapproved, or outside your organization.',422);
        $input['court_ids']=$courtIds;

        $input['created_by'] = $user['user_id'];
        $id = $this->tournamentModel->create($input);

        $this->auditLog->log($user['user_id'], 'CREATE_TOURNAMENT', 'TOURNAMENT_MGMT', "Created tournament '{$input['name']}' (ID: {$id}).");

        Response::success('Tournament created successfully', ['id' => $id], 201);
    }

    public function update(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin','tournament_organizer']);
        OrganizationAccess::requireTournament($id,$user);
        $input = json_decode(file_get_contents('php://input'), true);

        $existing = $this->tournamentModel->getById($id);
        if (!$existing) {
            Response::error('Tournament not found', 404);
        }

        $this->tournamentModel->update($id, $input);
        $this->auditLog->log($user['user_id'], 'UPDATE_TOURNAMENT', 'TOURNAMENT_MGMT', "Updated tournament '{$input['name']}' (ID: {$id}).");

        Response::success('Tournament updated successfully');
    }

    public function destroy(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin','tournament_organizer']);
        OrganizationAccess::requireTournament($id,$user);
        $existing = $this->tournamentModel->getById($id);
        if (!$existing) {
            Response::error('Tournament not found', 404);
        }

        $this->tournamentModel->delete($id);
        $this->auditLog->log($user['user_id'], 'DELETE_TOURNAMENT', 'TOURNAMENT_MGMT', "Deleted tournament '{$existing['name']}' (ID: {$id}).");

        Response::success('Tournament deleted successfully');
    }

    public function review(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $status = $input['status'] ?? '';
        if (!in_array($status, ['approved','rejected'], true)) {
            Response::error('Tournament review status must be approved or rejected.', 422);
        }
        $tournament = $this->tournamentModel->getById($id);
        if (!$tournament) Response::error('Tournament not found.', 404);
        if (($tournament['approval_status'] ?? 'approved') !== 'pending') {
            Response::error('Only pending tournament applications can be reviewed.', 409);
        }
        if (!$this->tournamentModel->review($id, $status, (int)$user['user_id'], $input['notes'] ?? null)) {
            Response::error('Tournament review could not be saved. Refresh and try again.', 409);
        }
        $decision = $status === 'approved' ? 'approved' : 'rejected';
        $this->auditLog->log((int)$user['user_id'], strtoupper($decision).'_TOURNAMENT', 'TOURNAMENT_MGMT', "{$decision} tournament '{$tournament['name']}' (ID: {$id}).");
        Response::success($status === 'approved' ? 'Tournament approved and published.' : 'Tournament application rejected.');
    }
}

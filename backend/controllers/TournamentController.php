<?php
// backend/controllers/TournamentController.php

require_once __DIR__ . '/../models/Tournament.php';
require_once __DIR__ . '/../models/User.php';
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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['name']) || empty($input['start_date']) || empty($input['end_date'])) {
            Response::error('Name, Start Date, and End Date are required.', 400);
        }
        $registrationDeadline=trim((string)($input['registration_deadline']??$input['start_date']));
        if(!DateTimeImmutable::createFromFormat('Y-m-d',$registrationDeadline))Response::error('Roster registration deadline must be a valid date.',422);
        if(strtotime($registrationDeadline)>strtotime((string)$input['start_date']))Response::error('Roster registration deadline cannot be after the tournament starts.',422);
        $input['registration_deadline']=$registrationDeadline;

        $basketballSportId = $this->tournamentModel->getBasketballSportId();
        if ($basketballSportId === null) {
            Response::error('Basketball is not configured in the system.', 500);
        }

        $input['sport_id'] = $basketballSportId;
        $input['organization_id'] = null;
        $courtIds=array_values(array_unique(array_filter(array_map('intval',$input['court_ids']??[]),fn($id)=>$id>0)));
        if(count($courtIds)!==1)Response::error('Select exactly one Main Court for this tournament.',422);
        if(!$this->tournamentModel->canUseCourts($courtIds,0,$basketballSportId))Response::error('The selected Main Court is unavailable.',422);
        $input['court_ids']=$courtIds;

        $scheduleStart = trim((string)($input['schedule_start_time'] ?? '08:00'));
        $scheduleEnd = trim((string)($input['schedule_end_time'] ?? '20:00'));
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $scheduleStart)
            || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $scheduleEnd)) {
            Response::error('Court availability must use a valid start and end time.', 422);
        }
        if (strtotime("1970-01-01 {$scheduleEnd}:00") <= strtotime("1970-01-01 {$scheduleStart}:00")) {
            Response::error('Court closing time must be later than the opening time.', 422);
        }
        $input['schedule_start_time'] = $scheduleStart;
        $input['schedule_end_time'] = $scheduleEnd;
        $input['default_match_duration_minutes'] = max(20, min(240, (int)($input['default_match_duration_minutes'] ?? 90)));
        $input['default_break_minutes'] = max(0, min(120, (int)($input['default_break_minutes'] ?? 15)));
        $input['min_rest_minutes_between_games'] = max(0, min(1440, (int)($input['min_rest_minutes_between_games'] ?? 120)));
        $input['max_games_per_team_per_day'] = max(1, min(10, (int)($input['max_games_per_team_per_day'] ?? 2)));
        $validDays = ['mon','tue','wed','thu','fri','sat','sun'];
        $availableDays = array_values(array_intersect($validDays, array_map('strtolower', (array)($input['available_days'] ?? $validDays))));
        if (!$availableDays) Response::error('Select at least one available court day.', 422);
        $input['available_days'] = implode(',', $availableDays);

        $input['created_by'] = $user['user_id'];
        $mode=strtolower(trim((string)($input['operation_mode']??'official')));
        if(!in_array($mode,['official','practice'],true))Response::error('Choose official or practice tournament mode.',422);
        $input['operation_mode']=$mode;
        $input['approval_status'] = 'approved';
        // New competitions start safely as drafts. Official tournaments become
        // public only after the readiness gate passes; practice data stays private.
        $input['is_published'] = 0;
        $id = $this->tournamentModel->create($input);

        $this->auditLog->log($user['user_id'], 'CREATE_TOURNAMENT', 'TOURNAMENT_MGMT', "Created tournament '{$input['name']}' (ID: {$id}).");

        Response::success($mode==='practice'?'Practice tournament created. Results will not affect official standings.':'Tournament draft created. Complete the readiness checklist before publishing.', ['id' => $id], 201);
    }

    public function update(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        OrganizationAccess::requireTournament($id,$user);
        $existing = $this->tournamentModel->getById($id);
        if (!$existing) {
            Response::error('Tournament not found', 404);
        }

        $this->tournamentModel->delete($id);
        $this->auditLog->log($user['user_id'], 'DELETE_TOURNAMENT', 'TOURNAMENT_MGMT', "Deleted tournament '{$existing['name']}' (ID: {$id}).");

        Response::success('Tournament deleted successfully');
    }

    public function rosterLock(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        OrganizationAccess::requireTournament($id, $user);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (!array_key_exists('locked', $input)) Response::error('Locked state is required.', 422);
        $locked = filter_var($input['locked'], FILTER_VALIDATE_BOOLEAN);
        $this->tournamentModel->setRosterLock($id, $locked, (int)$user['user_id']);
        $this->auditLog->log((int)$user['user_id'], $locked ? 'LOCK_TOURNAMENT_ROSTERS' : 'UNLOCK_TOURNAMENT_ROSTERS', 'TOURNAMENT_MGMT', ($locked ? 'Locked' : 'Unlocked')." rosters for tournament {$id}.");
        Response::success($locked ? 'Tournament rosters locked.' : 'Tournament rosters unlocked.');
    }

    public function archiveTournament(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','statistician']);
        OrganizationAccess::requireTournament($id, $user);
        $existing = $this->tournamentModel->getById($id);
        if (!$existing) Response::error('Tournament not found.', 404);
        $this->tournamentModel->archive($id);
        $this->auditLog->log((int)$user['user_id'], 'ARCHIVE_TOURNAMENT', 'TOURNAMENT_MGMT', "Archived tournament '{$existing['name']}' (ID: {$id}).");
        Response::success('Tournament archived. Its records remain available for reports.');
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
        if ($status === 'approved') {
            $this->tournamentModel->approveLinkedPendingVenues($id, (int)$user['user_id']);
        }
        $decision = $status === 'approved' ? 'approved' : 'rejected';
        $this->auditLog->log((int)$user['user_id'], strtoupper($decision).'_TOURNAMENT', 'TOURNAMENT_MGMT', "{$decision} tournament '{$tournament['name']}' (ID: {$id}).");
        Response::success($status === 'approved' ? 'Tournament approved and published.' : 'Tournament application rejected.');
    }

    public function assignStaff(int $id): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        $tournament=$this->tournamentModel->getById($id);
        if(!$tournament)Response::error('Tournament not found.',404);
        $input=json_decode(file_get_contents('php://input'),true)?:[];
        $staffId=empty($input['staff_user_id'])?null:(int)$input['staff_user_id'];
        if($staffId){
            $staff=(new User())->findById($staffId);
            if(!$staff || $staff['role']!=='statistician' || !$staff['is_active'])Response::error('Select an active Staff Admin account.',422);
        }
        $this->tournamentModel->assignStaff($id,$staffId,(int)$user['user_id']);
        $this->auditLog->log((int)$user['user_id'],'ASSIGN_TOURNAMENT_STAFF','TOURNAMENT_MGMT',$staffId?"Assigned Staff Admin {$staffId} to tournament {$id}.":"Removed the primary Staff Admin from tournament {$id}.");
        Response::success($staffId?'Staff Admin assigned to the tournament.':'Staff Admin assignment removed.');
    }

    public function readiness(int $id): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($id,$user);
        Response::success('Tournament readiness retrieved',['readiness'=>$this->tournamentModel->readiness($id)]);
    }

    public function publish(int $id): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        OrganizationAccess::requireTournament($id,$user);
        $tournament=$this->tournamentModel->getById($id);
        if(!$tournament)Response::error('Tournament not found.',404);
        if(($tournament['operation_mode']??'official')==='practice')Response::error('Practice tournaments stay private and cannot be published.',422);
        $readiness=$this->tournamentModel->readiness($id);
        if(!$readiness['publish_ready']){
            $missing=array_map(fn($check)=>$check['label'],array_values(array_filter($readiness['checks'],fn($check)=>!$check['ready'])));
            Response::error('Tournament is not ready to publish: '.implode(', ',$missing).'.',422,['readiness'=>$readiness]);
        }
        if(!$this->tournamentModel->publish($id))Response::error('Tournament is already published or could not be updated.',409);
        $this->auditLog->log((int)$user['user_id'],'PUBLISH_TOURNAMENT','TOURNAMENT_MGMT',"Published tournament '{$tournament['name']}' (ID: {$id}) after all readiness checks passed.");
        Response::success('Tournament published and is now visible to teams.');
    }
}

<?php
// backend/controllers/VenueController.php

require_once __DIR__ . '/../models/Venue.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/response.php';

class VenueController {
    private Venue $venueModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->venueModel = new Venue();
        $this->auditLog = new AuditLog();
    }

    public function index(): void {
        AuthMiddleware::authenticate();
        $venues = $this->venueModel->getAll();
        foreach ($venues as &$v) {
            $v['courts'] = $this->venueModel->getCourts((int)$v['id']);
        }
        unset($v);
        $courts = $this->venueModel->getAllCourts();
        Response::success('Venues and courts retrieved', ['venues' => $venues, 'courts' => $courts]);
    }

    public function show(int $id): void {
        AuthMiddleware::authenticate();
        $venue = $this->venueModel->getById($id);
        if (!$venue) Response::error('Venue not found.', 404);
        Response::success('Venue retrieved', [
            'venue' => $venue,
            'courts' => $this->venueModel->getCourts($id)
        ]);
    }

    public function storeVenue(): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin', 'tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);
        $name = trim($input['name'] ?? '');
        $location = trim($input['location'] ?? '');
        if ($name === '' || $location === '') Response::error('Venue name and location are required.', 400);
        $organizationId=OrganizationAccess::defaultOrganizationId((int)$user['user_id']);
        if(!$organizationId) Response::error('An active organization membership is required to submit a venue.',422);
        $id = $this->venueModel->createVenue($name, $location, $organizationId, (int)$user['user_id']);
        $this->auditLog->log($user['user_id'], 'CREATE_VENUE', 'VENUE_MGMT', "Created venue '{$name}' (ID: {$id}).");
        Response::success('Venue submitted for administrator approval', ['id' => $id], 201);
    }

    public function updateVenue(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin', 'tournament_organizer']);
        if (!$this->venueModel->getById($id)) Response::error('Venue not found.', 404);
        $input = json_decode(file_get_contents('php://input'), true);
        $name = trim($input['name'] ?? '');
        $location = trim($input['location'] ?? '');
        if ($name === '' || $location === '') Response::error('Venue name and location are required.', 400);
        $this->venueModel->updateVenue($id, $name, $location);
        $this->auditLog->log($user['user_id'], 'UPDATE_VENUE', 'VENUE_MGMT', "Updated venue ID {$id}.");
        Response::success('Venue updated successfully');
    }

    public function destroyVenue(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin', 'tournament_organizer']);
        if (!$this->venueModel->getById($id)) Response::error('Venue not found.', 404);
        $this->venueModel->deleteVenue($id);
        $this->auditLog->log($user['user_id'], 'DELETE_VENUE', 'VENUE_MGMT', "Deleted venue ID {$id}.");
        Response::success('Venue deleted successfully');
    }

    public function storeCourt(): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin', 'tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);
        $venueId = (int) ($input['venue_id'] ?? 0);
        $courtName = trim($input['court_name'] ?? '');
        if (!$venueId || !$this->venueModel->getById($venueId)) Response::error('A valid venue is required.', 400);
        if ($courtName === '') Response::error('Court name is required.', 400);
        $sportId = empty($input['sport_id']) ? null : (int) $input['sport_id'];
        $id = $this->venueModel->createCourt($venueId, $courtName, $sportId, (bool)($input['is_available'] ?? true));
        $this->auditLog->log($user['user_id'], 'CREATE_COURT', 'VENUE_MGMT', "Created court '{$courtName}' (ID: {$id}).");
        Response::success('Court created successfully', ['id' => $id], 201);
    }

    public function updateCourt(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin', 'tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);
        $courtName = trim($input['court_name'] ?? '');
        if ($courtName === '') Response::error('Court name is required.', 400);
        $sportId = empty($input['sport_id']) ? null : (int) $input['sport_id'];
        $this->venueModel->updateCourt($id, $courtName, $sportId, (bool)($input['is_available'] ?? true));
        $this->auditLog->log($user['user_id'], 'UPDATE_COURT', 'VENUE_MGMT', "Updated court ID {$id}.");
        Response::success('Court updated successfully');
    }

    public function destroyCourt(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin', 'tournament_organizer']);
        $this->venueModel->deleteCourt($id);
        $this->auditLog->log($user['user_id'], 'DELETE_COURT', 'VENUE_MGMT', "Deleted court ID {$id}.");
        Response::success('Court deleted successfully');
    }

    public function reviewVenue(int $id): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        if(!$this->venueModel->getById($id)) Response::error('Venue not found.',404);
        $input=json_decode(file_get_contents('php://input'),true) ?: [];
        $status=$input['status'] ?? '';
        if(!in_array($status,['approved','rejected','suspended'],true)) Response::error('Approval status must be approved, rejected, or suspended.',422);
        $notes=trim((string)($input['notes'] ?? '')) ?: null;
        $this->venueModel->reviewVenue($id,$status,(int)$user['user_id'],$notes);
        $this->auditLog->log((int)$user['user_id'],'REVIEW_VENUE','VENUE_OVERSIGHT',"Set venue {$id} to {$status}.");
        Response::success('Venue review saved');
    }
}

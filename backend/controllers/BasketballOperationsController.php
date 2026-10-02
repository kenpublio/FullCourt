<?php

require_once __DIR__ . '/../models/BasketballOperations.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class BasketballOperationsController {
    private BasketballOperations $model;
    private AuditLog $audit;

    public function __construct() {
        $this->model = new BasketballOperations();
        $this->audit = new AuditLog();
    }

    public function organizations(): void {
        $user = AuthMiddleware::authenticate();
        Response::success('Organizations retrieved', ['organizations'=>$this->model->organizationsForUser((int)$user['user_id'], $user['role'])]);
    }

    public function createOrganization(): void {
        $user = AuthMiddleware::authorizeRoles(['organization_admin','tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($input['name']) || empty($input['organization_type']) || empty($input['slug'])) {
            Response::error('Organization name, type, and public slug are required.', 422);
        }
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $input['slug'])) {
            Response::error('Public slug must contain lowercase letters, numbers, and hyphens only.', 422);
        }
        $id = $this->model->createOrganization($input, (int)$user['user_id']);
        $this->audit->log((int)$user['user_id'], 'APPLY_ORGANIZATION', 'ORGANIZATIONS', "Created organization application ID {$id}.");
        Response::success('Organization application submitted', ['id'=>$id], 201);
    }

    public function reviewOrganization(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $status = $input['status'] ?? '';
        if (!in_array($status, ['active','suspended','rejected'], true)) Response::error('Invalid organization status.', 422);
        $this->model->reviewOrganization($id, $status, (int)$user['user_id'], $input['notes'] ?? null);
        $this->audit->log((int)$user['user_id'], 'REVIEW_ORGANIZATION', 'ORGANIZATIONS', "Set organization {$id} to {$status}.");
        Response::success('Organization status updated');
    }

    public function divisions(int $tournamentId): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($tournamentId,$user);
        Response::success('Divisions retrieved', ['divisions'=>$this->model->divisions($tournamentId)]);
    }

    public function createDivision(int $tournamentId): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);
        OrganizationAccess::requireTournament($tournamentId,$user);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($input['name'])) Response::error('Division name is required.', 422);
        $minimum = ($input['min_age'] ?? '') === '' ? null : (int)$input['min_age'];
        $maximum = ($input['max_age'] ?? '') === '' ? null : (int)$input['max_age'];
        if ($minimum !== null && ($minimum < 0 || $minimum > 99)) Response::error('Minimum age must be between 0 and 99.', 422);
        if ($maximum !== null && ($maximum < 0 || $maximum > 99)) Response::error('Maximum age must be between 0 and 99.', 422);
        if ($minimum !== null && $maximum !== null && $minimum > $maximum) Response::error('Minimum age cannot be greater than maximum age.', 422);
        if (!empty($input['age_cutoff_date']) && !DateTimeImmutable::createFromFormat('Y-m-d', (string)$input['age_cutoff_date'])) Response::error('Age cutoff date must be a valid date.', 422);
        $id = $this->model->createDivision($tournamentId, $input);
        $this->audit->log((int)$user['user_id'], 'CREATE_DIVISION', 'TOURNAMENT_MGMT', "Created division {$id} for tournament {$tournamentId}.");
        Response::success('Division created', ['id'=>$id], 201);
    }

    public function dashboard(): void {
        $user = AuthMiddleware::authenticate();
        Response::success('Basketball dashboard retrieved', $this->model->dashboard((int)$user['user_id'], $user['role']));
    }
}

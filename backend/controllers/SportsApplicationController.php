<?php

require_once __DIR__ . '/../models/SportsApplication.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class SportsApplicationController {
    private SportsApplication $model;
    public function __construct() { $this->model = new SportsApplication(); }

    public function options(): void {
        $user = AuthMiddleware::authorizeRoles(['player']);
        Response::success('Available sports retrieved', ['sports'=>$this->model->getOptionsForPlayer((int)$user['user_id'])]);
    }

    public function apply(): void {
        $auth = AuthMiddleware::authorizeRoles(['player']);
        $input = json_decode(file_get_contents('php://input'), true);
        $teamId = (int)($input['team_id'] ?? 0);
        if (!$teamId) Response::error('Select a sport and team before applying.', 400);
        $categoryId = isset($input['category_id']) ? (int)$input['category_id'] : null;
        $user = (new User())->findById((int)$auth['user_id']);
        try { $id = $this->model->apply($teamId, (int)$auth['user_id'], (string)$user['student_faculty_id'], $categoryId); }
        catch (Exception $e) { Response::error($e->getMessage(), 409); }
        Response::success('Application submitted. Waiting for coach approval.', ['application_id'=>$id], 201);
    }

    public function coachApplications(): void {
        $user = AuthMiddleware::authorizeRoles(['coach_manager']);
        Response::success('Player applications retrieved', ['applications'=>$this->model->getForCoach((int)$user['user_id'])]);
    }

    public function myUpdates(): void {
        $user = AuthMiddleware::authorizeRoles(['player']);
        Response::success('Application updates retrieved', [
            'updates' => $this->model->getUpdatesForPlayer((int) $user['user_id'])
        ]);
    }

    public function respond(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['coach_manager']);
        $input = json_decode(file_get_contents('php://input'), true);
        $decision = $input['decision'] ?? '';
        if (!in_array($decision,['approve','reject'],true)) Response::error('Choose approve or reject.',400);
        $ok = $this->model->respond($id,(int)$user['user_id'],$decision==='approve'?'verified':'rejected');
        if (!$ok) Response::error('Application is unavailable or the team has no remaining slots.',409);
        Response::success($decision==='approve'?'Player approved and added to the team.':'Player application rejected.');
    }
}

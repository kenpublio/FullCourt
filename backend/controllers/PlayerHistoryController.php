<?php
// backend/controllers/PlayerHistoryController.php

require_once __DIR__ . '/../models/PlayerHistory.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class PlayerHistoryController {
    private PlayerHistory $model;

    public function __construct() { $this->model = new PlayerHistory(); }

    public function myHistory(): void {
        $user = AuthMiddleware::authorizeRoles(['player']);
        Response::success('Sports history retrieved', ['history' => $this->model->forUser((int) $user['user_id'])]);
    }
}
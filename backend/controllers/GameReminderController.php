<?php
require_once __DIR__ . '/../models/GameReminder.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
class GameReminderController {
    public function dispatch():void {
        AuthMiddleware::authorizeRoles(['platform_admin','admin']);
        Response::success('Due 30-minute reminders dispatched',(new GameReminder())->dispatchDue(null,true));
    }
}

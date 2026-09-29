<?php
require_once __DIR__ . '/../models/GameReminder.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';
require_once __DIR__ . '/../utils/response.php';
class GameReminderController {
    public function dispatch():void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);
        Response::success('Due 30-minute reminders dispatched',(new GameReminder())->dispatchDue((int)$user['user_id'],OrganizationAccess::isPlatform($user)));
    }
}

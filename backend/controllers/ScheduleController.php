<?php
// backend/controllers/ScheduleController.php

require_once __DIR__ . '/../models/Schedule.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/NotificationMailer.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class ScheduleController {
    private Schedule $scheduleModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->scheduleModel = new Schedule();
        $this->auditLog = new AuditLog();
    }

    public function autoSchedule(int $tournamentId): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        OrganizationAccess::requireTournament($tournamentId,$user);
        $input = json_decode(file_get_contents('php://input'), true);

        $startDate = $input['start_date'] ?? date('Y-m-d');
        $startTime = $input['start_time'] ?? '08:00:00';

        try {
            $result = $this->scheduleModel->autoSchedule($tournamentId, $startDate, $startTime);
            $this->auditLog->log($user['user_id'], 'AUTO_SCHEDULE', 'SCHEDULING', "Generated conflict-free schedule for tournament ID {$tournamentId}.");
            Response::success('Schedule optimization complete', $result);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function show(int $tournamentId): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($tournamentId,$user);
        $schedule = $this->scheduleModel->getMasterSchedule($tournamentId);
        Response::success('Tournament schedule retrieved', ['schedule' => $schedule]);
    }

    // POST /tournaments/{id}/schedule/conflicts
    public function conflicts(int $tournamentId): void {
        $user=AuthMiddleware::authenticate();OrganizationAccess::requireTournament($tournamentId,$user);
        $result = $this->scheduleModel->detectConflicts($tournamentId);
        Response::success('Schedule conflicts analyzed', $result);
    }

    // PUT /matches/{id}/slot  { scheduled_start_time, court_id }
    public function updateSlot(int $matchId): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        OrganizationAccess::requireMatch($matchId,$user);
        $input = json_decode(file_get_contents('php://input'), true);
        $start = $input['scheduled_start_time'] ?? null;
        $courtId = isset($input['court_id']) ? (int)$input['court_id'] : null;
        if (!$start) Response::error('scheduled_start_time is required.', 400);
        try {
            $result = $this->scheduleModel->updateMatchSlot($matchId, $start, $courtId);
            $this->auditLog->log($user['user_id'], 'UPDATE_MATCH_SLOT', 'SCHEDULING', "Rescheduled match ID {$matchId} to {$start}");
            Response::success('Match slot updated', $result);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    // POST /tournaments/{id}/schedule/constraints  { max_games_per_team_per_day, min_rest_minutes_between_games, default_match_duration_minutes, default_break_minutes }
    public function saveConstraints(int $tournamentId): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        OrganizationAccess::requireTournament($tournamentId,$user);
        $input = json_decode(file_get_contents('php://input'), true);
        $c = [
            'max_games_per_team_per_day' => $input['max_games_per_team_per_day'] ?? 2,
            'min_rest_minutes_between_games' => $input['min_rest_minutes_between_games'] ?? 120,
            'default_match_duration_minutes' => $input['default_match_duration_minutes'] ?? 0,
            'default_break_minutes' => $input['default_break_minutes'] ?? 15,
        ];
        // If duration not supplied, fall back to the sport default already stored.
        if (empty($c['default_match_duration_minutes'])) {
            $c['default_match_duration_minutes'] = null;
        }
        $this->scheduleModel->saveConstraints($tournamentId, $c);
        $this->auditLog->log($user['user_id'], 'SAVE_SCHEDULE_CONSTRAINTS', 'SCHEDULING', "Updated scheduling constraints for tournament ID {$tournamentId}.");
        Response::success('Scheduling constraints saved');
    }

    public function publish(int $tournamentId): void {
        $user=AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);
        OrganizationAccess::requireTournament($tournamentId,$user);
        $conflicts=$this->scheduleModel->detectConflicts($tournamentId);
        $total=count($conflicts['court_clashes']??[])+count($conflicts['team_clashes']??[])+count($conflicts['venue_violations']??[]);
        if($total>0)Response::error('Resolve all schedule conflicts before publication.',409,$conflicts);
        $count=$this->scheduleModel->publish($tournamentId);
        $this->auditLog->log((int)$user['user_id'],'PUBLISH_SCHEDULE','SCHEDULING',"Published {$count} games for tournament {$tournamentId}.");
        $email=(new NotificationMailer())->sendToTournamentParticipants($tournamentId,'Tournament schedule published','The official tournament schedule is now available. Review your game dates, times, venues, and assigned courts.','/schedules');
        Response::success('Schedule published and participants notified',array_merge(['published_games'=>$count],$email));
    }
}

<?php
// backend/routes/api.php

require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/UserController.php';
require_once __DIR__ . '/../controllers/TournamentController.php';
require_once __DIR__ . '/../controllers/TeamController.php';
require_once __DIR__ . '/../controllers/EligibilityController.php';
require_once __DIR__ . '/../controllers/BracketController.php';
require_once __DIR__ . '/../controllers/ScheduleController.php';
require_once __DIR__ . '/../controllers/ScoringController.php';
require_once __DIR__ . '/../controllers/PaymentController.php';
require_once __DIR__ . '/../controllers/AttendanceController.php';
require_once __DIR__ . '/../controllers/GameDayOperationsController.php';
require_once __DIR__ . '/../controllers/NewsController.php';
require_once __DIR__ . '/../controllers/EventCategoryController.php';
require_once __DIR__ . '/../controllers/PlayerHistoryController.php';
require_once __DIR__ . '/../controllers/AnnouncementController.php';
require_once __DIR__ . '/../controllers/ReportController.php';
require_once __DIR__ . '/../controllers/PublicController.php';
require_once __DIR__ . '/../controllers/SportsApplicationController.php';
require_once __DIR__ . '/../controllers/VenueController.php';
require_once __DIR__ . '/../controllers/ScorekeeperController.php';
require_once __DIR__ . '/../controllers/BasketballOperationsController.php';
require_once __DIR__ . '/../controllers/GameOperationsController.php';
require_once __DIR__ . '/../controllers/EngagementController.php';
require_once __DIR__ . '/../controllers/PdfReportController.php';
require_once __DIR__ . '/../controllers/BasketballAnalyticsController.php';
require_once __DIR__ . '/../controllers/EligibilityDocumentController.php';
require_once __DIR__ . '/../controllers/GameReminderController.php';
require_once __DIR__ . '/../controllers/PlatformSettingsController.php';
require_once __DIR__ . '/../utils/response.php';

function routeRequest(string $uri, string $method) {
    $path = parse_url($uri, PHP_URL_PATH);
    $path = rtrim($path, '/');

    $path = str_replace('/backend/index.php', '', $path);
    $path = str_replace('/backend', '', $path);

    if (str_starts_with($path, '/api')) {
        $path = substr($path, 4);
    }

    if ($path === '/health' || $path === '' || $path === '/status') {
        Response::success('FullCourt API is running smoothly', [
            'system' => 'FullCourt Operations API',
            'version' => '2.0.0',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    }

    // 1. Auth Routes
    if ($path === '/public/portal' && $method === 'GET') { (new PublicController())->portal(); return; }
    if ($path === '/public/platform-settings' && $method === 'GET') { (new PlatformSettingsController())->show(); return; }
    if ($path === '/platform-settings' && $method === 'PUT') { (new PlatformSettingsController())->update(); return; }
    if (preg_match('#^/public/organizations/([a-z0-9-]+)$#', $path, $m) && $method === 'GET') { (new PublicController())->organization($m[1]); return; }
    if (preg_match('#^/public/tournaments/(\d+)$#', $path, $m) && $method === 'GET') { (new PublicController())->tournament((int)$m[1]); return; }
    if (preg_match('#^/public/tournaments/(\d+)/bracket$#', $path, $m) && $method === 'GET') { (new PublicController())->bracket((int)$m[1]); return; }
    if (preg_match('#^/public/tournaments/(\d+)/schedule$#', $path, $m) && $method === 'GET') { (new PublicController())->schedule((int)$m[1]); return; }
    if ($path === '/public/schedule' && $method === 'GET') { (new PublicController())->dailySchedule(); return; }
    if ($path === '/public/venues' && $method === 'GET') { (new PublicController())->venues(); return; }
    if (preg_match('#^/public/matches/(\d+)/live$#', $path, $m) && $method === 'GET') { (new PublicController())->liveMatch((int)$m[1]); return; }
    if (preg_match('#^/public/matches/(\d+)/details$#', $path, $m) && $method === 'GET') { (new PublicController())->matchDetails((int)$m[1]); return; }
    if ($path === '/sports/applications' && $method === 'GET') { (new SportsApplicationController())->options(); return; }
    if ($path === '/sports/applications' && $method === 'POST') { (new SportsApplicationController())->apply(); return; }
    if ($path === '/sports/applications/coach' && $method === 'GET') { (new SportsApplicationController())->coachApplications(); return; }
    if ($path === '/sports/applications/updates' && $method === 'GET') { (new SportsApplicationController())->myUpdates(); return; }
    if (preg_match('#^/sports/applications/(\d+)/respond$#', $path, $m) && $method === 'PUT') { (new SportsApplicationController())->respond((int)$m[1]); return; }
    if ($path === '/auth/login' && $method === 'POST') { (new AuthController())->login(); return; }
    if ($path === '/auth/register' && $method === 'POST') { (new AuthController())->register(); return; }
    if ($path === '/auth/email-code' && $method === 'POST') { (new AuthController())->requestEmailCode(); return; }
    if ($path === '/auth/forgot-password' && $method === 'POST') { (new AuthController())->forgotPassword(); return; }
    if ($path === '/auth/verify-reset-code' && $method === 'POST') { (new AuthController())->verifyPasswordResetCode(); return; }
    if ($path === '/auth/verify-email-code' && $method === 'POST') { (new AuthController())->verifyRegistrationCode(); return; }
    if ($path === '/auth/reset-password' && $method === 'POST') { (new AuthController())->resetPassword(); return; }
    if ($path === '/auth/change-password' && $method === 'POST') { (new AuthController())->changePassword(); return; }
    if ($path === '/auth/me' && $method === 'GET') { (new AuthController())->me(); return; }
    if ($path === '/auth/refresh' && $method === 'POST') { (new AuthController())->refresh(); return; }
    if ($path === '/auth/logout' && $method === 'POST') { (new AuthController())->logout(); return; }

    // 2. User & Role Routes
    if ($path === '/operations/dashboard' && $method === 'GET') { (new BasketballOperationsController())->dashboard(); return; }
    if ($path === '/organizations' && $method === 'GET') { (new BasketballOperationsController())->organizations(); return; }
    if ($path === '/organizations' && $method === 'POST') { (new BasketballOperationsController())->createOrganization(); return; }
    if (preg_match('#^/organizations/(\d+)/review$#', $path, $m) && $method === 'PUT') { (new BasketballOperationsController())->reviewOrganization((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/divisions$#', $path, $m) && $method === 'GET') { (new BasketballOperationsController())->divisions((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/divisions$#', $path, $m) && $method === 'POST') { (new BasketballOperationsController())->createDivision((int)$m[1]); return; }
    if ($path === '/users' && $method === 'GET') { (new UserController())->index(); return; }
    if ($path === '/users/audit-logs' && $method === 'GET') { (new UserController())->getAuditLogs(); return; }
    if ($path === '/users/profile' && $method === 'PUT') { (new UserController())->updateProfile(); return; }
    if ($path === '/users/profile/photo' && $method === 'POST') { (new UserController())->uploadPhoto(); return; }
    if (preg_match('#^/users/(\d+)/role$#', $path, $m) && $method === 'PUT') { (new UserController())->updateRole((int)$m[1]); return; }
    if (preg_match('#^/users/(\d+)/status$#', $path, $m) && $method === 'PUT') { (new UserController())->toggleStatus((int)$m[1]); return; }
    if (preg_match('#^/users/(\d+)$#', $path, $m) && $method === 'PUT') { (new UserController())->update((int)$m[1]); return; }
    if (preg_match('#^/users/(\d+)$#', $path, $m) && $method === 'DELETE') { (new UserController())->remove((int)$m[1]); return; }

    // 3. Tournament Routes
    if ($path === '/tournaments' && $method === 'GET') { (new TournamentController())->index(); return; }
    if ($path === '/tournaments' && $method === 'POST') { (new TournamentController())->store(); return; }
    if (preg_match('#^/tournaments/(\d+)$#', $path, $m) && $method === 'GET') { (new TournamentController())->show((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)$#', $path, $m) && $method === 'PUT') { (new TournamentController())->update((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)$#', $path, $m) && $method === 'DELETE') { (new TournamentController())->destroy((int)$m[1]); return; }

    // 4. Team Routes
    if ($path === '/teams' && $method === 'GET') { (new TeamController())->index(); return; }
    if ($path === '/teams' && $method === 'POST') { (new TeamController())->store(); return; }
    if (preg_match('#^/teams/(\d+)$#', $path, $m) && $method === 'PUT') { (new TeamController())->update((int)$m[1]); return; }
    if (preg_match('#^/teams/(\d+)$#', $path, $m) && $method === 'DELETE') { (new TeamController())->destroy((int)$m[1]); return; }
    if (preg_match('#^/teams/(\d+)/players$#', $path, $m) && $method === 'GET') { (new TeamController())->players((int)$m[1]); return; }
    if (preg_match('#^/teams/(\d+)/logo$#', $path, $m) && $method === 'POST') { (new TeamController())->uploadLogo((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/teams$#', $path, $m) && $method === 'GET') { (new TeamController())->getByTournament((int)$m[1]); return; }

    // 5. Eligibility & Player Routes
    if ($path === '/eligibility' && $method === 'GET') { (new EligibilityController())->index(); return; }
    if ($path === '/eligibility/me' && $method === 'GET') { (new EligibilityController())->myMembership(); return; }
    if ($path === '/eligibility/invitations' && $method === 'GET') { (new EligibilityController())->myInvitations(); return; }
    if (preg_match('#^/eligibility/invitations/(\d+)/respond$#', $path, $m) && $method === 'PUT') { (new EligibilityController())->respondToInvitation((int)$m[1]); return; }
    if ($path === '/eligibility/add-player' && $method === 'POST') { (new EligibilityController())->addPlayer(); return; }
    if (preg_match('#^/eligibility/(\d+)$#', $path, $m) && $method === 'PUT') { (new EligibilityController())->verify((int)$m[1]); return; }
    if (preg_match('#^/eligibility/(\d+)/roster$#', $path, $m) && $method === 'PUT') { (new EligibilityController())->updateRoster((int)$m[1]); return; }
    if (preg_match('#^/eligibility/(\d+)/documents$#', $path, $m) && $method === 'GET') { (new EligibilityDocumentController())->index((int)$m[1]); return; }
    if (preg_match('#^/eligibility/(\d+)/documents$#', $path, $m) && $method === 'POST') { (new EligibilityDocumentController())->upload((int)$m[1]); return; }
    if (preg_match('#^/eligibility/documents/(\d+)/download$#', $path, $m) && $method === 'GET') { (new EligibilityDocumentController())->download((int)$m[1]); return; }
    if (preg_match('#^/eligibility/documents/(\d+)/selfie$#', $path, $m) && $method === 'GET') { (new EligibilityDocumentController())->download((int)$m[1],true); return; }
    if (preg_match('#^/eligibility/documents/(\d+)/review$#', $path, $m) && $method === 'PUT') { (new EligibilityDocumentController())->review((int)$m[1]); return; }

    // 6. Bracket Engine Routes
    if (preg_match('#^/tournaments/(\d+)/bracket/generate$#', $path, $m) && $method === 'POST') { (new BracketController())->generate((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/bracket$#', $path, $m) && $method === 'GET') { (new BracketController())->show((int)$m[1]); return; }

    // 7. Schedule Routes
    if (preg_match('#^/tournaments/(\d+)/schedule/auto$#', $path, $m) && $method === 'POST') { (new ScheduleController())->autoSchedule((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/schedule$#', $path, $m) && $method === 'GET') { (new ScheduleController())->show((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/schedule/conflicts$#', $path, $m) && $method === 'POST') { (new ScheduleController())->conflicts((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/schedule/constraints$#', $path, $m) && $method === 'POST') { (new ScheduleController())->saveConstraints((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/schedule/publish$#', $path, $m) && $method === 'POST') { (new ScheduleController())->publish((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/slot$#', $path, $m) && $method === 'PUT') { (new ScheduleController())->updateSlot((int)$m[1]); return; }

    // 8. Live Scoring Routes
    if ($path === '/game-assignments' && $method === 'GET') { (new GameOperationsController())->assignments(); return; }
    if (preg_match('#^/matches/(\d+)/assignments$#', $path, $m) && $method === 'POST') { (new GameOperationsController())->assign((int)$m[1]); return; }
    if (preg_match('#^/game-assignments/(\d+)/respond$#', $path, $m) && $method === 'PUT') { (new GameOperationsController())->respond((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/lineup$#', $path, $m) && $method === 'PUT') { (new GameOperationsController())->lineup((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/lineup$#', $path, $m) && $method === 'GET') { (new GameOperationsController())->getLineup((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/substitutions$#', $path, $m) && $method === 'POST') { (new GameOperationsController())->substitute((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/basketball-stats$#', $path, $m) && $method === 'POST') { (new GameOperationsController())->stat((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/basketball-stats/(\d+)$#', $path, $m) && $method === 'DELETE') { (new GameOperationsController())->voidStat((int)$m[1],(int)$m[2]); return; }
    if (preg_match('#^/matches/(\d+)/box-score$#', $path, $m) && $method === 'GET') { (new GameOperationsController())->boxScore((int)$m[1]); return; }
    if ($path === '/score-corrections' && $method === 'GET') { (new GameOperationsController())->corrections(); return; }
    if (preg_match('#^/matches/(\d+)/score-corrections$#', $path, $m) && $method === 'POST') { (new GameOperationsController())->requestCorrection((int)$m[1]); return; }
    if (preg_match('#^/score-corrections/(\d+)/review$#', $path, $m) && $method === 'PUT') { (new GameOperationsController())->reviewCorrection((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/score$#', $path, $m) && $method === 'GET') { (new ScoringController())->getScore((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/score$#', $path, $m) && $method === 'POST') { (new ScoringController())->updateScore((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/finalize$#', $path, $m) && $method === 'POST') { (new ScoringController())->finalizeMatch((int)$m[1]); return; }

    // 9. Payment Routes
    if ($path === '/payments' && $method === 'GET') { (new PaymentController())->index(); return; }
    if ($path === '/payments' && $method === 'POST') { (new PaymentController())->submit(); return; }
    if (preg_match('#^/payments/(\d+)/verify$#', $path, $m) && $method === 'PUT') { (new PaymentController())->verify((int)$m[1]); return; }
    if (preg_match('#^/payments/(\d+)/receipt$#', $path, $m) && $method === 'POST') { (new PaymentController())->uploadReceipt((int)$m[1]); return; }

    // 10. QR Attendance Routes
    if ($path === '/attendance/scan' && $method === 'POST') { (new AttendanceController())->scan(); return; }
    if (preg_match('#^/matches/(\d+)/attendance$#', $path, $m) && $method === 'GET') { (new AttendanceController())->getMatchAttendance((int)$m[1]); return; }
    if (preg_match('#^/teams/(\d+)/qr$#', $path, $m) && $method === 'GET') { (new AttendanceController())->teamQr((int)$m[1]); return; }
    if (preg_match('#^/game-assignments/(\d+)/access-qr$#', $path, $m) && $method === 'POST') { (new AttendanceController())->issueOfficial((int)$m[1]); return; }
    if ($path === '/game-access/validate' && $method === 'POST') { (new AttendanceController())->validateOfficial(); return; }
    if (preg_match('#^/tournaments/(\d+)/game-day$#', $path, $m) && $method === 'GET') { (new GameDayOperationsController())->index((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/readiness$#', $path, $m) && $method === 'PUT') { (new GameDayOperationsController())->readiness((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/incidents$#', $path, $m) && $method === 'POST') { (new GameDayOperationsController())->incident((int)$m[1]); return; }
    if (preg_match('#^/game-incidents/(\d+)/resolve$#', $path, $m) && $method === 'PUT') { (new GameDayOperationsController())->resolve((int)$m[1]); return; }

    // 11. Player Portal: News, Events, History, Announcements
    if ($path === '/public/news' && $method === 'GET') { (new NewsController())->indexPublished(); return; }
    if (preg_match('#^/public/news/(\d+)$#', $path, $m) && $method === 'GET') { (new NewsController())->showPublished((int)$m[1]); return; }
    if ($path === '/public/sports' && $method === 'GET') { (new EventCategoryController())->sportsPublic(); return; }
    if ($path === '/public/announcements' && $method === 'GET') { (new AnnouncementController())->indexPublished(); return; }
    if ($path === '/news' && $method === 'GET') { (new NewsController())->all(); return; }
    if ($path === '/news' && $method === 'POST') { (new NewsController())->create(); return; }
    if (preg_match('#^/news/(\d+)$#', $path, $m) && $method === 'PUT') { (new NewsController())->update((int)$m[1]); return; }
    if (preg_match('#^/news/(\d+)$#', $path, $m) && $method === 'DELETE') { (new NewsController())->delete((int)$m[1]); return; }
    if ($path === '/players/history' && $method === 'GET') { (new PlayerHistoryController())->myHistory(); return; }

    // 11. Reports & Analytics Routes
    if ($path === '/notifications' && $method === 'GET') { (new EngagementController())->notifications(); return; }
    if ($path === '/notifications/game-reminders/dispatch' && $method === 'POST') { (new GameReminderController())->dispatch(); return; }
    if ($path === '/notifications/read-all' && $method === 'PUT') { (new EngagementController())->readAll(); return; }
    if (preg_match('#^/notifications/(\d+)/read$#', $path, $m) && $method === 'PUT') { (new EngagementController())->read((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/awards$#', $path, $m) && $method === 'GET') { (new EngagementController())->awards((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/awards/recommend$#', $path, $m) && $method === 'POST') { (new EngagementController())->recommend((int)$m[1]); return; }
    if (preg_match('#^/awards/(\d+)/confirm$#', $path, $m) && $method === 'PUT') { (new EngagementController())->confirm((int)$m[1]); return; }
    if ($path === '/analytics/dashboard' && $method === 'GET') { (new ReportController())->getAnalytics(); return; }
    if ($path === '/analytics/live-games' && $method === 'GET') { (new BasketballAnalyticsController())->liveGames(); return; }
    if (preg_match('#^/analytics/players/(\d+)$#', $path, $m) && $method === 'GET') { (new BasketballAnalyticsController())->player((int)$m[1]); return; }
    if (preg_match('#^/analytics/teams/(\d+)$#', $path, $m) && $method === 'GET') { (new BasketballAnalyticsController())->team((int)$m[1]); return; }
    if (preg_match('#^/analytics/matches/(\d+)/outlook$#', $path, $m) && $method === 'GET') { (new BasketballAnalyticsController())->outlook((int)$m[1]); return; }
    if (preg_match('#^/tournaments/(\d+)/standings$#', $path, $m) && $method === 'GET') { (new ReportController())->getStandings((int)$m[1]); return; }
    if ($path === '/reports/generate' && $method === 'POST') { (new ReportController())->generateReport(); return; }
    if ($path === '/reports/log' && $method === 'GET') { (new ReportController())->reportLog(); return; }
    if (preg_match('#^/reports/tournaments/(\d+)\.pdf$#', $path, $m) && $method === 'GET') { (new PdfReportController())->tournament((int)$m[1]); return; }
    if (preg_match('#^/reports/matches/(\d+)/score-sheet\.pdf$#', $path, $m) && $method === 'GET') { (new PdfReportController())->scoreSheet((int)$m[1]); return; }

    // 12. Venue & Court Management Routes
    if ($path === '/venues' && $method === 'GET') { (new VenueController())->index(); return; }
    if ($path === '/venues' && $method === 'POST') { (new VenueController())->storeVenue(); return; }
    if (preg_match('#^/venues/(\d+)$#', $path, $m) && $method === 'GET') { (new VenueController())->show((int)$m[1]); return; }
    if (preg_match('#^/venues/(\d+)$#', $path, $m) && $method === 'PUT') { (new VenueController())->updateVenue((int)$m[1]); return; }
    if (preg_match('#^/venues/(\d+)$#', $path, $m) && $method === 'DELETE') { (new VenueController())->destroyVenue((int)$m[1]); return; }
    if (preg_match('#^/venues/(\d+)/review$#', $path, $m) && $method === 'PUT') { (new VenueController())->reviewVenue((int)$m[1]); return; }
    if ($path === '/courts' && $method === 'POST') { (new VenueController())->storeCourt(); return; }
    if (preg_match('#^/courts/(\d+)$#', $path, $m) && $method === 'PUT') { (new VenueController())->updateCourt((int)$m[1]); return; }
    if (preg_match('#^/courts/(\d+)$#', $path, $m) && $method === 'DELETE') { (new VenueController())->destroyCourt((int)$m[1]); return; }

    // 13. Scorekeeper Portal Routes
    if ($path === '/scorekeeper/assigned' && $method === 'GET') { (new ScorekeeperController())->assigned(); return; }
    if (preg_match('#^/matches/(\d+)/scoreboard$#', $path, $m) && $method === 'GET') { (new ScorekeeperController())->scoreboard((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/events$#', $path, $m) && $method === 'POST') { (new ScorekeeperController())->recordEvent((int)$m[1]); return; }
    if (preg_match('#^/matches/(\d+)/events/(\d+)$#', $path, $m) && $method === 'DELETE') { (new ScorekeeperController())->undoEvent((int)$m[1], (int)$m[2]); return; }
    if (preg_match('#^/matches/(\d+)/assign-scorekeeper$#', $path, $m) && $method === 'POST') { (new ScorekeeperController())->assign((int)$m[1]); return; }

    Response::error("Endpoint '{$path}' [{$method}] not found.", 404);
}

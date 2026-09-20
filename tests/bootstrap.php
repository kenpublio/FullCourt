<?php
// tests/bootstrap.php
// PHPUnit bootstrap. Loads the project's manual require_once dependencies
// (the project does not ship a Composer autoloader / vendor/autoload.php).
$base = dirname(__DIR__) . '/backend';
require_once $base . '/config/database.php';
require_once $base . '/utils/response.php';
require_once $base . '/utils/jwt.php';
require_once $base . '/middleware/auth.php';
require_once $base . '/models/Bracket.php';
require_once $base . '/models/Schedule.php';
require_once $base . '/models/Scorekeeper.php';
require_once $base . '/models/MatchScore.php';
require_once $base . '/models/Team.php';
require_once $base . '/models/Tournament.php';
require_once $base . '/models/AuditLog.php';
require_once $base . '/models/User.php';
require_once $base . '/controllers/ScorekeeperController.php';
require_once $base . '/controllers/ScheduleController.php';
require_once $base . '/controllers/BracketController.php';
require_once $base . '/controllers/PublicController.php';
require_once $base . '/controllers/ReportController.php';
require_once $base . '/controllers/ScoringController.php';

<?php

$api = file_get_contents(__DIR__ . '/../backend/routes/api.php');
$controller = file_get_contents(__DIR__ . '/../backend/controllers/ScorekeeperController.php');

function expectContains(string $source, string $needle): void {
    if (!str_contains($source, $needle)) throw new RuntimeException("Missing API contract: {$needle}");
}

$routes = [
    'scorekeeper/assigned', '/matches/(\d+)/scoreboard', '/matches/(\d+)/events',
    '/matches/(\d+)/assign-scorekeeper', '/tournaments/(\d+)/schedule/conflicts',
    '/tournaments/(\d+)/schedule/constraints', '/matches/(\d+)/slot',
    '/reports/generate', '/reports/log', '/reports/tournaments/(\d+)\.pdf',
    '/reports/matches/(\d+)/score-sheet\.pdf', '/operations/dashboard',
    '/tournaments/(\d+)/divisions', '/game-assignments', '/matches/(\d+)/lineup',
    '/matches/(\d+)/basketball-stats', '/matches/(\d+)/box-score',
    '/score-corrections', '/notifications', '/tournaments/(\d+)/awards',
    '/analytics/teams/(\d+)', '/analytics/matches/(\d+)/outlook',
    '/eligibility/(\d+)/documents', '/tournaments/(\d+)/schedule/publish',
    '/public/tournaments/(\d+)/bracket', '/public/tournaments/(\d+)/schedule',
    '/public/venues', '/public/matches/(\d+)/live',
];
foreach ($routes as $route) expectContains($api, $route);
foreach (['function assigned()', 'function scoreboard(int $matchId)', 'function recordEvent(int $matchId)', 'function undoEvent(int $matchId, int $eventId)', 'function assign(int $matchId)'] as $signature) expectContains($controller, $signature);

echo "Route definitions: PASS\n";

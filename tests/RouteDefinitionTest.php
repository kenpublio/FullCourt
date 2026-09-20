<?php
// tests/RouteDefinitionTest.php
// Static tests asserting the API contract for the new advanced-module endpoints.
// These do not require a database or HTTP layer; they guard route definitions
// against accidental removal/regression.

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;

final class RouteDefinitionTest extends TestCase {
    private string $apiSource;

    protected function setUp(): void {
        $this->apiSource = file_get_contents(__DIR__ . '/../backend/routes/api.php');
    }

    #[Test]
    public function scorekeeper_routes_are_registered(): void {
        $this->assertStringContainsString('scorekeeper/assigned', $this->apiSource);
        $this->assertStringContainsString('/matches/(\d+)/scoreboard', $this->apiSource);
        $this->assertStringContainsString('/matches/(\d+)/events', $this->apiSource);
        $this->assertStringContainsString('/matches/(\d+)/events/(\d+)', $this->apiSource);
        $this->assertStringContainsString('/matches/(\d+)/assign-scorekeeper', $this->apiSource);
    }

    #[Test]
    public function scheduling_routes_are_registered(): void {
        $this->assertStringContainsString('/tournaments/(\d+)/schedule/conflicts', $this->apiSource);
        $this->assertStringContainsString('/tournaments/(\d+)/schedule/constraints', $this->apiSource);
        $this->assertStringContainsString('/matches/(\d+)/slot', $this->apiSource);
    }

    #[Test]
    public function reports_routes_are_registered(): void {
        $this->assertStringContainsString('/reports/generate', $this->apiSource);
        $this->assertStringContainsString('/reports/log', $this->apiSource);
        $this->assertStringContainsString('/reports/tournaments/(\d+)\.pdf', $this->apiSource);
        $this->assertStringContainsString('/reports/matches/(\d+)/score-sheet\.pdf', $this->apiSource);
    }

    #[Test]
    public function basketball_operations_contract_is_registered(): void {
        foreach (['/operations/dashboard','/organizations','/tournaments/(\d+)/divisions','/game-assignments',
            '/matches/(\d+)/lineup','/matches/(\d+)/basketball-stats','/matches/(\d+)/box-score',
            '/score-corrections','/notifications','/tournaments/(\d+)/awards','/analytics/players/(\d+)',
            '/analytics/teams/(\d+)','/analytics/matches/(\d+)/outlook','/eligibility/(\d+)/documents'] as $route) {
            $this->assertStringContainsString($route, $this->apiSource);
        }
    }

    #[Test]
    public function publishing_contract_is_registered(): void {
        $this->assertStringContainsString('/tournaments/(\d+)/schedule/publish', $this->apiSource);
        $this->assertStringContainsString('/public/organizations/([a-z0-9-]+)', $this->apiSource);
    }

    #[Test]
    public function public_live_hub_routes_are_registered(): void {
        $this->assertStringContainsString('/public/tournaments/(\d+)/bracket', $this->apiSource);
        $this->assertStringContainsString('/public/tournaments/(\d+)/schedule', $this->apiSource);
        $this->assertStringContainsString('/public/venues', $this->apiSource);
        $this->assertStringContainsString('/public/matches/(\d+)/live', $this->apiSource);
    }

    #[Test]
    public function scorekeeper_method_signatures_match_controller(): void {
        $c = file_get_contents(__DIR__ . '/../backend/controllers/ScorekeeperController.php');
        $this->assertStringContainsString('function assigned()', $c);
        $this->assertStringContainsString('function scoreboard(int $matchId)', $c);
        $this->assertStringContainsString('function recordEvent(int $matchId)', $c);
        $this->assertStringContainsString('function undoEvent(int $matchId, int $eventId)', $c);
        $this->assertStringContainsString('function assign(int $matchId)', $c);
    }
}

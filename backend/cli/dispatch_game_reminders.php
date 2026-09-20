<?php
declare(strict_types=1);

// Run every five minutes from Task Scheduler or cron. The model prevents
// duplicate reminders, so repeated execution is safe.
$envPath = dirname(__DIR__, 2) . '/.env';
if (is_file($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        putenv($line);
    }
}

require_once dirname(__DIR__) . '/models/GameReminder.php';

try {
    $result = (new GameReminder())->dispatchDue();
    fwrite(STDOUT, json_encode(['success' => true, 'data' => $result], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['success' => false, 'message' => $error->getMessage()]) . PHP_EOL);
    exit(1);
}

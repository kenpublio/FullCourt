<?php
// backend/index.php

// Load the project environment, then allow the ignored local file to override
// it for XAMPP development without changing production configuration.
foreach ([__DIR__ . '/../.env', __DIR__ . '/../.env.local'] as $envPath) {
    if (is_file($envPath)) {
        foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
            putenv($line);
        }
    }
}

// Let PHP's development server return real uploaded/static files directly.
// API requests continue through the router below.
if (PHP_SAPI === 'cli-server') {
    $requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    $documentRoot = realpath(__DIR__);
    $requestedFile = realpath(__DIR__ . DIRECTORY_SEPARATOR . ltrim(str_replace('/', DIRECTORY_SEPARATOR, $requestPath), DIRECTORY_SEPARATOR));
    if ($documentRoot !== false && $requestedFile !== false
        && str_starts_with($requestedFile, $documentRoot . DIRECTORY_SEPARATOR)
        && is_file($requestedFile)) {
        return false;
    }
}

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/routes/api.php';

// Handle CORS headers
handleCors();

// Execute API router
$requestUri = $_SERVER['REQUEST_URI'] ?? '/api';
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    routeRequest($requestUri, $requestMethod);
} catch (Throwable $error) {
    error_log('Unhandled API error: ' . $error->getMessage());
    if (!headers_sent()) {
        require_once __DIR__ . '/utils/response.php';
        $databaseUnavailable = str_contains(strtolower($error->getMessage()), 'database')
            || str_contains(strtolower($error->getMessage()), 'connection');
        Response::error(
            $databaseUnavailable
                ? 'The database is temporarily unavailable. Please try again in a moment.'
                : 'The request could not be completed. Please try again.',
            $databaseUnavailable ? 503 : 500
        );
    }
}

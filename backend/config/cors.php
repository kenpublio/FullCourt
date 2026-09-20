<?php
// backend/config/cors.php

function handleCors(): void {
    $configured = array_filter(array_map('trim', explode(',', (string)(getenv('CORS_ALLOWED_ORIGINS') ?: ''))));
    $development = ['http://127.0.0.1:5180','http://localhost:5180','http://127.0.0.1:5173','http://localhost:5173'];
    $allowed = array_values(array_unique(array_merge($configured, getenv('APP_ENV') === 'production' ? [] : $development)));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
        header('Access-Control-Max-Age: 86400');
    }

    // Access-Control headers during OPTIONS requests
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        }
        header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With');
        exit(0);
    }
}

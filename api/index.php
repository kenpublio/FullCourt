<?php

// Vercel PHP function entry point. The existing router keeps the original
// /api/... request URI and dispatches it through the normal FullCourt API.
try {
    require dirname(__DIR__) . '/backend/index.php';
} catch (Throwable $error) {
    error_log('FullCourt Vercel bootstrap failed: ' . $error);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'status' => false,
        'message' => 'The FullCourt API could not start.',
    ]);
}

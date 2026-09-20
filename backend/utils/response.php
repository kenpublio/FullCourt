<?php
// backend/utils/response.php

class Response {
    /**
     * Send a JSON HTTP response and terminate the request.
     * @return never
     */
    public static function json(int $status, string $message, mixed $data = null, array $extra = []): void {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        $response = array_merge([
            'status' => $status >= 200 && $status < 300,
            'code' => $status,
            'message' => $message,
            'data' => $data
        ], $extra);

        echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit();
    }

    /** @return never */
    public static function success(string $message = 'Success', mixed $data = null, int $status = 200): void {
        self::json($status, $message, $data);
    }

    /** @return never */
    public static function error(string $message = 'Error', int $status = 400, mixed $data = null): void {
        self::json($status, $message, $data);
    }

    /** @return never */
    public static function unauthorized(string $message = 'Unauthorized access'): void {
        self::json(401, $message);
    }

    /** @return never */
    public static function forbidden(string $message = 'Forbidden action'): void {
        self::json(403, $message);
    }
}

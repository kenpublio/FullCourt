<?php
// backend/middleware/auth.php

require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/response.php';

class AuthMiddleware {
    public static function authenticate(): array {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;

        if (!$authHeader) {
            Response::unauthorized('Authorization header missing. Bearer token required.');
        }

        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            Response::unauthorized('Invalid Authorization format. Expected "Bearer <token>".');
        }

        $token = $matches[1];
        $payload = JWT::validate($token);

        if (!$payload) {
            Response::unauthorized('Token is expired or invalid.');
        }

        return $payload; // Returns decoded user payload array e.g. ['user_id' => X, 'role' => 'admin', ...]
    }

    public static function authorizeRoles(array $allowedRoles): array {
        $user = self::authenticate();

        // Basketball Operations role migration keeps older module permissions
        // working while exposing the clearer role names used by the new system.
        $roleAliases = [
            'platform_admin' => ['admin'],
            'organization_admin' => ['tournament_organizer'],
            'coach' => ['coach_manager'],
            'statistician' => ['scorekeeper'],
        ];
        $effectiveRoles = array_merge([$user['role']], $roleAliases[$user['role']] ?? []);

        if (!array_intersect($effectiveRoles, $allowedRoles)) {
            Response::forbidden('Access denied. Insufficient role permissions for this endpoint.');
        }

        return $user;
    }
}

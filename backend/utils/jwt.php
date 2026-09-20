<?php
// backend/utils/jwt.php

class JWT {
    private static string $algo = 'HS256';

    private static function secret(): string {
        $secret = trim((string)(getenv('JWT_SECRET') ?: ''));
        if ($secret !== '') return $secret;
        if (getenv('APP_ENV') === 'production') throw new RuntimeException('JWT_SECRET must be configured in production.');
        return 'FullCourt_Local_Development_Only_Change_Me_2026';
    }

    public static function generate(array $payload, int $expirySeconds = 86400): string {
        $header = [
            'typ' => 'JWT',
            'alg' => self::$algo
        ];

        $issuedAt = time();
        $payload['iat'] = $issuedAt;
        $payload['exp'] = $issuedAt + $expirySeconds;
        $payload['iss'] = 'FullCourt';

        $base64UrlHeader = self::base64UrlEncode(json_encode($header));
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::secret(), true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    public static function validate(string $jwt): ?array {
        $tokenParts = explode('.', $jwt);
        if (count($tokenParts) !== 3) {
            return null;
        }

        $header = json_decode(self::base64UrlDecode($tokenParts[0]), true);
        $payload = json_decode(self::base64UrlDecode($tokenParts[1]), true);
        $signatureProvided = $tokenParts[2];

        if (!$header || !$payload || ($header['alg'] ?? null) !== self::$algo || ($header['typ'] ?? null) !== 'JWT') {
            return null;
        }

        // Check token expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null;
        }

        // Verify signature
        $base64UrlHeader = self::base64UrlEncode(json_encode($header));
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::secret(), true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        if (hash_equals($base64UrlSignature, $signatureProvided)) {
            return $payload;
        }

        return null;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
    }
}

<?php

class SemaphoreSms {
    private string $apiKey;
    private string $senderName;
    private string $endpoint;

    public function __construct() {
        $this->apiKey = trim((string)(getenv('SEMAPHORE_API_KEY') ?: ''));
        $this->senderName = trim((string)(getenv('SEMAPHORE_SENDER_NAME') ?: ''));
        $this->endpoint = getenv('SEMAPHORE_OTP_URL') ?: 'https://api.semaphore.co/api/v4/otp';
    }

    public function isConfigured(): bool {
        return $this->apiKey !== '';
    }

    public function sendOtp(string $number, string $code, int $expiresMinutes = 3): bool {
        if (!$this->isConfigured() || !function_exists('curl_init')) return false;

        $payload = [
            'apikey' => $this->apiKey,
            'number' => $this->normalizeNumber($number),
            'message' => "Your FullCourt verification code is {otp}. It expires in {$expiresMinutes} minutes.",
            'code' => $code,
        ];
        if ($this->senderName !== '') $payload['sendername'] = $this->senderName;

        $curl = curl_init($this->endpoint);
        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ];
        $caBundle = trim((string)(getenv('HTTP_CA_BUNDLE') ?: ''));
        if ($caBundle !== '' && is_file($caBundle)) $options[CURLOPT_CAINFO] = $caBundle;
        curl_setopt_array($curl, $options);

        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_errno($curl);
        curl_close($curl);
        if ($error !== 0 || $status < 200 || $status >= 300 || !is_string($response)) return false;

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) return false;
        if (isset($decoded['message']) && !isset($decoded[0])) return false;
        $message = $decoded[0] ?? $decoded;
        $deliveryStatus = strtolower((string)($message['status'] ?? 'queued'));
        return !in_array($deliveryStatus, ['failed', 'refunded'], true);
    }

    private function normalizeNumber(string $number): string {
        $number = preg_replace('/[\s-]+/', '', $number) ?? $number;
        return str_starts_with($number, '0') ? '63' . substr($number, 1) : ltrim($number, '+');
    }
}

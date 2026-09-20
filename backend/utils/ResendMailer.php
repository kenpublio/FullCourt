<?php

class ResendMailer {
    private string $apiKey;
    private string $from;

    public function __construct() {
        $this->apiKey = trim((string)(getenv('RESEND_API_KEY') ?: ''));
        $this->from = trim((string)(getenv('RESEND_FROM') ?: 'FullCourt <onboarding@resend.dev>'));
    }

    public function isConfigured(): bool {
        return str_starts_with($this->apiKey, 're_');
    }

    public function send(string $to, string $subject, string $text, ?string $html = null): bool {
        if (!$this->isConfigured() || !function_exists('curl_init')) return false;

        $payload = [
            'from' => $this->from,
            'to' => [$to],
            'subject' => $subject,
            'text' => $text,
            'html' => $html ?: nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')),
        ];

        $curl = curl_init('https://api.resend.com/emails');
        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
                'User-Agent: FullCourt/1.0',
            ],
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
        return is_array($decoded) && !empty($decoded['id']);
    }

    public static function verificationHtml(string $code, int $expiresMinutes = 3): string {
        $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
        return '<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">'
            . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center">'
            . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e4e4e7">'
            . '<tr><td style="background:#111113;padding:26px 32px;color:#fff"><div style="font-size:22px;font-weight:800;letter-spacing:.5px">◉ FULLCOURT</div><div style="color:#f0442e;font-size:12px;font-weight:700;letter-spacing:2px;margin-top:6px">BASKETBALL MANAGEMENT</div></td></tr>'
            . '<tr><td style="padding:34px 32px"><h1 style="font-size:25px;margin:0 0 10px">Verify your account</h1><p style="color:#52525b;line-height:1.6;margin:0 0 24px">Enter this verification code to continue your FullCourt registration.</p>'
            . '<div style="background:#111113;color:#fff;border-left:6px solid #cd2d17;border-radius:12px;padding:20px;text-align:center;font-size:34px;font-weight:800;letter-spacing:9px">' . $safeCode . '</div>'
            . '<p style="color:#71717a;font-size:13px;line-height:1.6;margin:22px 0 0">This code expires in ' . $expiresMinutes . ' minutes. If you did not request this code, you can safely ignore this email.</p></td></tr>'
            . '<tr><td style="background:#fafafa;padding:18px 32px;color:#a1a1aa;font-size:12px">FullCourt · Your court. Your game. Your moment.</td></tr>'
            . '</table></td></tr></table></body></html>';
    }

    public static function notificationHtml(string $title,string $message,?string $actionUrl=null,string $actionLabel='Open FullCourt'): string {
        $safeTitle=htmlspecialchars($title,ENT_QUOTES,'UTF-8');$safeMessage=nl2br(htmlspecialchars($message,ENT_QUOTES,'UTF-8'));
        $button='';
        if($actionUrl){$safeUrl=htmlspecialchars($actionUrl,ENT_QUOTES,'UTF-8');$safeLabel=htmlspecialchars($actionLabel,ENT_QUOTES,'UTF-8');$button='<p style="margin:26px 0 0"><a href="'.$safeUrl.'" style="display:inline-block;background:#cd2d17;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:8px">'.$safeLabel.' →</a></p>';}
        return '<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e4e4e7"><tr><td style="background:#111113;padding:26px 32px;color:#fff"><div style="font-size:22px;font-weight:900">◉ FULLCOURT</div><div style="color:#e3b956;font-size:11px;font-weight:800;letter-spacing:2px;margin-top:6px">OFFICIAL BASKETBALL UPDATE</div></td></tr><tr><td style="padding:34px 32px"><div style="width:42px;height:4px;background:#cd2d17;margin-bottom:22px"></div><h1 style="font-size:25px;margin:0 0 13px">'.$safeTitle.'</h1><p style="color:#52525b;line-height:1.7;margin:0">'.$safeMessage.'</p>'.$button.'<p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin:28px 0 0">This is an automated operational notification from FullCourt. Never share verification codes or passwords by email.</p></td></tr><tr><td style="background:#fafafa;padding:18px 32px;color:#a1a1aa;font-size:12px">FullCourt · Basketball. Community. Every game.</td></tr></table></td></tr></table></body></html>';
    }
}

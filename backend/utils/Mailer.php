<?php
// backend/utils/Mailer.php

class Mailer {
    private string $host;
    private int $port;
    private int $timeout;
    private ?string $username;
    private ?string $password;
    private bool $useTls;
    private bool $useSsl;

    public function __construct(
        string $host = '127.0.0.1',
        int $port = 1025,
        int $timeout = 10,
        ?string $username = null,
        ?string $password = null,
        bool $useTls = false,
        bool $useSsl = false
    ) {
        $this->host = $host;
        $this->port = $port;
        $this->timeout = $timeout;
        $this->username = $username;
        $this->password = $password;
        $this->useTls = $useTls;
        $this->useSsl = $useSsl;
    }

    public static function fromEnv(): self {
        $driver = getenv('MAIL_DRIVER') ?: 'mailhog';
        
        if ($driver === 'gmail') {
            return new self(
                host: getenv('MAIL_HOST') ?: 'smtp.gmail.com',
                port: (int)(getenv('MAIL_PORT') ?: 587),
                username: getenv('MAIL_USERNAME'),
                password: getenv('MAIL_PASSWORD'),
                useTls: true,
                useSsl: false
            );
        }
        
        // Default: MailHog for local dev
        return new self(
            host: getenv('MAIL_HOST') ?: '127.0.0.1',
            port: (int)(getenv('MAIL_PORT') ?: 1025),
            useTls: false,
            useSsl: false
        );
    }

    public function send(string $to, string $subject, string $body, string $from = 'no-reply@evsu.edu.ph'): bool {
        $prefix = $this->useSsl ? 'ssl://' : '';
        $socket = @fsockopen("{$prefix}{$this->host}", $this->port, $errno, $errstr, $this->timeout);
        if (!$socket) return false;

        stream_set_timeout($socket, $this->timeout);

        $read = $this->readResponse($socket);
        if (strpos($read, '220') !== 0) { fclose($socket); return false; }

        $this->writeCommand($socket, "EHLO localhost");
        $read = $this->readResponse($socket);
        if (strpos($read, '250') !== 0) { fclose($socket); return false; }

        // STARTTLS if enabled
        if ($this->useTls && !$this->useSsl) {
            $this->writeCommand($socket, 'STARTTLS');
            $read = $this->readResponse($socket);
            if (strpos($read, '220') !== 0) { fclose($socket); return false; }
            
            // Upgrade to TLS
            $crypto = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$crypto) { fclose($socket); return false; }
            
            // Re-send EHLO after TLS
            $this->writeCommand($socket, "EHLO localhost");
            $read = $this->readResponse($socket);
            if (strpos($read, '250') !== 0) { fclose($socket); return false; }
        }

        // Auth if credentials provided
        if ($this->username && $this->password) {
            $this->writeCommand($socket, 'AUTH LOGIN');
            $read = $this->readResponse($socket);
            if (strpos($read, '334') !== 0) { fclose($socket); return false; }

            $this->writeCommand($socket, base64_encode($this->username));
            $read = $this->readResponse($socket);
            if (strpos($read, '334') !== 0) { fclose($socket); return false; }

            $this->writeCommand($socket, base64_encode($this->password));
            $read = $this->readResponse($socket);
            if (strpos($read, '235') !== 0) { fclose($socket); return false; }
        }

        $this->writeCommand($socket, "MAIL FROM:<{$from}>");
        $read = $this->readResponse($socket);
        if (strpos($read, '250') !== 0) { fclose($socket); return false; }

        $this->writeCommand($socket, "RCPT TO:<{$to}>");
        $read = $this->readResponse($socket);
        if (strpos($read, '250') !== 0) { fclose($socket); return false; }

        $this->writeCommand($socket, 'DATA');
        $read = $this->readResponse($socket);
        if (strpos($read, '354') !== 0) { fclose($socket); return false; }

        $message = "From: {$from}\r\nTo: {$to}\r\nSubject: {$subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$body}\r\n.\r\n";
        fwrite($socket, $message);

        $read = $this->readResponse($socket);
        fclose($socket);

        return strpos($read, '250') === 0;
    }

    private function writeCommand($socket, string $command): void {
        fwrite($socket, $command . "\r\n");
    }

    private function readResponse($socket): string {
        $response = '';
        $start = microtime(true);
        while (true) {
            $line = fgets($socket, 512);
            if ($line === false) break;
            $response .= $line;
            if (strlen($line) <= 4 || $line[3] !== '-') break;
            if ((microtime(true) - $start) > $this->timeout) break;
        }
        return $response;
    }
}
<?php
// backend/config/database.php

class Database {
    private ?PDO $conn = null;

    public function getConnection(): ?PDO {
        $this->conn = null;

        try {
            $env = $this->loadEnvironment();
            $driver = $env['DB_DRIVER'] ?? 'mysql';
            $host = $env['DB_HOST'] ?? '127.0.0.1';
            $port = $env['DB_PORT'] ?? ($driver === 'pgsql' ? '5432' : '3306');
            $dbName = $env['DB_NAME'] ?? 'fullcourt_database';
            $username = $env['DB_USER'] ?? 'root';
            $password = $env['DB_PASS'] ?? '';
            $dsn = $driver === 'pgsql'
                ? "pgsql:host={$host};port={$port};dbname={$dbName};sslmode=require"
                : "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            $this->conn = new PDO($dsn, $username, $password, $options);
            if ($driver === 'pgsql') {
                $this->conn->exec("SET TIME ZONE 'UTC'");
            }
        } catch (PDOException $exception) {
            // Return null or handle error in API handler
            error_log("Connection error: " . $exception->getMessage());
        }

        return $this->conn;
    }

    private function loadEnvironment(): array {
        $values = [];
        $path = dirname(__DIR__, 2) . '/.env';
        if (is_file($path)) {
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
                [$key, $value] = explode('=', $line, 2);
                $values[trim($key)] = trim($value, " \t\n\r\0\x0B\"'");
            }
        }
        foreach (['DB_DRIVER','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASS'] as $key) {
            $runtime = getenv($key);
            if ($runtime !== false) $values[$key] = $runtime;
        }
        return $values;
    }
}

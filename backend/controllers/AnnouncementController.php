<?php
// backend/controllers/AnnouncementController.php

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../config/database.php';

class AnnouncementController {
    private PDO $db;

    public function __construct() {
        $db = (new Database())->getConnection();
        if (!$db) throw new Exception('Database connection failed');
        $this->db = $db;
    }

    // Public: current, non-expired announcements
    public function indexPublished(): void {
        $stmt = $this->db->query("SELECT a.id, a.title, a.message, a.priority, a.published_at, t.name AS tournament_name
                                  FROM announcements a
                                  LEFT JOIN tournaments t ON a.tournament_id = t.id
                                  WHERE a.published_at IS NOT NULL
                                    AND (a.expires_at IS NULL OR a.expires_at > NOW())
                                  ORDER BY a.published_at DESC
                                  LIMIT 20");
        Response::success('Announcements retrieved', ['announcements' => $stmt->fetchAll()]);
    }
}
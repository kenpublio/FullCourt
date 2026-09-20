<?php
// backend/models/EventCategory.php

require_once __DIR__ . '/../config/database.php';

class EventCategory {
    private PDO $db;

    public function __construct() {
        $db = (new Database())->getConnection();
        if (!$db) throw new Exception('Database connection failed');
        $this->db = $db;
    }

    public function forSport(int $sportId): array {
        $stmt = $this->db->prepare("SELECT id, name, gender, player_count, sort_order FROM event_categories WHERE sport_id=:sportId ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':sportId' => $sportId]);
        return $stmt->fetchAll();
    }

    public function all(): array {
        return $this->db->query("SELECT ec.id, ec.name, ec.gender, ec.player_count, ec.sort_order, s.id AS sport_id, s.name AS sport_name
                                 FROM event_categories ec
                                 JOIN sports s ON ec.sport_id = s.id
                                 ORDER BY s.name ASC, ec.sort_order ASC")->fetchAll();
    }

    public function sportsWithCategories(): array {
        $stmt = $this->db->query("SELECT s.id, s.name, s.category AS sport_category, s.rules_summary,
                                         (SELECT COUNT(*) FROM event_categories ec WHERE ec.sport_id = s.id) AS event_count
                                  FROM sports s
                                  ORDER BY s.name ASC");
        $sports = $stmt->fetchAll();
        foreach ($sports as &$sport) {
            $sport['events'] = $this->forSport((int) $sport['id']);
        }
        return $sports;
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM event_categories WHERE id=:id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
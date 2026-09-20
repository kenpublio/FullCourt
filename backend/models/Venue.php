<?php
// backend/models/Venue.php

require_once __DIR__ . '/../config/database.php';

class Venue {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function getAll(): array {
        $stmt = $this->db->query("
            SELECT v.*, o.name AS organization_name, submitter.full_name AS submitted_by_name, reviewer.full_name AS reviewed_by_name,
                   (SELECT COUNT(*) FROM courts c WHERE c.venue_id = v.id) AS court_count
            FROM venues v
            LEFT JOIN organizations o ON o.id=v.organization_id
            LEFT JOIN users submitter ON submitter.id=v.submitted_by
            LEFT JOIN users reviewer ON reviewer.id=v.reviewed_by
            ORDER BY v.name ASC
        ");
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM venues WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function getCourts(int $venueId): array {
        $stmt = $this->db->prepare("
            SELECT c.*, s.name AS sport_name
            FROM courts c
            LEFT JOIN sports s ON c.sport_id = s.id
            WHERE c.venue_id = :venue_id
            ORDER BY c.court_name ASC
        ");
        $stmt->execute([':venue_id' => $venueId]);
        return $stmt->fetchAll();
    }

    public function getAllCourts(): array {
        $stmt = $this->db->query("
            SELECT c.*, v.name AS venue_name, s.name AS sport_name
            FROM courts c
            JOIN venues v ON c.venue_id = v.id
            LEFT JOIN sports s ON c.sport_id = s.id
            ORDER BY v.name ASC, c.court_name ASC
        ");
        return $stmt->fetchAll();
    }

    public function createVenue(string $name, string $location, ?int $organizationId, int $submittedBy): int {
        $stmt = $this->db->prepare("INSERT INTO venues (name, location, organization_id, submitted_by, approval_status) VALUES (:name, :location, :organization_id, :submitted_by, 'pending')");
        $stmt->execute([':name' => $name, ':location' => $location, ':organization_id'=>$organizationId, ':submitted_by'=>$submittedBy]);
        return (int) $this->db->lastInsertId();
    }

    public function updateVenue(int $id, string $name, string $location): bool {
        $stmt = $this->db->prepare("UPDATE venues SET name = :name, location = :location WHERE id = :id");
        return $stmt->execute([':name' => $name, ':location' => $location, ':id' => $id]);
    }

    public function deleteVenue(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM venues WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function createCourt(int $venueId, string $courtName, ?int $sportId, bool $isAvailable): int {
        $stmt = $this->db->prepare("
            INSERT INTO courts (venue_id, court_name, sport_id, is_available)
            VALUES (:venue_id, :court_name, :sport_id, :is_available)
        ");
        $stmt->execute([
            ':venue_id' => $venueId,
            ':court_name' => $courtName,
            ':sport_id' => $sportId,
            ':is_available' => $isAvailable ? 1 : 0
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function updateCourt(int $id, string $courtName, ?int $sportId, bool $isAvailable): bool {
        $stmt = $this->db->prepare("
            UPDATE courts SET court_name = :court_name, sport_id = :sport_id, is_available = :is_available WHERE id = :id
        ");
        return $stmt->execute([
            ':court_name' => $courtName,
            ':sport_id' => $sportId,
            ':is_available' => $isAvailable ? 1 : 0,
            ':id' => $id
        ]);
    }

    public function deleteCourt(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM courts WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    public function reviewVenue(int $id, string $status, int $reviewedBy, ?string $notes): bool {
        $stmt=$this->db->prepare("UPDATE venues SET approval_status=:status,reviewed_by=:reviewed_by,reviewed_at=NOW(),review_notes=:notes WHERE id=:id");
        return $stmt->execute([':status'=>$status,':reviewed_by'=>$reviewedBy,':notes'=>$notes,':id'=>$id]);
    }
}

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

    public function getForOrganizationUser(int $userId):array {
        $stmt=$this->db->prepare("SELECT DISTINCT v.*,o.name organization_name,submitter.full_name submitted_by_name,reviewer.full_name reviewed_by_name,(SELECT COUNT(*) FROM courts c WHERE c.venue_id=v.id) court_count FROM organization_members om JOIN organizations o ON o.id=om.organization_id AND o.status='active' JOIN venues v ON v.organization_id=o.id LEFT JOIN users submitter ON submitter.id=v.submitted_by LEFT JOIN users reviewer ON reviewer.id=v.reviewed_by WHERE om.user_id=:user_id AND om.status='active' ORDER BY v.name");
        $stmt->execute([':user_id'=>$userId]);return$stmt->fetchAll();
    }

    public function getApproved():array {
        return $this->db->query("SELECT v.*,o.name organization_name,(SELECT COUNT(*) FROM courts c WHERE c.venue_id=v.id) court_count FROM venues v LEFT JOIN organizations o ON o.id=v.organization_id WHERE v.approval_status='approved' ORDER BY v.name")->fetchAll();
    }

    public function canManage(int $venueId,int $userId):bool {
        $stmt=$this->db->prepare("SELECT v.id FROM venues v JOIN organization_members om ON om.organization_id=v.organization_id AND om.user_id=:user_id AND om.status='active' WHERE v.id=:venue_id LIMIT 1");$stmt->execute([':venue_id'=>$venueId,':user_id'=>$userId]);return(bool)$stmt->fetchColumn();
    }

    public function courtVenueId(int $courtId):?int {$stmt=$this->db->prepare('SELECT venue_id FROM courts WHERE id=:id');$stmt->execute([':id'=>$courtId]);$id=$stmt->fetchColumn();return$id===false?null:(int)$id;}

    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM venues WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function getCourts(int $venueId): array {
        $stmt = $this->db->prepare("
            SELECT c.*, v.name AS venue_name, s.name AS sport_name
            FROM courts c
            JOIN venues v ON v.id=c.venue_id
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

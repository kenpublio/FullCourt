<?php
// backend/models/News.php

require_once __DIR__ . '/../config/database.php';

class News {
    private PDO $db;

    public function __construct() {
        $db = (new Database())->getConnection();
        if (!$db) throw new Exception('Database connection failed');
        $this->db = $db;
    }

    public function published(): array {
        $stmt = $this->db->query("SELECT n.id, n.title, n.slug, n.summary, n.cover_url, n.published_at, s.name AS sport_name
                                  FROM news n
                                  LEFT JOIN sports s ON n.sport_id = s.id
                                  WHERE n.is_published = 1 AND n.published_at IS NOT NULL
                                  ORDER BY n.published_at DESC
                                  LIMIT 50");
        return $stmt->fetchAll();
    }

    public function publishedById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT n.*, s.name AS sport_name
                                    FROM news n
                                    LEFT JOIN sports s ON n.sport_id = s.id
                                    WHERE n.id = :id AND n.is_published = 1 LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function all(): array {
        $stmt = $this->db->query("SELECT n.*, s.name AS sport_name
                                  FROM news n
                                  LEFT JOIN sports s ON n.sport_id = s.id
                                  ORDER BY n.created_at DESC");
        return $stmt->fetchAll();
    }

    public function create(array $d): int {
        $slug = $this->makeSlug($d['title']);
        $stmt = $this->db->prepare("INSERT INTO news (sport_id, title, slug, summary, body, cover_url, author_id, is_published, published_at)
                                    VALUES (:sportId, :title, :slug, :summary, :body, :coverUrl, :authorId, :published, :publishedAt)");
        $stmt->execute([
            ':sportId' => $d['sport_id'] ?: null,
            ':title' => $d['title'],
            ':slug' => $slug,
            ':summary' => $d['summary'] ?: null,
            ':body' => $d['body'] ?: null,
            ':coverUrl' => $d['cover_url'] ?: null,
            ':authorId' => $d['author_id'] ?: null,
            ':published' => $d['is_published'] ? 1 : 0,
            ':publishedAt' => (!empty($d['is_published']) && empty($d['published_at'])) ? date('Y-m-d H:i:s') : ($d['published_at'] ?? null),
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $d): bool {
        $stmt = $this->db->prepare("UPDATE news SET sport_id=:sportId, title=:title, summary=:summary, body=:body, cover_url=:coverUrl, is_published=:published WHERE id=:id");
        return $stmt->execute([
            ':sportId' => $d['sport_id'] ?: null,
            ':title' => $d['title'],
            ':summary' => $d['summary'] ?: null,
            ':body' => $d['body'] ?: null,
            ':coverUrl' => $d['cover_url'] ?: null,
            ':published' => $d['is_published'] ? 1 : 0,
            ':id' => $id,
        ]);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM news WHERE id=:id");
        return $stmt->execute([':id' => $id]);
    }

    private function makeSlug(string $title): string {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title));
        $slug = trim($slug, '-');
        $base = $slug ?: 'article';
        $i = 0;
        while ($this->slugExists($slug)) {
            $i++;
            $slug = $base . '-' . $i;
        }
        return $slug;
    }

    private function slugExists(string $slug): bool {
        $stmt = $this->db->prepare("SELECT id FROM news WHERE slug=:slug LIMIT 1");
        $stmt->execute([':slug' => $slug]);
        return (bool) $stmt->fetch();
    }
}
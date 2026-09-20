<?php
// backend/controllers/NewsController.php

require_once __DIR__ . '/../models/News.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';

class NewsController {
    private News $model;

    public function __construct() { $this->model = new News(); }

    // Public: list published news
    public function indexPublished(): void {
        Response::success('Published news retrieved', ['news' => $this->model->published()]);
    }

    public function showPublished(int $id): void {
        $article = $this->model->publishedById($id);
        if (!$article) Response::error('News article not found.', 404);
        Response::success('News article retrieved', ['news' => $article]);
    }

    // Admin/Organizer: all news (incl. drafts)
    public function all(): void {
        AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        Response::success('News retrieved', ['news' => $this->model->all()]);
    }

    public function create(): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);
        $input['author_id'] = (int) $user['user_id'];
        $id = $this->model->create($input);
        Response::success('News article created.', ['id' => $id], 201);
    }

    public function update(int $id): void {
        AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);
        $this->model->update($id, $input);
        Response::success('News article updated.');
    }

    public function delete(int $id): void {
        AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        $this->model->delete($id);
        Response::success('News article deleted.');
    }
}
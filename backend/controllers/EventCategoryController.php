<?php
// backend/controllers/EventCategoryController.php

require_once __DIR__ . '/../models/EventCategory.php';
require_once __DIR__ . '/../utils/response.php';

class EventCategoryController {
    private EventCategory $model;

    public function __construct() { $this->model = new EventCategory(); }

    // Public: sports list with their sub-event categories
    public function sportsPublic(): void {
        Response::success('Sports and event categories retrieved', ['sports' => $this->model->sportsWithCategories()]);
    }
}
<?php
// backend/controllers/UserController.php

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class UserController {
    private User $userModel;
    private AuditLog $auditLogModel;

    public function __construct() {
        $this->userModel = new User();
        $this->auditLogModel = new AuditLog();
    }

    public function index(): void {
        $currentUser = AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        $users = OrganizationAccess::isPlatform($currentUser)
            ? $this->userModel->getAll()
            : $this->userModel->getForOrganizationUser((int)$currentUser['user_id']);
        Response::success('Users retrieved successfully', ['users' => $users]);
    }

    public function updateProfile(): void {
        $currentUser = AuthMiddleware::authenticate();
        $input = json_decode(file_get_contents('php://input'), true);
        $fullName = trim($input['full_name'] ?? '');
        if ($fullName === '') Response::error('Full name is required.', 400);
        $this->userModel->updateProfile($currentUser['user_id'], [
            'full_name' => $fullName,
            'phone_number' => trim($input['phone_number'] ?? ''),
            'address' => trim($input['address'] ?? '')
        ]);
        Response::success('Profile updated successfully', ['user' => $this->userModel->findById($currentUser['user_id'])]);
    }

    public function uploadPhoto(): void {
        $currentUser = AuthMiddleware::authenticate();
        if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            Response::error('A profile photo image file is required.', 400);
        }
        $file = $_FILES['photo'];
        $mimeMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (!isset($mimeMap[$mime])) {
            Response::error('Profile photo must be a JPG, PNG, or WEBP image.', 400);
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::error('Profile photo must be 5MB or smaller.', 400);
        }
        $ext = $mimeMap[$mime];
        $filename = 'avatar_' . $currentUser['user_id'] . '_' . time() . '.' . $ext;
        $dir = __DIR__ . '/../uploads/avatars';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            Response::error('Could not save the uploaded photo.', 500);
        }
        $url = '/uploads/avatars/' . $filename;
        $this->userModel->updateAvatar((int) $currentUser['user_id'], $url);
        Response::success('Profile photo updated successfully', ['avatar_url' => $url]);
    }

    public function updateRole(int $id): void {
        $currentUser = AuthMiddleware::authorizeRoles(['admin']);
        $input = json_decode(file_get_contents('php://input'), true);
        $role = trim($input['role'] ?? '');

        $validRoles = ['platform_admin','organization_admin','tournament_organizer','coach','player','official','statistician'];

        if (!in_array($role, $validRoles, true)) {
            Response::error('Invalid role specified.', 400);
        }

        $targetUser = $this->userModel->findById($id);
        if (!$targetUser) {
            Response::error('Target user not found.', 404);
        }

        $oldRole = $targetUser['role'];
        $this->userModel->updateRole($id, $role);

        // Audit Log
        $this->auditLogModel->log(
            $currentUser['user_id'],
            'UPDATE_ROLE',
            'USER_MANAGEMENT',
            "Changed role for {$targetUser['full_name']} ({$targetUser['email']}) from '{$oldRole}' to '{$role}'."
        );

        Response::success("Role for {$targetUser['full_name']} updated to '{$role}'.");
    }

    public function update(int $id): void {
        $currentUser = AuthMiddleware::authorizeRoles(['admin']);
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $targetUser = $this->userModel->findById($id);
        if (!$targetUser) Response::error('Target user not found.', 404);
        $fullName = trim((string)($input['full_name'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $phone = preg_replace('/[\s-]+/', '', trim((string)($input['phone_number'] ?? '')));
        $address = trim((string)($input['address'] ?? ''));
        $role = trim((string)($input['role'] ?? ''));
        $validRoles = ['platform_admin','organization_admin','tournament_organizer','coach','player','official','statistician'];
        if ($fullName === '' || $email === '') Response::error('Full name and email/login are required.', 422);
        if ($phone !== '' && !preg_match('/^(09\d{9}|\+639\d{9})$/', $phone)) Response::error('Enter a valid Philippine mobile number.', 422);
        if (!in_array($role, $validRoles, true)) Response::error('Invalid role specified.', 422);
        if ((int)$targetUser['id'] === (int)$currentUser['user_id'] && $role !== $targetUser['role']) Response::error('You cannot change your own administrator role.', 422);
        $this->userModel->updateManagedUser($id, compact('fullName','email','phone','address','role') + [
            'full_name'=>$fullName, 'phone_number'=>$phone
        ]);
        $this->auditLogModel->log($currentUser['user_id'],'UPDATE_USER','USER_MANAGEMENT',"Updated account details for {$fullName} ({$email}).");
        Response::success("Account for {$fullName} updated successfully.");
    }

    public function remove(int $id): void {
        $currentUser = AuthMiddleware::authorizeRoles(['admin']);
        $targetUser = $this->userModel->findById($id);
        if (!$targetUser) Response::error('Target user not found.', 404);
        if ((int)$targetUser['id'] === (int)$currentUser['user_id']) Response::error('You cannot remove your own Administrator account.', 422);
        $this->userModel->toggleStatus($id, false);
        $this->auditLogModel->log($currentUser['user_id'],'REMOVE_USER','USER_MANAGEMENT',"Safely removed access for {$targetUser['full_name']} ({$targetUser['email']}); historical records were retained.");
        Response::success("{$targetUser['full_name']} has been removed from active access. Historical records were retained.");
    }

    public function toggleStatus(int $id): void {
        $currentUser = AuthMiddleware::authorizeRoles(['admin']);
        $input = json_decode(file_get_contents('php://input'), true);
        $isActive = (bool) ($input['is_active'] ?? true);

        $targetUser = $this->userModel->findById($id);
        if (!$targetUser) {
            Response::error('Target user not found.', 404);
        }

        // Prevent self-deactivation
        if ($targetUser['id'] === $currentUser['user_id'] && !$isActive) {
            Response::error('You cannot deactivate your own Administrator account.', 400);
        }

        $this->userModel->toggleStatus($id, $isActive);
        $statusText = $isActive ? 'activated' : 'deactivated';

        // Audit Log
        $this->auditLogModel->log(
            $currentUser['user_id'],
            'TOGGLE_STATUS',
            'USER_MANAGEMENT',
            "User {$targetUser['full_name']} ({$targetUser['email']}) was {$statusText}."
        );

        Response::success("User {$targetUser['full_name']} has been {$statusText}.");
    }

    public function getAuditLogs(): void {
        AuthMiddleware::authorizeRoles(['admin', 'tournament_organizer']);
        $logs = $this->auditLogModel->getRecent(100);
        Response::success('Audit logs retrieved', ['logs' => $logs]);
    }
}

<?php
// backend/controllers/PaymentController.php

require_once __DIR__ . '/../models/Payment.php';
require_once __DIR__ . '/../models/AuditLog.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/OrganizationAccess.php';

class PaymentController {
    private Payment $paymentModel;
    private AuditLog $auditLog;

    public function __construct() {
        $this->paymentModel = new Payment();
        $this->auditLog = new AuditLog();
    }

    public function index(): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'finance_officer', 'tournament_organizer', 'coach_manager', 'player']);
        if(in_array($user['role'],['coach','coach_manager','player'],true))$payments=$this->paymentModel->getForUser((int)$user['user_id'],$user['role']);
        elseif(OrganizationAccess::isPlatform($user)||$user['role']==='finance_officer')$payments=$this->paymentModel->getAll();
        else $payments=$this->paymentModel->getForOrganizationUser((int)$user['user_id']);
        Response::success('Payments retrieved', ['payments' => $payments]);
    }

    public function submit(): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'coach_manager', 'player']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['team_id']) || empty($input['tournament_id']) || empty($input['reference_number']) || empty($input['amount'])) {
            Response::error('Team ID, Tournament ID, Reference Number, and Amount are required.', 400);
        }

        $reference=trim((string)$input['reference_number']);
        if(!preg_match('/^[A-Za-z0-9-]{6,100}$/',$reference))Response::error('Enter a valid payment reference number using 6–100 letters, numbers, or hyphens.',400);
        $amount=filter_var($input['amount'],FILTER_VALIDATE_FLOAT);
        if($amount===false||$amount<=0)Response::error('Enter a valid payment amount.',400);
        $check=$this->paymentModel->validateSubmission((int)$input['team_id'],(int)$input['tournament_id'],(int)$user['user_id'],$user['role'],$reference,(float)$amount);
        if(!$check['valid'])Response::error($check['message'],409);
        $input['reference_number']=$reference;$input['amount']=$amount;

        $id = $this->paymentModel->submitPayment($input);
        $this->auditLog->log($user['user_id'], 'SUBMIT_PAYMENT', 'PAYMENTS', "Submitted GCash/Maya payment (Ref: {$input['reference_number']}) for team ID {$input['team_id']}.");

        Response::success('Payment submitted for verification', ['id' => $id], 201);
    }

    public function uploadReceipt(int $paymentId): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'coach_manager', 'player']);

        $payment = $this->paymentModel->getById($paymentId);
        if (!$payment) Response::error('Payment record not found.', 404);

        if ($user['role'] !== 'admin' && !$this->paymentModel->belongsToUser($paymentId, (int) $user['user_id'], $user['role'])) {
            Response::forbidden('You can only attach a receipt to your own team payment.');
        }

        if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
            Response::error('A receipt image file is required.', 400);
        }

        $file = $_FILES['receipt'];
        $mimeMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!isset($mimeMap[$mime])) {
            Response::error('Receipt must be a JPG, PNG, or WEBP image.', 400);
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::error('Receipt image must be 5MB or smaller.', 400);
        }

        $ext = $mimeMap[$mime];
        $filename = 'payment_' . $paymentId . '_' . time() . '.' . $ext;

        $dir = __DIR__ . '/../uploads/receipts';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            Response::error('Could not save the uploaded receipt.', 500);
        }

        $url = '/uploads/receipts/' . $filename;
        $this->paymentModel->attachReceipt($paymentId, $url);

        Response::success('Receipt uploaded successfully', ['receipt_photo_url' => $url]);
    }

    public function verify(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['admin', 'finance_officer']);
        $input = json_decode(file_get_contents('php://input'), true);

        $status = $input['status'] ?? 'approved'; // 'approved' or 'rejected'
        $remarks = $input['remarks'] ?? null;

        if (!in_array($status, ['approved', 'rejected'], true)) {
            Response::error('Invalid verification status.', 400);
        }

        $this->paymentModel->verifyPayment($id, $status, $user['user_id'], $remarks);
        $this->auditLog->log($user['user_id'], 'VERIFY_PAYMENT', 'PAYMENTS', "Payment ID {$id} marked as '{$status}'. Remarks: {$remarks}");

        Response::success("Payment marked as '{$status}'.");
    }
}

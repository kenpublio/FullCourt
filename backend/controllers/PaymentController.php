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
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin', 'finance_officer', 'tournament_organizer', 'coach','coach_manager', 'player']);
        if(in_array($user['role'],['coach','coach_manager','player'],true))$payments=$this->paymentModel->getForUser((int)$user['user_id'],$user['role']);
        elseif(OrganizationAccess::isPlatform($user)||$user['role']==='finance_officer')$payments=$this->paymentModel->getAll();
        else $payments=$this->paymentModel->getForOrganizationUser((int)$user['user_id']);
        Response::success('Payments retrieved', ['payments' => $payments]);
    }

    public function submit(): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','coach','coach_manager', 'player']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['team_id']) || empty($input['tournament_id']) || empty($input['reference_number']) || empty($input['amount'])) {
            Response::error('Team ID, Tournament ID, Reference Number, and Amount are required.', 400);
        }

        $reference=trim((string)$input['reference_number']);
        if(!preg_match('/^[A-Za-z0-9-]{6,100}$/',$reference))Response::error('Enter a valid payment reference number using 6–100 letters, numbers, or hyphens.',400);
        $method=$input['payment_method']??'gcash';
        if(!in_array($method,['gcash','maya','cash'],true))Response::error('Choose GCash, Maya, or cash over-counter as the payment method.',400);
        $amount=filter_var($input['amount'],FILTER_VALIDATE_FLOAT);
        if($amount===false||$amount<=0)Response::error('Enter a valid payment amount.',400);
        $check=$this->paymentModel->validateSubmission((int)$input['team_id'],(int)$input['tournament_id'],(int)$user['user_id'],$user['role'],$reference,(float)$amount);
        if(!$check['valid'])Response::error($check['message'],409);
        $input['reference_number']=$reference;$input['amount']=$amount;$input['payment_method']=$method;

        $id = $this->paymentModel->submitPayment($input);
        $this->auditLog->log($user['user_id'], 'SUBMIT_PAYMENT', 'PAYMENTS', "Submitted {$method} payment for team ID {$input['team_id']}.");

        Response::success('Payment submitted for verification', ['id' => $id], 201);
    }

    public function uploadReceipt(int $paymentId): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','coach','coach_manager', 'player']);

        $payment = $this->paymentModel->getById($paymentId);
        if (!$payment) Response::error('Payment record not found.', 404);

        if (!in_array($user['role'],['admin','platform_admin'],true) && !$this->paymentModel->belongsToUser($paymentId, (int) $user['user_id'], $user['role'])) {
            Response::forbidden('You can only attach a receipt to your own team payment.');
        }
        if (($payment['status'] ?? '') !== 'pending') Response::error('Receipts can only be attached while a payment is awaiting review.',409);

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
        if (!$this->paymentModel->attachReceipt($paymentId, $url)) Response::error('The payment was reviewed before the receipt could be attached.',409);

        Response::success('Receipt uploaded successfully', ['receipt_photo_url' => $url]);
    }

    public function verify(int $id): void {
        $user = AuthMiddleware::authorizeRoles(['platform_admin','admin','finance_officer','organization_admin','tournament_organizer']);
        $input = json_decode(file_get_contents('php://input'), true);

        $status = $input['status'] ?? 'approved'; // 'approved' or 'rejected'
        $remarks = $input['remarks'] ?? null;

        if (!in_array($status, ['approved', 'rejected'], true)) {
            Response::error('Invalid verification status.', 400);
        }
        $remarks=trim((string)($input['remarks']??''));
        if($status==='rejected'&&$remarks==='')Response::error('Add a short reason so the team knows what to fix.',400);
        if(strlen($remarks)>1000)Response::error('Verification notes must be 1,000 characters or fewer.',400);
        if(!OrganizationAccess::isPlatform($user)&&$user['role']!=='finance_officer'
            && !$this->paymentModel->canVerifyForOrganization($id,(int)$user['user_id'])){
            Response::forbidden('You can only review pending payments for your organization.');
        }

        if(!$this->paymentModel->verifyPayment($id, $status, (int)$user['user_id'], $remarks?:null)){
            Response::error('This payment no longer needs review. Refresh the payment list and check its current status.',409);
        }
        $this->auditLog->log($user['user_id'], 'VERIFY_PAYMENT', 'PAYMENTS', "Payment ID {$id} marked as '{$status}'.");

        Response::success("Payment marked as '{$status}'.");
    }
}

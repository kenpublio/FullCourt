<?php
// backend/controllers/AuthController.php

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../utils/RegistrationDetails.php';
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/Mailer.php';
require_once __DIR__ . '/../utils/ResendMailer.php';
require_once __DIR__ . '/../utils/SemaphoreSms.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/AuthSession.php';
require_once __DIR__ . '/../middleware/RateLimiter.php';

class AuthController {
    private User $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    public function login(): void {
        $input = json_decode(file_get_contents('php://input'), true);

        $email = $this->normalizeContact(strtolower(trim($input['email'] ?? '')));
        $password = trim($input['password'] ?? '');
        RateLimiter::hit('login',10,60,$email);

        if (empty($email) || empty($password)) {
            Response::error('Email/mobile number and password are required fields.', 400);
        }

        $user = $this->userModel->findByLogin($email);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            Response::error('Invalid credentials. Please check your email/mobile number and password.', 401);
        }

        if (!$user['is_active']) {
            Response::error('Account is deactivated. Please contact the administrator.', 403);
        }

        // Generate JWT payload
        $tokenPayload = [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'student_faculty_id' => $user['student_faculty_id']
        ];

        $token = JWT::generate($tokenPayload, 900);
        $refresh = (new AuthSession())->issue((int)$user['id']);

        unset($user['password_hash']);

        Response::success('Login successful', [
            'user' => $user,
            'token' => $token,
            'refresh_token' => $refresh['token']
        ]);
    }

    public function register(): void {
        $db=(new Database())->getConnection();
        $registrationEnabled=$db->query('SELECT registration_enabled FROM platform_settings WHERE id=1')->fetchColumn();
        if(!$registrationEnabled) Response::error('New account registration is temporarily unavailable. Please try again later.',503);
        $input = json_decode(file_get_contents('php://input'), true);

        $fullName = trim($input['full_name'] ?? '');
        $contact = $this->normalizeContact(strtolower(trim($input['email'] ?? '')));
        $password = trim($input['password'] ?? '');
        $studentId = trim($input['student_faculty_id'] ?? '');
        $ageInput = $input['age'] ?? null;
        $birthDate = trim($input['birth_date'] ?? '');
        $address = trim($input['address'] ?? '');
        $age = null;
        if ($ageInput !== null && $ageInput !== '') {
            $age = filter_var($ageInput, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 120]]);
            if ($age === false) Response::error('Enter a whole-number age between 1 and 120.', 400);
        }
        $role = trim($input['role'] ?? 'player');
        $dept = trim($input['department_course'] ?? '');
        $yearLevel = trim($input['year_level'] ?? '');
        $phone = trim($input['phone_number'] ?? '');
        $verificationCode = trim($input['verification_code'] ?? '');

        if (empty($fullName) || empty($birthDate) || empty($address) || empty($contact) || empty($password)) {
            Response::error('Full name, date of birth, address, email/mobile number, and password are required fields.', 400);
        }
        $birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthDate);
        if (!$birth || $birth->format('Y-m-d') !== $birthDate || $birth > new DateTimeImmutable('today')) Response::error('Enter a valid date of birth.', 400);
        $age = $birth->diff(new DateTimeImmutable('today'))->y;
        if ($age < 1 || $age > 120) Response::error('Date of birth must result in an age between 1 and 120.', 400);
        $isEmail = $this->isValidEmail($contact);
        if (!$isEmail && !$this->isValidPhone($contact)) Response::error('Enter a valid email address or Philippine mobile number.',400);
        $email = $isEmail ? $contact : null;
        if (!$isEmail) $phone = $contact;

        if (strlen($password) < 8 || !preg_match('/[A-Z]/',$password) || !preg_match('/\d/',$password) || !preg_match('/[^A-Za-z0-9]/',$password)) {
            Response::error('Password must have 8 characters, an uppercase letter, a number, and a special character.', 400);
        }

        // Check if email already exists
        if ($email !== null && $this->userModel->findByEmail($email)) {
            Response::error('Email is already registered in FullCourt.', 409);
        }
        if ($phone !== '' && $this->userModel->findByPhone($phone)) Response::error('Mobile number is already registered in FullCourt.',409);

        // Check student ID if provided
        if (!empty($studentId) && $this->userModel->findByStudentId($studentId)) {
            Response::error('Student/Faculty ID is already registered.', 409);
        }

        if (!$this->userModel->verifyCode($contact, 'registration', $verificationCode)) {
            Response::error('The verification code is invalid or expired.', 400);
        }

        // Allowed self-registration roles
        $allowedRegistrationRoles = ['player', 'coach', 'organization_admin'];
        if (!in_array($role, $allowedRegistrationRoles, true)) {
            $role = 'player';
        }

        try {
            $details = RegistrationDetails::validate($input, $role, $age);
        } catch (InvalidArgumentException $e) {
            Response::error($e->getMessage(), 400);
        }
        $userId = $this->userModel->create([
            'student_faculty_id' => $studentId ?: null,
            'age' => $age,
            'birth_date' => $birthDate,
            'address' => $address,
            'full_name' => $fullName,
            'email' => $email,
            'password' => $password,
            'role' => $role,
            'department_course' => $dept,
            'year_level' => $yearLevel,
            'phone_number' => $phone,
            'registration_details' => $details
        ]);

        $newUser = $this->userModel->findById($userId);

        Response::success('Registration successful. You can now log in.', [
            'user' => $newUser
        ], 201);
    }

    public function requestEmailCode(): void {
        $input=json_decode(file_get_contents('php://input'),true); $contact=$this->normalizeContact(strtolower(trim($input['email']??''))); $purpose=trim($input['purpose']??'registration');
        RateLimiter::hit('contact_code',5,600,$contact);
        if(!$this->isValidEmail($contact)&&!$this->isValidPhone($contact)) Response::error('Enter a valid email address or Philippine mobile number.',400);
        if($purpose==='registration' && $this->userModel->findByLogin($contact)) Response::error('This email or mobile number is already registered.',409);
        $this->issueCode($contact,$purpose);
    }

    public function forgotPassword(): void {
        $input=json_decode(file_get_contents('php://input'),true); $contact=$this->normalizeContact(strtolower(trim($input['email']??'')));
        RateLimiter::hit('password_reset',5,600,$contact);
        if(!$this->isValidEmail($contact)&&!$this->isValidPhone($contact)) Response::error('Enter a valid email address or Philippine mobile number.',400);
        if($this->userModel->findByLogin($contact)) $this->issueCode($contact,'password_reset');
        Response::success('If that email or mobile number is registered, a reset code has been sent.');
    }

    public function verifyPasswordResetCode(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        $email = $this->normalizeContact(strtolower(trim($input['email'] ?? '')));
        $code = trim($input['code'] ?? '');
        if (strlen($code) !== 6 || !$this->userModel->verifyCode($email, 'password_reset', $code, false)) {
            Response::error('The reset code is invalid or expired.', 400);
        }
        Response::success('Verification code confirmed. You may now create a new password.');
    }

    public function verifyRegistrationCode(): void {
        $input = json_decode(file_get_contents('php://input'), true);
        $email = $this->normalizeContact(strtolower(trim($input['email'] ?? '')));
        $code = trim($input['code'] ?? '');
        if (strlen($code) !== 6 || !$this->userModel->verifyCode($email, 'registration', $code, false)) {
            Response::error('The verification code is invalid or expired.', 400);
        }
        Response::success('Contact successfully verified.');
    }

    public function resetPassword(): void {
        $input=json_decode(file_get_contents('php://input'),true); $email=$this->normalizeContact(strtolower(trim($input['email']??''))); $code=trim($input['code']??''); $password=$input['password']??'';
        if(strlen($password)<8 || !preg_match('/[A-Z]/',$password) || !preg_match('/\d/',$password) || !preg_match('/[^A-Za-z0-9]/',$password)) Response::error('Use at least 8 characters with uppercase, number, and special character.',400);
        if(!$this->userModel->verifyCode($email,'password_reset',$code)) Response::error('The reset code is invalid or expired.',400);
        $this->userModel->updatePasswordByLogin($email,$password); Response::success('Password reset successfully.');
    }

    public function changePassword():void {
        $user=AuthMiddleware::authenticate();$input=json_decode(file_get_contents('php://input'),true);
        $current=$input['current_password']??'';$new=$input['new_password']??'';
        if(strlen($new)<8||!preg_match('/[A-Z]/',$new)||!preg_match('/\d/',$new)||!preg_match('/[^A-Za-z0-9]/',$new)) Response::error('Use at least 8 characters with uppercase, number, and special character.',400);
        if(!$this->userModel->changePassword((int)$user['user_id'],$current,$new)) Response::error('Current password is incorrect.',422);
        Response::success('Password changed successfully.');
    }

    private function isValidEmail(string $email): bool { return filter_var($email,FILTER_VALIDATE_EMAIL) !== false; }
    private function isValidPhone(string $phone): bool { return preg_match('/^09\d{9}$/',$phone)===1; }
    private function normalizeContact(string $contact): string {
        $contact=preg_replace('/[\s-]+/','',$contact)??$contact;
        if(str_starts_with($contact,'+63'))$contact='0'.substr($contact,3);
        return $contact;
    }

    private function issueCode(string $email,string $purpose): void {
        $code=(string)random_int(100000,999999); $this->userModel->saveVerificationCode($email,$purpose,$code);
        if($this->isValidPhone($email)){
            $sms = new SemaphoreSms();
            if (!$sms->isConfigured()) {
                $data=[];if(getenv('APP_ENV')!=='production')$data['development_code']=$code;
                if(getenv('APP_ENV')==='production')Response::error('SMS verification is not configured yet. Please use an email address or contact the administrator.',503);
                Response::success('Semaphore is not configured locally. Use the test code shown below.',$data);
            }
            if (!$sms->sendOtp($email, $code, 3)) {
                Response::error('We could not send the SMS verification code. Check the number or try again later.',503);
            }
            Response::success('Verification code sent to your mobile number.');
        }
        $subject=$purpose==='password_reset'?'FullCourt password reset code':'Verify your FullCourt account';
        $body="Your FullCourt verification code is {$code}. It expires in 3 minutes.";
        $resend = new ResendMailer();
        $sent = $resend->isConfigured()
            ? $resend->send($email, $subject, $body, ResendMailer::verificationHtml($code, 3))
            : false;
        $mailDriver = getenv('MAIL_DRIVER') ?: 'mailhog';
        $sender = getenv('MAIL_FROM') ?: getenv('MAIL_USERNAME') ?: 'no-reply@sportsync.local';
        if (!$sent) $sent=Mailer::fromEnv()->send($email,$subject,$body,$sender);
        $data=[];
        if ($mailDriver !== 'gmail' && getenv('APP_ENV') !== 'production') {
            $data['development_code']=$code;
        } elseif (!$sent && getenv('APP_ENV')!=='production') {
            $data['development_code']=$code;
        }
        if(!$sent && getenv('APP_ENV')==='production') Response::error('We could not send the verification email. Please try again later.',503);
        $message = ($resend->isConfigured() || $mailDriver === 'gmail') && $sent
            ? 'Verification code sent to your email.'
            : 'Real email delivery is not configured locally. Use the test code shown below.';
        Response::success($message,$data);
    }

    public function me(): void {
        $authenticated = AuthMiddleware::authenticate();
        $user = $this->userModel->findById($authenticated['user_id']);

        if (!$user) {
            Response::error('User profile not found.', 404);
        }

        Response::success('Profile retrieved', ['user' => $user]);
    }

    public function refresh(): void {
        $input=json_decode(file_get_contents('php://input'),true)?:[];$refreshToken=$input['refresh_token']??'';
        if($refreshToken==='')Response::unauthorized('Refresh token is required.');
        $rotated=(new AuthSession())->rotate($refreshToken);if(!$rotated)Response::unauthorized('Refresh token is invalid, expired, or replayed.');
        $user=$this->userModel->findById($rotated['user_id']);if(!$user||!$user['is_active'])Response::unauthorized('Account is unavailable.');
        $payload=['user_id'=>$user['id'],'email'=>$user['email'],'full_name'=>$user['full_name'],'role'=>$user['role'],'student_faculty_id'=>$user['student_faculty_id']];
        Response::success('Session refreshed',['token'=>JWT::generate($payload,900),'refresh_token'=>$rotated['refresh_token'],'user'=>$user]);
    }

    public function logout(): void {
        $input=json_decode(file_get_contents('php://input'),true)?:[];if(!empty($input['refresh_token']))(new AuthSession())->revoke($input['refresh_token']);Response::success('Logged out securely.');
    }
}

<?php
require_once __DIR__.'/../backend/models/Payment.php';

$model = new Payment();
$property = new ReflectionProperty(Payment::class, 'db');
$property->setAccessible(true);
/** @var PDO $db */
$db = $property->getValue($model);
$db->beginTransaction();

try {
    $team = $db->query("SELECT tm.id,tm.tournament_id,tm.coach_user_id FROM teams tm LIMIT 1")->fetch();
    if (!$team) throw new RuntimeException('A team fixture is required for the payment smoke test.');
    $db->prepare("UPDATE tournaments SET registration_fee=1000 WHERE id=:id")->execute([':id'=>$team['tournament_id']]);
    $prefix = 'INSTALLMENT-SMOKE-'.bin2hex(random_bytes(4));
    $db->prepare("DELETE FROM payments WHERE team_id=:team AND tournament_id=:tournament")
        ->execute([':team'=>$team['id'], ':tournament'=>$team['tournament_id']]);
    $db->prepare("INSERT INTO payments(team_id,tournament_id,payment_method,reference_number,amount,status) VALUES(:team,:tournament,'gcash',:reference,400,'approved')")
        ->execute([':team'=>$team['id'], ':tournament'=>$team['tournament_id'], ':reference'=>$prefix.'-PAID']);

    $valid = $model->validateSubmission((int)$team['id'], (int)$team['tournament_id'], (int)$team['coach_user_id'], 'coach', $prefix.'-NEXT', 300);
    if (!$valid['valid'] || abs((float)$valid['remaining']-600)>0.01) throw new RuntimeException('A valid partial installment was not accepted with the correct balance.');

    $excess = $model->validateSubmission((int)$team['id'], (int)$team['tournament_id'], (int)$team['coach_user_id'], 'coach', $prefix.'-EXCESS', 700);
    if ($excess['valid']) throw new RuntimeException('An overpayment was accepted.');

    $db->prepare("INSERT INTO payments(team_id,tournament_id,payment_method,reference_number,amount,status) VALUES(:team,:tournament,'gcash',:reference,300,'pending')")
        ->execute([':team'=>$team['id'], ':tournament'=>$team['tournament_id'], ':reference'=>$prefix.'-PENDING']);
    $blocked = $model->validateSubmission((int)$team['id'], (int)$team['tournament_id'], (int)$team['coach_user_id'], 'coach', $prefix.'-BLOCKED', 100);
    if ($blocked['valid']) throw new RuntimeException('A second pending installment was accepted.');

    echo "Partial installment: PASS\nOverpayment guard: PASS\nPending-payment guard: PASS\nTest records rolled back.\n";
    $db->rollBack();
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    fwrite(STDERR, $error->getMessage()."\n");
    exit(1);
}

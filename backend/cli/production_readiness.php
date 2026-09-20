<?php
declare(strict_types=1);

$root=dirname(__DIR__,2);
$values=[];
foreach(file($root.'/.env',FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) ?: [] as $line){
    $line=trim($line);
    if($line===''||str_starts_with($line,'#')||!str_contains($line,'='))continue;
    [$key,$value]=explode('=',$line,2);
    $values[trim($key)]=trim($value," \t\n\r\0\x0B\"'");
}
$results=[];
$check=function(string $name,bool $ok,string $detail,string $level='required')use(&$results):void{
    $results[]=['check'=>$name,'status'=>$ok?'ready':($level==='required'?'missing':'warning'),'detail'=>$detail];
};
$appUrl=$values['APP_URL']??'';
$check('Production HTTPS',str_starts_with($appUrl,'https://'),'APP_URL must use the deployed HTTPS domain.');
$check('JWT secret',strlen($values['JWT_SECRET']??'')>=32,'JWT_SECRET must contain at least 32 characters.');
$origins=$values['CORS_ALLOWED_ORIGINS']??'';
$check('Restricted CORS',$origins!==''&&!str_contains($origins,'*'),'CORS must list only trusted frontend origins.');
$resendKey=$values['RESEND_API_KEY']??'';
$resendFrom=$values['RESEND_FROM']??'';
$check('Resend API',str_starts_with($resendKey,'re_'),'A Resend API key is required for production email.');
$check('Verified sender',$resendFrom!==''&&!str_contains($resendFrom,'onboarding@resend.dev'),'RESEND_FROM must use a verified custom domain.');
$check('SMS provider',!empty($values['SEMAPHORE_API_KEY']),'Semaphore is optional when mobile OTP is disabled.','optional');
$check('Reminder worker',is_file(__DIR__.'/dispatch_game_reminders.php'),'Schedule this command every five minutes on the production host.');
$check('Private environment',is_file($root.'/.gitignore')&&str_contains((string)file_get_contents($root.'/.gitignore'),'.env'),'.env is excluded from version control.');
$check('Upload storage',is_dir(dirname(__DIR__).'/uploads')&&is_writable(dirname(__DIR__).'/uploads'),'Uploads directory must remain private and writable.');

require_once dirname(__DIR__).'/config/database.php';
$db=(new Database())->getConnection();
$check('Database connection',$db instanceof PDO,'Backend must connect to Supabase PostgreSQL.');
if($db instanceof PDO){
    $columns=$db->query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='venues'")->fetchAll(PDO::FETCH_COLUMN);
    $check('Venue approval schema',count(array_intersect(['approval_status','submitted_by','reviewed_by','reviewed_at','review_notes'],$columns))===5,'Venue review columns must exist in Supabase.');
    $required=['users','organizations','tournaments','teams','team_players','matches','basketball_stat_events','qr_attendance'];
    $stmt=$db->query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    $tables=$stmt->fetchAll(PDO::FETCH_COLUMN);
    $check('Core schema',count(array_diff($required,$tables))===0,'Required FullCourt tables must exist.');
}

$counts=array_count_values(array_column($results,'status'));
echo json_encode(['summary'=>['ready'=>$counts['ready']??0,'warning'=>$counts['warning']??0,'missing'=>$counts['missing']??0],'checks'=>$results],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;
exit(($counts['missing']??0)>0?2:0);

<?php
declare(strict_types=1);

$envPath=dirname(__DIR__,2).'/.env';
if(is_file($envPath))foreach(file($envPath,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES) as $line){$line=trim($line);if($line===''||$line[0]==='#'||strpos($line,'=')===false)continue;[$key,$value]=array_map('trim',explode('=',$line,2));putenv($key.'='.$value);}

require_once dirname(__DIR__).'/models/GameReminder.php';

try{
    $result=(new GameReminder())->dispatchDue();
    fwrite(STDOUT,json_encode(['status'=>'ok','timestamp'=>date(DATE_ATOM)]+$result,JSON_UNESCAPED_SLASHES).PHP_EOL);
    exit(0);
}catch(Throwable $error){
    fwrite(STDERR,json_encode(['status'=>'error','timestamp'=>date(DATE_ATOM),'message'=>$error->getMessage()],JSON_UNESCAPED_SLASHES).PHP_EOL);
    exit(1);
}

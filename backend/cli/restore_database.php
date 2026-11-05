<?php
declare(strict_types=1);

require_once __DIR__.'/../models/SystemOperations.php';

$filename=$argv[1]??'';
$confirmed=in_array('--confirm',$argv,true);
if($filename===''||!$confirmed){
    fwrite(STDERR,"Usage: php backend/cli/restore_database.php fullcourt-backup-YYYYMMDD-HHMMSS.json.gz --confirm\n");
    fwrite(STDERR,"A verified safety backup is created automatically before restoration.\n");
    exit(2);
}

try{
    $result=(new SystemOperations())->restore($filename,0);
    echo json_encode(['status'=>'ok','restore'=>$result],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;
}catch(Throwable $error){
    fwrite(STDERR,json_encode(['status'=>'error','message'=>$error->getMessage()],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL);
    exit(1);
}

<?php
require_once __DIR__.'/../models/SystemOperations.php';

try {
    $result=(new SystemOperations())->backup(0);
    echo json_encode(['status'=>'ok','backup'=>$result],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR,json_encode(['status'=>'error','message'=>$error->getMessage()],JSON_PRETTY_PRINT).PHP_EOL);
    exit(1);
}

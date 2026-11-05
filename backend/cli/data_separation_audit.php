<?php
declare(strict_types=1);

require_once __DIR__.'/../config/database.php';

try{
    $db=(new Database())->getConnection()??throw new RuntimeException('Database unavailable.');
    $scalar=function(string $sql)use($db):int{return(int)$db->query($sql)->fetchColumn();};
    $report=[
        'database_driver'=>$db->getAttribute(PDO::ATTR_DRIVER_NAME),
        'demo_accounts'=>$scalar("SELECT COUNT(*) FROM users WHERE email LIKE '%@fullcourt.local'"),
        'practice_tournaments'=>$scalar("SELECT COUNT(*) FROM tournaments WHERE operation_mode='practice'"),
        'official_tournaments'=>$scalar("SELECT COUNT(*) FROM tournaments WHERE COALESCE(operation_mode,'official')='official'"),
        'published_tournaments'=>$scalar("SELECT COUNT(*) FROM tournaments WHERE is_published=1"),
        'checked_at'=>date(DATE_ATOM),
    ];
    $report['production_safe']=$report['demo_accounts']===0&&$report['practice_tournaments']===0;
    echo json_encode(['status'=>'ok','data_separation'=>$report,'recommendation'=>$report['production_safe']?'Database contains no obvious rehearsal identities.':'Use a separate production database; do not delete rehearsal records from the development database.'],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;
}catch(Throwable $error){
    fwrite(STDERR,json_encode(['status'=>'error','message'=>$error->getMessage()],JSON_PRETTY_PRINT).PHP_EOL);exit(1);
}

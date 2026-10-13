<?php
require_once __DIR__.'/../config/database.php';

class SystemOperations {
    private PDO $db;
    private string $backupDir;
    private const TABLES=['platform_settings','users','sports','tournaments','tournament_divisions','venues','courts','tournament_courts','schedule_constraints','teams','team_players','eligibility_documents','matches','match_scores','basketball_player_stats','basketball_stat_events','game_scoring_links','notifications','announcements','audit_logs'];
    public function __construct(){ $this->db=(new Database())->getConnection()??throw new RuntimeException('Database unavailable.');$this->backupDir=dirname(__DIR__,2).'/output/backups'; }
    public function health():array{
        if(!is_dir($this->backupDir))@mkdir($this->backupDir,0775,true);
        $files=glob($this->backupDir.'/fullcourt-backup-*.json.gz')?:[];usort($files,fn($a,$b)=>filemtime($b)<=>filemtime($a));
        $last=$files[0]??null;$counts=[];
        foreach(['tournaments','teams','team_players','matches'] as $table){try{$counts[$table]=(int)$this->db->query("SELECT COUNT(*) FROM {$table}")->fetchColumn();}catch(Throwable){$counts[$table]=null;}}
        return['database'=>'online','driver'=>$this->db->getAttribute(PDO::ATTR_DRIVER_NAME),'backup_directory_writable'=>is_writable($this->backupDir),'last_backup'=>$last?['file'=>basename($last),'created_at'=>date(DATE_ATOM,filemtime($last)),'size_bytes'=>filesize($last)]:null,'records'=>$counts,'checked_at'=>date(DATE_ATOM)];
    }
    public function backup(int $userId):array{
        if(!is_dir($this->backupDir)&&!mkdir($this->backupDir,0775,true))throw new RuntimeException('Backup directory could not be created.');
        $snapshot=['format'=>'fullcourt-json-backup-v1','created_at'=>date(DATE_ATOM),'created_by'=>$userId,'driver'=>$this->db->getAttribute(PDO::ATTR_DRIVER_NAME),'tables'=>[]];
        foreach(self::TABLES as $table){try{$snapshot['tables'][$table]=$this->db->query("SELECT * FROM {$table}")->fetchAll();}catch(Throwable){$snapshot['tables'][$table]=[];}}
        $encoded=json_encode($snapshot,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);if($encoded===false)throw new RuntimeException('Backup could not be encoded.');
        $filename='fullcourt-backup-'.date('Ymd-His').'.json.gz';$path=$this->backupDir.'/'.$filename;
        if(file_put_contents($path,gzencode($encoded,9),LOCK_EX)===false)throw new RuntimeException('Backup could not be written.');
        $verify=json_decode((string)gzdecode((string)file_get_contents($path)),true);if(($verify['format']??'')!=='fullcourt-json-backup-v1'){@unlink($path);throw new RuntimeException('Backup verification failed.');}
        $files=glob($this->backupDir.'/fullcourt-backup-*.json.gz')?:[];usort($files,fn($a,$b)=>filemtime($b)<=>filemtime($a));foreach(array_slice($files,30) as $old)@unlink($old);
        return['file'=>$filename,'size_bytes'=>filesize($path),'tables'=>count($snapshot['tables']),'created_at'=>$snapshot['created_at']];
    }
}

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
    public function restore(string $filename,int $userId):array{
        $safe=basename($filename);
        if($safe!==$filename||!preg_match('/^fullcourt-backup-\d{8}-\d{6}\.json\.gz$/',$safe))throw new InvalidArgumentException('Select a valid FullCourt backup filename.');
        $path=$this->backupDir.'/'.$safe;
        if(!is_file($path))throw new RuntimeException('The selected backup file does not exist.');
        $decoded=gzdecode((string)file_get_contents($path));
        $snapshot=is_string($decoded)?json_decode($decoded,true):null;
        if(!is_array($snapshot)||($snapshot['format']??'')!=='fullcourt-json-backup-v1'||!is_array($snapshot['tables']??null))throw new RuntimeException('Backup validation failed.');
        foreach(array_keys($snapshot['tables']) as $table){if(!in_array($table,self::TABLES,true))throw new RuntimeException("Backup contains an unsupported table: {$table}.");}
        $preRestore=$this->backup($userId);
        $driver=$this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        $tables=array_values(array_intersect(self::TABLES,array_keys($snapshot['tables'])));
        $inserted=[];
        try{
            if($driver==='mysql')$this->db->exec('SET FOREIGN_KEY_CHECKS=0');
            $this->db->beginTransaction();
            foreach(array_reverse($tables) as $table)$this->db->exec('DELETE FROM '.$this->quoteIdentifier($table,$driver));
            foreach($tables as $table){
                $rows=$snapshot['tables'][$table];$inserted[$table]=0;
                foreach($rows as $row){
                    if(!is_array($row)||$row===[])continue;
                    $columns=array_keys($row);$quoted=array_map(fn($column)=>$this->quoteIdentifier((string)$column,$driver),$columns);
                    $params=array_map(fn($column)=>':'.preg_replace('/[^a-zA-Z0-9_]/','_',strval($column)),$columns);
                    $stmt=$this->db->prepare('INSERT INTO '.$this->quoteIdentifier($table,$driver).' ('.implode(',',$quoted).') VALUES ('.implode(',',$params).')');
                    $values=[];foreach($columns as $index=>$column)$values[$params[$index]]=$row[$column];
                    $stmt->execute($values);$inserted[$table]++;
                }
            }
            $this->db->commit();
        }catch(Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
        finally{if($driver==='mysql')$this->db->exec('SET FOREIGN_KEY_CHECKS=1');}
        return['restored_from'=>$safe,'pre_restore_backup'=>$preRestore['file'],'tables'=>count($tables),'records'=>array_sum($inserted),'record_counts'=>$inserted,'restored_at'=>date(DATE_ATOM)];
    }
    private function quoteIdentifier(string $identifier,string $driver):string{
        if(!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/',$identifier))throw new InvalidArgumentException('Invalid database identifier.');
        return $driver==='pgsql'?'"'.$identifier.'"':'`'.$identifier.'`';
    }
}

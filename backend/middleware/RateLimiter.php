<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

class RateLimiter {
    public static function hit(string $action,int $maxRequests,int $windowSeconds,string $identity=''):void{
        $connection=(new Database())->getConnection();if(!$connection)return;
        $ip=$_SERVER['REMOTE_ADDR']??'local';$key=hash('sha256',$ip.'|'.strtolower($identity));
        $connection->beginTransaction();
        try{$stmt=$connection->prepare("SELECT request_count,window_started_at FROM api_rate_limits WHERE bucket_key=:key AND action_name=:action FOR UPDATE");$stmt->execute([':key'=>$key,':action'=>$action]);$row=$stmt->fetch();$expired=!$row||strtotime($row['window_started_at'])<=time()-$windowSeconds;
            if($expired){$up=$connection->prepare("INSERT INTO api_rate_limits (bucket_key,action_name,window_started_at,request_count) VALUES (:key,:action,NOW(),1) ON CONFLICT (bucket_key,action_name) DO UPDATE SET window_started_at=NOW(),request_count=1");$up->execute([':key'=>$key,':action'=>$action]);}
            elseif((int)$row['request_count']>=$maxRequests){$connection->commit();Response::json(429,'Too many requests. Please wait before trying again.',null,['retry_after'=>$windowSeconds]);}
            else{$connection->prepare("UPDATE api_rate_limits SET request_count=request_count+1 WHERE bucket_key=:key AND action_name=:action")->execute([':key'=>$key,':action'=>$action]);}
            $connection->commit();
        }catch(Throwable $e){if($connection->inTransaction())$connection->rollBack();throw$e;}
    }
}

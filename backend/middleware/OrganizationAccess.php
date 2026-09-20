<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

class OrganizationAccess {
    private static function db():PDO{$connection=(new Database())->getConnection();if(!$connection)throw new RuntimeException('Database unavailable.');return$connection;}
    public static function isPlatform(array $user):bool{return in_array($user['role'],['platform_admin','admin'],true);}
    public static function canAccessTournament(int $tournamentId,array $user):bool{
        if(self::isPlatform($user))return true;$db=self::db();$stmt=$db->prepare("SELECT t.id FROM tournaments t
            LEFT JOIN organization_members om ON om.organization_id=t.organization_id AND om.user_id=:member_user AND om.status='active' AND EXISTS (SELECT 1 FROM organizations approved_org WHERE approved_org.id=om.organization_id AND approved_org.status='active')
            LEFT JOIN teams coach_team ON coach_team.tournament_id=t.id AND (coach_team.coach_user_id=:coach_user OR coach_team.manager_user_id=:manager_user)
            LEFT JOIN teams player_team ON player_team.tournament_id=t.id LEFT JOIN team_players tp ON tp.team_id=player_team.id AND tp.user_id=:player_user
            LEFT JOIN matches m ON m.tournament_id=t.id LEFT JOIN game_assignments ga ON ga.match_id=m.id AND ga.user_id=:official_user
            WHERE t.id=:tournament_id AND (om.id IS NOT NULL OR coach_team.id IS NOT NULL OR tp.id IS NOT NULL OR ga.id IS NOT NULL OR t.created_by=:creator_user) LIMIT 1");
        $uid=(int)$user['user_id'];$stmt->execute([':member_user'=>$uid,':coach_user'=>$uid,':manager_user'=>$uid,':player_user'=>$uid,':official_user'=>$uid,':tournament_id'=>$tournamentId,':creator_user'=>$uid]);return(bool)$stmt->fetch();
    }
    public static function requireTournament(int $tournamentId,array $user):void{if(!self::canAccessTournament($tournamentId,$user))Response::forbidden('This tournament belongs to another organization.');}
    public static function requireMatch(int $matchId,array $user):void{$stmt=self::db()->prepare("SELECT tournament_id FROM matches WHERE id=:id");$stmt->execute([':id'=>$matchId]);$tid=$stmt->fetchColumn();if(!$tid)Response::error('Match not found.',404);self::requireTournament((int)$tid,$user);}
    public static function defaultOrganizationId(int $userId):?int{$stmt=self::db()->prepare("SELECT om.organization_id FROM organization_members om JOIN organizations o ON o.id=om.organization_id WHERE om.user_id=:user_id AND om.status='active' AND o.status='active' AND om.role IN ('organization_admin','organizer') ORDER BY om.id LIMIT 1");$stmt->execute([':user_id'=>$userId]);$id=$stmt->fetchColumn();return$id===false?null:(int)$id;}
}

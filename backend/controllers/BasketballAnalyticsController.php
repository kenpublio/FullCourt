<?php
require_once __DIR__.'/../config/database.php';
require_once __DIR__.'/../middleware/auth.php';
require_once __DIR__.'/../utils/response.php';
class BasketballAnalyticsController {
 private PDO $db;
 public function __construct(){ $c=(new Database())->getConnection();if(!$c)throw new RuntimeException('Database unavailable.');$this->db=$c; }
 public function player(int $userId):void{
  AuthMiddleware::authenticate();
  $q=$this->db->prepare("SELECT u.id,u.full_name,u.avatar_url,pp.height_cm,pp.primary_position,pp.is_public,COUNT(DISTINCT e.match_id) games_played,
   SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,
   SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists,
   SUM(CASE WHEN e.event_type='steal' THEN 1 ELSE 0 END) steals,SUM(CASE WHEN e.event_type='block' THEN 1 ELSE 0 END) blocks,
   SUM(CASE WHEN e.event_type='turnover' THEN 1 ELSE 0 END) turnovers,SUM(CASE WHEN e.event_type='personal_foul' THEN 1 ELSE 0 END) fouls,
   SUM(CASE WHEN e.event_type IN ('2pt_made','3pt_made') THEN 1 ELSE 0 END) fgm,SUM(CASE WHEN e.event_type IN ('2pt_made','2pt_missed','3pt_made','3pt_missed') THEN 1 ELSE 0 END) fga,
   SUM(CASE WHEN e.event_type='3pt_made' THEN 1 ELSE 0 END) three_made,SUM(CASE WHEN e.event_type IN ('3pt_made','3pt_missed') THEN 1 ELSE 0 END) three_attempted,
   SUM(CASE WHEN e.event_type='ft_made' THEN 1 ELSE 0 END) ft_made,SUM(CASE WHEN e.event_type IN ('ft_made','ft_missed') THEN 1 ELSE 0 END) ft_attempted,
   COALESCE((SELECT SUM(pgm.seconds_played) FROM player_game_minutes pgm JOIN team_players tpm ON tpm.id=pgm.team_player_id WHERE tpm.user_id=u.id),0) seconds_played
   FROM users u LEFT JOIN player_profiles pp ON pp.user_id=u.id LEFT JOIN team_players tp ON tp.user_id=u.id LEFT JOIN basketball_stat_events e ON e.team_player_id=tp.id AND e.is_void=0 WHERE u.id=:id GROUP BY u.id,pp.user_id");
  $q->execute([':id'=>$userId]);$s=$q->fetch();if(!$s)Response::error('Player not found.',404);$g=max(1,(int)$s['games_played']);
  $s['ppg']=round((int)$s['points']/$g,1);$s['rpg']=round((int)$s['rebounds']/$g,1);$s['apg']=round((int)$s['assists']/$g,1);$s['minutes_played']=round((int)$s['seconds_played']/60,1);
  $s['fg_pct']=$this->pct($s['fgm'],$s['fga']);$s['three_pct']=$this->pct($s['three_made'],$s['three_attempted']);$s['ft_pct']=$this->pct($s['ft_made'],$s['ft_attempted']);$s['assist_turnover_ratio']=(int)$s['turnovers']?round((int)$s['assists']/(int)$s['turnovers'],2):(int)$s['assists'];
  $t=$this->db->prepare("SELECT m.id,m.scheduled_start_time,tm.team_name,ROUND(COALESCE(pgm.seconds_played,0)/60,1) minutes_played,SUM(CASE e.event_type WHEN '2pt_made' THEN 2 WHEN '3pt_made' THEN 3 WHEN 'ft_made' THEN 1 ELSE 0 END) points,SUM(CASE WHEN e.event_type IN ('off_rebound','def_rebound') THEN 1 ELSE 0 END) rebounds,SUM(CASE WHEN e.event_type='assist' THEN 1 ELSE 0 END) assists FROM basketball_stat_events e JOIN team_players tp ON tp.id=e.team_player_id JOIN teams tm ON tm.id=e.team_id JOIN matches m ON m.id=e.match_id LEFT JOIN player_game_minutes pgm ON pgm.match_id=m.id AND pgm.team_player_id=tp.id WHERE tp.user_id=:id AND e.is_void=0 GROUP BY m.id,tm.id,pgm.seconds_played ORDER BY m.scheduled_start_time DESC LIMIT 5");
  $t->execute([':id'=>$userId]);Response::success('Player basketball analytics retrieved',['profile'=>$s,'last_five'=>$t->fetchAll(),'statistics_standard'=>['name'=>'FIBA Statisticians Manual 2024 terminology','note'=>'Court events separate attempts, makes, rebounds, assists, turnovers, steals, blocks and fouls.']]);
 }
 public function team(int $teamId):void{
  AuthMiddleware::authenticate();
  $q=$this->db->prepare("SELECT tm.id,tm.team_name,tm.short_name,tm.logo_url,tm.primary_color,tm.secondary_color,tm.status,
   u.full_name coach_name,t.name tournament_name,d.name division_name,
   (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id=tm.id) roster_count,
   (SELECT COUNT(*) FROM team_players tp WHERE tp.team_id=tm.id AND tp.eligibility_status='verified') verified_players,
   COUNT(DISTINCT m.id) games_played,
   SUM(CASE WHEN m.winner_team_id=tm.id THEN 1 ELSE 0 END) wins,
   SUM(CASE WHEN m.status='completed' AND m.winner_team_id<>tm.id THEN 1 ELSE 0 END) losses,
   ROUND(AVG(CASE WHEN m.team1_id=tm.id THEN ms.team1_score ELSE ms.team2_score END),1) scoring_average,
   ROUND(AVG(CASE WHEN m.team1_id=tm.id THEN ms.team2_score ELSE ms.team1_score END),1) opponent_average
   FROM teams tm
   LEFT JOIN users u ON u.id=tm.coach_user_id
   LEFT JOIN tournaments t ON t.id=tm.tournament_id
   LEFT JOIN divisions d ON d.id=tm.division_id
   LEFT JOIN matches m ON (m.team1_id=tm.id OR m.team2_id=tm.id) AND m.status='completed'
   LEFT JOIN match_scores ms ON ms.match_id=m.id
   WHERE tm.id=:id GROUP BY tm.id,u.id,t.id,d.id");
  $q->execute([':id'=>$teamId]);$team=$q->fetch();if(!$team)Response::error('Team not found.',404);
  $games=(int)$team['games_played'];$wins=(int)$team['wins'];
  $team['win_rate']=$games?round($wins/$games*100,1):0;
  $team['point_differential']=round((float)$team['scoring_average']-(float)$team['opponent_average'],1);
  $recent=$this->db->prepare("SELECT m.id,m.scheduled_start_time,m.winner_team_id,
   CASE WHEN m.team1_id=:team THEN a.team_name ELSE h.team_name END opponent,
   CASE WHEN m.team1_id=:team_score THEN ms.team1_score ELSE ms.team2_score END team_score,
   CASE WHEN m.team1_id=:opponent_score THEN ms.team2_score ELSE ms.team1_score END opponent_score
   FROM matches m JOIN teams h ON h.id=m.team1_id JOIN teams a ON a.id=m.team2_id
   JOIN match_scores ms ON ms.match_id=m.id
   WHERE (m.team1_id=:home OR m.team2_id=:away) AND m.status='completed'
   ORDER BY m.scheduled_start_time DESC LIMIT 5");
  $recent->execute([':team'=>$teamId,':team_score'=>$teamId,':opponent_score'=>$teamId,':home'=>$teamId,':away'=>$teamId]);
  Response::success('Team analytics retrieved',['team'=>$team,'recent_games'=>$recent->fetchAll()]);
 }
 public function outlook(int $matchId):void{
  AuthMiddleware::authenticate();
  $q=$this->db->prepare("SELECT m.team1_id,m.team2_id,h.team_name home_team,a.team_name away_team FROM matches m LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id WHERE m.id=:id");
  $q->execute([':id'=>$matchId]);$m=$q->fetch();if(!$m)Response::error('Match not found.',404);
  if(!$m['team1_id']||!$m['team2_id'])Response::error('Both teams must be known before calculating an outlook.',422);
  $h=$this->sample((int)$m['team1_id']);$a=$this->sample((int)$m['team2_id']);$n=$h['games']+$a['games'];
  $pointsTotal=max(1,$h['ppg']+$a['ppg']);
  $homeRating=($h['win_rate']*.60)+(($h['ppg']/$pointsTotal)*100*.40);
  $awayRating=($a['win_rate']*.60)+(($a['ppg']/$pointsTotal)*100*.40);
  $ratingTotal=max(1,$homeRating+$awayRating);
  $hp=$n===0?50:max(10,min(90,(int)round($homeRating/$ratingTotal*100)));
  $favored=$hp===50?'Even matchup':($hp>50?$m['home_team']:$m['away_team']);
  Response::success('Analytical match outlook retrieved',[
   'home_team'=>$m['home_team'],'away_team'=>$m['away_team'],'home_ppg'=>$h['ppg'],'away_ppg'=>$a['ppg'],
   'home_record'=>['wins'=>$h['wins'],'losses'=>$h['losses'],'win_rate'=>$h['win_rate'],'points_allowed'=>$h['papg'],'point_differential'=>$h['net']],
   'away_record'=>['wins'=>$a['wins'],'losses'=>$a['losses'],'win_rate'=>$a['win_rate'],'points_allowed'=>$a['papg'],'point_differential'=>$a['net']],
   'home_win_probability'=>$hp,'away_win_probability'=>100-$hp,'expected_total_points'=>round($h['ppg']+$a['ppg']),
   'expected_margin'=>round(abs($h['net']-$a['net']),1),'favored_team'=>$favored,
   'data_used'=>['home_completed_games'=>$h['games'],'away_completed_games'=>$a['games'],'total_completed_games'=>$n,'metrics'=>['win-loss record','win rate','average points scored','average points allowed','point differential']],
   'formula'=>'Team rating = 60% historical win rate + 40% share of combined average points. The two ratings are normalized to 100% and capped at 10%–90%. No completed games returns 50%–50%.',
   'confidence'=>$n>=10?'moderate':($n>=4?'limited':'very limited'),
   'limitations'=>['Small samples can change the estimate significantly.','Injuries, lineups, venue, and opponent strength are not yet modeled.','Only completed games recorded in FullCourt are included.'],
   'disclaimer'=>'Performance estimate only; not a betting prediction.'
  ]);
 }
 public function liveGames():void{AuthMiddleware::authorizeRoles(['platform_admin','admin','organization_admin','tournament_organizer']);$r=$this->db->query("SELECT m.id,t.name tournament_name,h.team_name home_team,a.team_name away_team,COALESCE(ms.team1_score,0) home_score,COALESCE(ms.team2_score,0) away_score,ms.current_period,ms.timer_seconds,m.status,m.scheduled_start_time,c.court_name,v.name venue_name,(SELECT COUNT(*) FROM game_assignments ga WHERE ga.match_id=m.id AND ga.status='accepted') officials_ready FROM matches m JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN teams h ON h.id=m.team1_id LEFT JOIN teams a ON a.id=m.team2_id LEFT JOIN match_scores ms ON ms.match_id=m.id LEFT JOIN courts c ON c.id=m.court_id LEFT JOIN venues v ON v.id=c.venue_id WHERE m.status IN ('scheduled','in_progress') AND (m.status='in_progress' OR DATE(m.scheduled_start_time)=CURRENT_DATE) ORDER BY CASE WHEN m.status='in_progress' THEN 0 ELSE 1 END,m.scheduled_start_time")->fetchAll();Response::success('Multi-court command center retrieved',['games'=>$r]);}
 private function sample(int $id):array{
  $q=$this->db->prepare("SELECT COUNT(*) games,SUM(CASE WHEN m.winner_team_id=:winner THEN 1 ELSE 0 END) wins,AVG(CASE WHEN m.team1_id=:scoring THEN ms.team1_score ELSE ms.team2_score END) ppg,AVG(CASE WHEN m.team1_id=:defending THEN ms.team2_score ELSE ms.team1_score END) papg FROM matches m JOIN match_scores ms ON ms.match_id=m.id WHERE (m.team1_id=:team1 OR m.team2_id=:team2) AND m.status='completed'");
  $q->execute([':winner'=>$id,':scoring'=>$id,':defending'=>$id,':team1'=>$id,':team2'=>$id]);$r=$q->fetch();
  $games=(int)$r['games'];$wins=(int)$r['wins'];$ppg=round((float)($r['ppg']?:0),1);$papg=round((float)($r['papg']?:0),1);
  return ['games'=>$games,'wins'=>$wins,'losses'=>$games-$wins,'win_rate'=>$games?round($wins/$games*100,1):50.0,'ppg'=>$ppg,'papg'=>$papg,'net'=>round($ppg-$papg,1)];
 }
 private function pct(mixed $m,mixed $a):float{return (int)$a?round((int)$m/(int)$a*100,1):0.0;}
}

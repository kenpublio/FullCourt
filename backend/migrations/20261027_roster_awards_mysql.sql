ALTER TABLE player_awards DROP FOREIGN KEY player_awards_ibfk_2;
ALTER TABLE player_awards MODIFY user_id INT NULL;
ALTER TABLE player_awards ADD COLUMN team_player_id INT NULL AFTER user_id;
ALTER TABLE player_awards ADD CONSTRAINT player_awards_team_player_fk FOREIGN KEY (team_player_id) REFERENCES team_players(id) ON DELETE CASCADE;
ALTER TABLE player_awards ADD UNIQUE KEY uniq_roster_player_award (award_category_id,team_player_id);

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS roster_locked_at timestamp NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS roster_locked_by integer NULL REFERENCES users(id);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS archived_at timestamp NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_status_reason varchar(500) NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_status_updated_by integer NULL REFERENCES users(id);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS operational_status_updated_at timestamp NULL;
ALTER TABLE game_scoring_links ADD COLUMN IF NOT EXISTS active_device_hash char(64) NULL;
ALTER TABLE game_scoring_links ADD COLUMN IF NOT EXISTS active_device_at timestamp NULL;

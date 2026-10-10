ALTER TABLE team_players ADD COLUMN IF NOT EXISTS player_name VARCHAR(150) NULL;
ALTER TABLE team_players ADD COLUMN IF NOT EXISTS birth_date DATE NULL;
ALTER TABLE team_players ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(150) NULL;
ALTER TABLE team_players ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR(80) NULL;
ALTER TABLE divisions ADD COLUMN IF NOT EXISTS age_cutoff_date DATE NULL;

ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS declared_birth_date DATE NULL;
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS birthdate_match BOOLEAN NULL;
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS mismatch_flag VARCHAR(80) NULL;

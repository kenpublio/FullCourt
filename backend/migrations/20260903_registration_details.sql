ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_team_name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS coaching_experience_years SMALLINT CHECK (coaching_experience_years BETWEEN 0 AND 120);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_designation VARCHAR(100);

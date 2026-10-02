-- Tournament review gate. Existing tournaments remain approved so current
-- schedules, results, and public pages continue working after migration.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS approval_status VARCHAR(12) NOT NULL DEFAULT 'approved';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS approval_notes TEXT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reviewed_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS tournaments_approval_status_idx ON tournaments(approval_status);

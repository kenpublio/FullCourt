-- For MySQL/MariaDB installations. Existing tournaments stay approved.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS approval_status VARCHAR(12) NOT NULL DEFAULT 'approved';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS approval_notes TEXT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reviewed_by INTEGER NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL;
CREATE INDEX tournaments_approval_status_idx ON tournaments(approval_status);

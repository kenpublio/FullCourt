ALTER TABLE venues ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS review_notes VARCHAR(500) NULL;

UPDATE venues SET approval_status='approved' WHERE approval_status='pending' AND submitted_by IS NULL;

CREATE INDEX IF NOT EXISTS venues_idx_approval_status ON venues(approval_status);
CREATE INDEX IF NOT EXISTS venues_idx_organization_status ON venues(organization_id, approval_status);

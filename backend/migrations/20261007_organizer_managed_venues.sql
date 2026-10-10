ALTER TABLE venues
  ALTER COLUMN approval_status SET DEFAULT 'approved';

UPDATE venues
SET approval_status = 'approved',
    reviewed_by = NULL,
    reviewed_at = NULL,
    review_notes = NULL
WHERE approval_status = 'pending';

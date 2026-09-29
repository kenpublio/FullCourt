ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS age_cutoff_date date DEFAULT NULL;

ALTER TABLE schedule_constraints
  ADD COLUMN IF NOT EXISTS daily_start_time time NOT NULL DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS daily_end_time time NOT NULL DEFAULT '20:00:00';

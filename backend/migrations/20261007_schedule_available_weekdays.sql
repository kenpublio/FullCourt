ALTER TABLE schedule_constraints
  ADD COLUMN IF NOT EXISTS available_weekdays varchar(27) NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun';

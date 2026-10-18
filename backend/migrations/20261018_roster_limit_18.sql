ALTER TABLE divisions
    ALTER COLUMN max_roster_size SET DEFAULT 18;

UPDATE divisions
SET max_roster_size = 18
WHERE max_roster_size = 15;

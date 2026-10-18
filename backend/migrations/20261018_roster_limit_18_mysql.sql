ALTER TABLE divisions
    MODIFY max_roster_size INT NOT NULL DEFAULT 18;

UPDATE divisions
SET max_roster_size = 18
WHERE max_roster_size = 15;

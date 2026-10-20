ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS operation_mode varchar(16) NOT NULL DEFAULT 'official';
UPDATE tournaments SET operation_mode='official' WHERE operation_mode IS NULL OR operation_mode='';
CREATE INDEX IF NOT EXISTS tournaments_operation_mode_idx ON tournaments(operation_mode);


ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_methods VARCHAR(80) NOT NULL DEFAULT 'gcash,maya,cash';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_account_name VARCHAR(150) NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_account_number VARCHAR(40) NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_deadline DATE NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_instructions TEXT NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_contact VARCHAR(150) NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_qr_url VARCHAR(500) NULL;

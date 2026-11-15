ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_methods varchar(80) NOT NULL DEFAULT 'gcash,maya,cash';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_account_name varchar(150) NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_account_number varchar(40) NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_deadline date NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_instructions text NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_contact varchar(150) NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_qr_url varchar(500) NULL;

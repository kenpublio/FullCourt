ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS id_type VARCHAR(60);
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS id_number_last4 VARCHAR(4);
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS id_birth_date DATE;
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS selfie_path VARCHAR(255);
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS selfie_mime_type VARCHAR(100);
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS birthdate_match BOOLEAN;
ALTER TABLE eligibility_documents ADD COLUMN IF NOT EXISTS consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE;


CREATE TABLE IF NOT EXISTS platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message VARCHAR(240) NOT NULL DEFAULT 'FullCourt is being improved. Some features may be temporarily unavailable.',
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

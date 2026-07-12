-- Garbanzo sighting reports
CREATE TABLE IF NOT EXISTS sightings (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,           -- Cloudflare Images ID
  image_url TEXT NOT NULL,          -- Full delivery URL
  reporter_name TEXT,               -- Optional
  reporter_contact TEXT,            -- Optional phone/email
  location TEXT,                    -- Where they saw the cat
  notes TEXT,                       -- Free text from reporter
  ai_verdict TEXT,                  -- 'pass' | 'reject' | 'unsure'
  ai_description TEXT,              -- AI-generated description of the photo
  ai_confidence REAL DEFAULT 0,     -- Confidence score 0-1
  ip_hash TEXT,                     -- Hashed IP for rate limiting audit
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'reviewed' | 'archived'
);

CREATE INDEX IF NOT EXISTS idx_sightings_status ON sightings(status);
CREATE INDEX IF NOT EXISTS idx_sightings_created ON sightings(created_at DESC);

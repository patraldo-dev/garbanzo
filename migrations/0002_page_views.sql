-- Visitor analytics (server-side collection via hooks.server.js)
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  city TEXT,
  asn_org TEXT,
  device TEXT,        -- mobile|desktop|tablet
  browser TEXT,
  ip_hash TEXT,       -- hashed, for unique-visitor counts only (DJB2 via hashIp)
  ua TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_pv_ip ON page_views(ip_hash);

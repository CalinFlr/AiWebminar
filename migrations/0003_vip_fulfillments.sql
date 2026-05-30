CREATE TABLE IF NOT EXISTS vip_fulfillments (
  session_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  amount_total INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT '',
  payment_link_id TEXT NOT NULL DEFAULT '',
  customer_id TEXT NOT NULL DEFAULT '',
  source_event_id TEXT NOT NULL DEFAULT '',
  source_event_type TEXT NOT NULL DEFAULT '',
  stripe_created INTEGER,
  fulfilled_at TEXT NOT NULL DEFAULT '',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  email_status TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_vip_fulfillments_lead_id ON vip_fulfillments(lead_id);
CREATE INDEX IF NOT EXISTS idx_vip_fulfillments_fulfilled_at ON vip_fulfillments(fulfilled_at);
CREATE INDEX IF NOT EXISTS idx_vip_fulfillments_sync_status ON vip_fulfillments(sync_status);

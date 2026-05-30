CREATE TABLE IF NOT EXISTS leads (
  lead_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT '',
  access TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  persona TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  server_received_at TEXT NOT NULL DEFAULT '',
  page_url TEXT NOT NULL DEFAULT '',
  utm_json TEXT NOT NULL DEFAULT '{}',
  checkout_url TEXT NOT NULL DEFAULT '',
  whatsapp_free_group_url TEXT NOT NULL DEFAULT '',
  reminder_message TEXT NOT NULL DEFAULT '',
  sms_reminder_url TEXT NOT NULL DEFAULT '',
  whatsapp_reminder_url TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS onboarding (
  onboarding_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL DEFAULT '',
  signup_email TEXT NOT NULL DEFAULT '',
  access TEXT NOT NULL DEFAULT '',
  persona TEXT NOT NULL DEFAULT '',
  stripe_session_id TEXT NOT NULL DEFAULT '',
  automation_idea TEXT NOT NULL DEFAULT '',
  current_tools TEXT NOT NULL DEFAULT '',
  public_link TEXT NOT NULL DEFAULT '',
  desired_outcome TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  server_received_at TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS payments (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT '',
  stripe_created INTEGER,
  session_id TEXT NOT NULL DEFAULT '',
  lead_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  amount_total INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  payment_link_id TEXT NOT NULL DEFAULT '',
  customer_id TEXT NOT NULL DEFAULT '',
  server_received_at TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT '',
  lead_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  access TEXT NOT NULL DEFAULT '',
  persona TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  action_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'de_trimis',
  last_sent_at TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'Calin',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(server_received_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_lead_id ON onboarding(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_reminders_lead_id ON reminders(lead_id);

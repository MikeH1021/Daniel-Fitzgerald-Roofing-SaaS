-- Add role column to companies (default company-admin for existing rows)
ALTER TABLE companies ADD COLUMN role text NOT NULL DEFAULT 'company-admin';

-- Add indexes for lead queries
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_company_created ON leads(company_id, created_at);

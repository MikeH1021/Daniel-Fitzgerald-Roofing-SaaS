-- Add unique index on company email to prevent duplicate accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email ON companies(email);

/**
 * Seed script for test company data.
 * Used by integration tests and local development.
 */
export async function seed(db: D1Database): Promise<void> {
  // Insert test company
  await db
    .prepare(
      "INSERT OR REPLACE INTO companies (id, name, email, logo_url, primary_color) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(
      'test-company-1',
      'Acme Roofing',
      'test@acme.com',
      'https://acme.com/logo.png',
      '#ff0000'
    )
    .run();

  // Insert pricing override: architectural material with custom costs
  await db
    .prepare(
      "INSERT OR REPLACE INTO pricing_overrides (id, company_id, material_key, cost_low, cost_high) VALUES (?, ?, ?, ?, ?)"
    )
    .bind('override-1', 'test-company-1', 'architectural', 4.5, 6.25)
    .run();
}

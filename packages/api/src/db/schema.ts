import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#2563eb'),
  createdAt: text('created_at').default("(datetime('now'))"),
  updatedAt: text('updated_at').default("(datetime('now'))"),
});

export const pricingOverrides = sqliteTable('pricing_overrides', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  materialKey: text('material_key').notNull(),
  costLow: real('cost_low'),
  costHigh: real('cost_high'),
  pitchFlat: real('pitch_flat'),
  pitchLow: real('pitch_low'),
  pitchMedium: real('pitch_medium'),
  pitchSteep: real('pitch_steep'),
});

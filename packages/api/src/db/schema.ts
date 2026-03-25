import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  slug: text('slug'),
  passwordHash: text('password_hash'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#2563eb'),
  role: text('role').default('company-admin').notNull(),
  createdAt: text('created_at').default("(datetime('now'))"),
  updatedAt: text('updated_at').default("(datetime('now'))"),
  archivedAt: text('archived_at'),
});

export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default("(datetime('now'))"),
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

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  companyId: text('company_id')
    .notNull()
    .references(() => companies.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  consentGiven: integer('consent_given', { mode: 'boolean' }).notNull(),
  consentText: text('consent_text').notNull(),
  sqft: real('sqft').notNull(),
  pitch: text('pitch').notNull(),
  material: text('material').notNull(),
  estimateLow: real('estimate_low').notNull(),
  estimateHigh: real('estimate_high').notNull(),
  address: text('address'),
  createdAt: text('created_at').default("(datetime('now'))"),
});

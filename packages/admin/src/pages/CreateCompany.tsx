import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { api } from '../api';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function CreateCompany() {
  const { route } = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await api.createCompany({ name, email, slug: slug || undefined });
      route(`/admin/companies/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
      setSaving(false);
    }
  };

  return (
    <div>
      <div class="page-header">
        <h2 class="page-title">New Company</h2>
        <p class="page-subtitle">Set up a new calculator instance for a client</p>
      </div>

      <div class="card">
        <form onSubmit={handleSubmit}>
          <div class="field">
            <label class="field-label" htmlFor="company-name">Company Name</label>
            <input
              id="company-name"
              class="input"
              type="text"
              value={name}
              onInput={(e) => handleNameChange((e.target as HTMLInputElement).value)}
              required
              placeholder="Acme Roofing"
            />
          </div>

          <div class="field">
            <label class="field-label" htmlFor="company-email">Email</label>
            <input
              id="company-email"
              class="input"
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
              placeholder="admin@company.com"
            />
          </div>

          <div class="field">
            <label class="field-label" htmlFor="company-slug">URL Slug</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span class="slug-prefix">/</span>
              <input
                id="company-slug"
                class="input"
                type="text"
                value={slug}
                onInput={(e) => {
                  setSlug((e.target as HTMLInputElement).value);
                  setSlugEdited(true);
                }}
                placeholder="acme-roofing"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </div>
          </div>

          {error && <div class="login-error" role="alert">{error}</div>}

          <div class="save-row" style={{ marginTop: '32px' }}>
            <button class="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Creating\u2026' : 'Create Company'}
            </button>
            <a href="/admin/companies" class="btn-edit">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}

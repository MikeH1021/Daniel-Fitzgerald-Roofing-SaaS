import { useState, useEffect, useRef } from 'preact/hooks';
import { api } from '../api';
import type { Company } from '../api';

export function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  const loadCompanies = (includeArchived: boolean) => {
    setLoading(true);
    api.listCompanies({ includeArchived }).then((data) => {
      if (!mountedRef.current) return;
      setCompanies(data);
      setLoading(false);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });
  };

  useEffect(() => {
    loadCompanies(showArchived);
    return () => { mountedRef.current = false; };
  }, []);

  const handleToggleArchived = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setShowArchived(checked);
    loadCompanies(checked);
  };

  const handleArchive = async (company: Company) => {
    if (!window.confirm(`Archive "${company.name}"? It will be hidden from the active list.`)) return;
    try {
      await api.archiveCompany(company.id);
      loadCompanies(showArchived);
      setError('');
    } catch {
      setError('Failed to archive company. Please try again.');
    }
  };

  const handleRestore = async (company: Company) => {
    try {
      await api.restoreCompany(company.id);
      loadCompanies(showArchived);
      setError('');
    } catch {
      setError('Failed to restore company. Please try again.');
    }
  };

  const handlePurge = async (company: Company) => {
    const confirmText = `Permanently delete "${company.name}" and all of its leads, pricing overrides, sessions, and logos? This cannot be undone.\n\nType the company name to confirm:`;
    const typed = window.prompt(confirmText);
    if (typed === null) return;
    if (typed.trim() !== company.name) {
      setError('Name did not match — purge cancelled.');
      return;
    }
    try {
      await api.purgeCompany(company.id);
      loadCompanies(showArchived);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete company.');
    }
  };

  if (loading) {
    return (
      <div>
        <div class="page-header">
          <div class="skeleton" style={{ width: '200px', height: '32px' }} />
        </div>
        <div class="card">
          <div class="skeleton" style={{ width: '100%', height: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 class="page-title">Companies</h2>
          <p class="page-subtitle">Manage calculator instances for your clients</p>
        </div>
        <a href="/admin/companies/new" class="btn btn-primary">
          + New Company
        </a>
      </div>

      {error && <div class="status-msg status-msg--error" role="alert" style={{ marginBottom: '16px' }}>{'\u2717'} {error}</div>}

      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--slate-400)' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={handleToggleArchived}
            style={{ cursor: 'pointer' }}
          />
          Show archived companies
        </label>
      </div>

      {companies.length === 0 ? (
        <div class="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <p class="page-subtitle" style={{ marginBottom: '16px' }}>
            {showArchived ? 'No archived companies' : 'No companies yet'}
          </p>
          {!showArchived && (
            <a href="/admin/companies/new" class="btn btn-primary">Create your first company</a>
          )}
        </div>
      ) : (
        <div class="card">
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Color</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} class={c.archivedAt ? 'company-archived' : ''}>
                    <td class="material-name">
                      {c.name}
                      {c.archivedAt && (
                        <span class="badge-archived">Archived</span>
                      )}
                    </td>
                    <td>
                      {c.slug ? (
                        <a href={`/${c.slug}`} class="slug-link" target="_blank" rel="noopener">
                          /{c.slug}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--slate-600)' }}>No slug</span>
                      )}
                    </td>
                    <td>
                      <div class="color-dot" style={{ backgroundColor: c.primaryColor }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!c.archivedAt && (
                          <a href={`/admin/companies/${c.id}`} class="btn-edit">
                            Edit
                          </a>
                        )}
                        {c.archivedAt ? (
                          <>
                            <button
                              class="btn btn-secondary"
                              style={{ fontSize: '13px', padding: '4px 12px' }}
                              onClick={() => handleRestore(c)}
                            >
                              Restore
                            </button>
                            <button
                              class="btn-archive"
                              style={{ color: '#ef4444', borderColor: '#ef4444' }}
                              onClick={() => handlePurge(c)}
                              title="Permanently delete (cannot be undone)"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            class="btn-archive"
                            onClick={() => handleArchive(c)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

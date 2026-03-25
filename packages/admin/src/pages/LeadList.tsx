import { useState, useEffect, useRef } from 'preact/hooks';
import { api, Lead } from '../api';

const PAGE_SIZE = 20;

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function LeadList({ companyId }: { companyId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Debounce search input
  function handleSearchInput(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const id = ++requestIdRef.current;
    api.getLeads(companyId, {
      search: search || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      pageSize: PAGE_SIZE,
    }).then((res) => {
      if (id !== requestIdRef.current) return; // Stale response, discard
      setLeads(res.data);
      setTotal(res.total);
      setLoading(false);
    }).catch(() => {
      if (id !== requestIdRef.current) return;
      setLoading(false);
    });
  }, [companyId, search, fromDate, toDate, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleExport() {
    setExporting(true);
    try {
      await api.exportLeadsCsv(companyId, {
        search: search || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div class="card">
      <div class="lead-filters">
        <input
          class="input"
          type="text"
          placeholder="Search by name or email..."
          value={searchInput}
          onInput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
          style={{ flex: '1', minWidth: '200px' }}
        />
        <div class="lead-date-filters">
          <label class="lead-date-label">From</label>
          <input
            class="input"
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate((e.target as HTMLInputElement).value); setPage(1); }}
            style={{ width: '150px' }}
          />
          <label class="lead-date-label">To</label>
          <input
            class="input"
            type="date"
            value={toDate}
            onChange={(e) => { setToDate((e.target as HTMLInputElement).value); setPage(1); }}
            style={{ width: '150px' }}
          />
        </div>
        <button
          class="export-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <p class="lead-loading">Loading...</p>
      ) : total === 0 ? (
        <p class="lead-empty">No leads yet.</p>
      ) : (
        <>
          <div class="lead-table-wrapper">
            <table class="lead-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Material</th>
                  <th>Estimate</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <span class="lead-name">{lead.firstName} {lead.lastName}</span>
                      {lead.address && (
                        <div class="lead-address">{lead.address}</div>
                      )}
                    </td>
                    <td>{lead.email}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.material}</td>
                    <td class="lead-estimate">
                      {fmt.format(lead.estimateLow)} &ndash; {fmt.format(lead.estimateHigh)}
                    </td>
                    <td class="lead-date">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div class="pagination">
            <button
              class="btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span class="pagination-info">Page {page} of {totalPages}</span>
            <button
              class="btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

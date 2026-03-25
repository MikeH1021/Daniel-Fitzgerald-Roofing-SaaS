import { useState, useEffect, useRef } from 'preact/hooks';
import { api } from '../api';

interface PricingRow {
  materialKey: string;
  costLow: number | null;
  costHigh: number | null;
  pitchFlat: number | null;
  pitchLow: number | null;
  pitchMedium: number | null;
  pitchSteep: number | null;
}

const MATERIALS = [
  { key: '3-tab', label: '3-Tab Shingles' },
  { key: 'architectural', label: 'Architectural Shingles' },
  { key: 'standing-seam-metal', label: 'Standing Seam Metal' },
];

const PITCH_FIELDS = [
  { key: 'pitchFlat', label: 'Flat' },
  { key: 'pitchLow', label: 'Low' },
  { key: 'pitchMedium', label: 'Medium' },
  { key: 'pitchSteep', label: 'Steep' },
] as const;

function emptyRow(materialKey: string): PricingRow {
  return { materialKey, costLow: null, costHigh: null, pitchFlat: null, pitchLow: null, pitchMedium: null, pitchSteep: null };
}

function validatePricing(rows: PricingRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const row of rows) {
    const k = row.materialKey;
    // Cost validations
    if (row.costLow !== null && row.costLow < 0) {
      errors[`${k}-costLow`] = 'Must be a positive value';
    }
    if (row.costHigh !== null && row.costHigh < 0) {
      errors[`${k}-costHigh`] = 'Must be a positive value';
    }
    if (row.costLow !== null && row.costHigh !== null && row.costLow >= row.costHigh) {
      errors[`${k}-costLow`] = 'Low must be less than high';
    }
    if (row.costLow !== null && row.costLow > 100) {
      errors[`${k}-costLow`] = 'Must be under $100/sqft';
    }
    if (row.costHigh !== null && row.costHigh > 100) {
      errors[`${k}-costHigh`] = 'Must be under $100/sqft';
    }
    // Pitch multiplier validations
    for (const p of PITCH_FIELDS) {
      const val = row[p.key];
      if (val !== null && val < 0) {
        errors[`${k}-${p.key}`] = 'Must be a positive value';
      }
      if (val !== null && val > 5.0) {
        errors[`${k}-${p.key}`] = 'Must be under 5.0';
      }
    }
  }
  return errors;
}

export function PricingSettings({ companyId }: { companyId?: string }) {
  const [rows, setRows] = useState<PricingRow[]>(MATERIALS.map((m) => emptyRow(m.key)));
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('success');
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const statusTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    api.getCompanyPricing(companyId).then((data) => {
      if (!mountedRef.current) return;
      const merged = MATERIALS.map((m) => {
        const existing = data.find((d: { materialKey: string }) => d.materialKey === m.key);
        return existing ? { ...emptyRow(m.key), ...existing } : emptyRow(m.key);
      });
      setRows(merged);
      setLoading(false);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });
    return () => {
      mountedRef.current = false;
      clearTimeout(statusTimer.current);
    };
  }, [companyId]);

  const updateField = (idx: number, field: keyof PricingRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const numVal = value === '' ? null : parseFloat(value);
      next[idx] = { ...next[idx], [field]: numVal };
      // Re-validate on every change
      setValidationErrors(validatePricing(next));
      return next;
    });
  };

  const handleSave = async () => {
    const errors = validatePricing(rows);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      setStatus('Please fix validation errors');
      setStatusType('error');
      clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => {
        if (mountedRef.current) setStatus('');
      }, 4000);
      return;
    }

    setStatus('Saving\u2026');
    setStatusType('info');
    try {
      const overrides = rows
        .filter((r) => r.costLow !== null || r.costHigh !== null || r.pitchFlat !== null || r.pitchLow !== null || r.pitchMedium !== null || r.pitchSteep !== null)
        .map((r) => {
          const o: Record<string, unknown> = { materialKey: r.materialKey };
          if (r.costLow !== null) o.costLow = r.costLow;
          if (r.costHigh !== null) o.costHigh = r.costHigh;
          if (r.pitchFlat !== null) o.pitchFlat = r.pitchFlat;
          if (r.pitchLow !== null) o.pitchLow = r.pitchLow;
          if (r.pitchMedium !== null) o.pitchMedium = r.pitchMedium;
          if (r.pitchSteep !== null) o.pitchSteep = r.pitchSteep;
          return o;
        });
      if (!companyId) throw new Error('No company ID');
      await api.updateCompanyPricing(companyId, overrides as Parameters<typeof api.updateCompanyPricing>[1]);
      if (!mountedRef.current) return;
      setStatus('Pricing saved successfully');
      setStatusType('success');
    } catch {
      if (!mountedRef.current) return;
      setStatus('Failed to save pricing');
      setStatusType('error');
    }
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => {
      if (mountedRef.current) setStatus('');
    }, 3000);
  };

  if (loading) {
    return (
      <div class="card">
        <div class="skeleton" style={{ width: '100%', height: '200px' }} />
      </div>
    );
  }

  return (
    <div>
      <div class="card stagger-1">
        <div class="card-header">
          <div class="card-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M10 2v16M14 5.5H8a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H6" />
            </svg>
          </div>
          <div>
            <h3 class="card-title">Material Costs</h3>
            <p class="card-description">Cost per square foot &mdash; leave blank for defaults</p>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Cost Low</th>
                <th scope="col">Cost High</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.materialKey}>
                  <td class="material-name">{MATERIALS.find((m) => m.key === row.materialKey)?.label}</td>
                  <td>
                    <input class="input input--number" type="number" step="0.01" value={row.costLow ?? ''} onInput={(e) => updateField(idx, 'costLow', (e.target as HTMLInputElement).value)} placeholder="\u2014" aria-label={`${MATERIALS[idx].label} cost low`} />
                    {validationErrors[`${row.materialKey}-costLow`] && (
                      <div class="field-error">{validationErrors[`${row.materialKey}-costLow`]}</div>
                    )}
                  </td>
                  <td>
                    <input class="input input--number" type="number" step="0.01" value={row.costHigh ?? ''} onInput={(e) => updateField(idx, 'costHigh', (e.target as HTMLInputElement).value)} placeholder="\u2014" aria-label={`${MATERIALS[idx].label} cost high`} />
                    {validationErrors[`${row.materialKey}-costHigh`] && (
                      <div class="field-error">{validationErrors[`${row.materialKey}-costHigh`]}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card stagger-2">
        <div class="card-header">
          <div class="card-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 17l4-8 4 5 3-4 3 7" /><path d="M3 3v14h14" />
            </svg>
          </div>
          <div>
            <h3 class="card-title">Pitch Multipliers</h3>
            <p class="card-description">Adjust multipliers based on roof steepness</p>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Material</th>
                {PITCH_FIELDS.map((p) => <th key={p.key} scope="col">{p.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.materialKey}>
                  <td class="material-name">{MATERIALS.find((m) => m.key === row.materialKey)?.label}</td>
                  {PITCH_FIELDS.map((p) => (
                    <td key={p.key}>
                      <input class="input input--number" type="number" step="0.01" value={row[p.key] ?? ''} onInput={(e) => updateField(idx, p.key, (e.target as HTMLInputElement).value)} placeholder="\u2014" aria-label={`${MATERIALS[idx].label} ${p.label} multiplier`} />
                      {validationErrors[`${row.materialKey}-${p.key}`] && (
                        <div class="field-error">{validationErrors[`${row.materialKey}-${p.key}`]}</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="save-row">
        <button class="btn btn-primary" onClick={handleSave}>Save Pricing</button>
        {status && (
          <span class={`status-msg status-msg--${statusType}`} role="status">
            {statusType === 'error' ? '\u2717' : statusType === 'info' ? '\u2022' : '\u2713'} {status}
          </span>
        )}
      </div>
    </div>
  );
}

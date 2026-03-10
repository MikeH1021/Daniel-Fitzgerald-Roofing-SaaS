import { useState, useEffect } from 'preact/hooks';
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

export function PricingSettings() {
  const [rows, setRows] = useState<PricingRow[]>(MATERIALS.map((m) => emptyRow(m.key)));
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPricing().then((data) => {
      const merged = MATERIALS.map((m) => {
        const existing = data.find((d) => d.materialKey === m.key);
        return existing ? { ...emptyRow(m.key), ...existing } : emptyRow(m.key);
      });
      setRows(merged);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateField = (idx: number, field: keyof PricingRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const numVal = value === '' ? null : parseFloat(value);
      next[idx] = { ...next[idx], [field]: numVal };
      return next;
    });
  };

  const handleSave = async () => {
    setStatus('Saving...');
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
      await api.updatePricing(overrides as Parameters<typeof api.updatePricing>[0]);
      setStatus('Pricing saved successfully');
    } catch {
      setStatus('Failed to save pricing');
    }
    setTimeout(() => setStatus(''), 3000);
  };

  if (loading) return <p>Loading...</p>;

  const inputStyle = { width: 80, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, textAlign: 'right' as const };
  const thStyle = { padding: '8px 12px', textAlign: 'left' as const, borderBottom: '2px solid #e5e7eb', fontSize: 13, fontWeight: 600 };
  const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #f3f4f6' };

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Pricing Overrides</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Leave fields blank to use default values. Costs are per sq ft.</p>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Material Costs ($/sq ft)</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={thStyle}>Material</th>
            <th style={thStyle}>Cost Low</th>
            <th style={thStyle}>Cost High</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.materialKey}>
              <td style={tdStyle}>{MATERIALS.find((m) => m.key === row.materialKey)?.label}</td>
              <td style={tdStyle}>
                <input
                  type="number"
                  step="0.01"
                  value={row.costLow ?? ''}
                  onInput={(e) => updateField(idx, 'costLow', (e.target as HTMLInputElement).value)}
                  style={inputStyle}
                  placeholder="default"
                />
              </td>
              <td style={tdStyle}>
                <input
                  type="number"
                  step="0.01"
                  value={row.costHigh ?? ''}
                  onInput={(e) => updateField(idx, 'costHigh', (e.target as HTMLInputElement).value)}
                  style={inputStyle}
                  placeholder="default"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Pitch Multipliers</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={thStyle}>Material</th>
            {PITCH_FIELDS.map((p) => (
              <th key={p.key} style={thStyle}>{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.materialKey}>
              <td style={tdStyle}>{MATERIALS.find((m) => m.key === row.materialKey)?.label}</td>
              {PITCH_FIELDS.map((p) => (
                <td key={p.key} style={tdStyle}>
                  <input
                    type="number"
                    step="0.01"
                    value={row[p.key] ?? ''}
                    onInput={(e) => updateField(idx, p.key, (e.target as HTMLInputElement).value)}
                    style={inputStyle}
                    placeholder="default"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleSave}
        style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer' }}
      >
        Save Pricing
      </button>

      {status && <p style={{ color: status.includes('Failed') ? '#dc2626' : '#059669', fontSize: 14, marginTop: 12 }}>{status}</p>}
    </div>
  );
}

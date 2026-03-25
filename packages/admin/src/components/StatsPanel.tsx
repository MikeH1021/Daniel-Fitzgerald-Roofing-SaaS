import { useState, useEffect } from 'preact/hooks';
import { api, Stats } from '../api';

const numFmt = new Intl.NumberFormat('en-US');

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function StatsPanel({ companyId }: { companyId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats(companyId).then((s) => {
      setStats(s);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [companyId]);

  if (loading) {
    return (
      <div class="stats-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} class="stat-card skeleton" style={{ height: '90px' }} />
        ))}
      </div>
    );
  }

  const s = stats ?? { totalLeads: 0, totalEstimates: 0, popularMaterial: null, averageSqft: 0 };

  return (
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Leads</div>
        <div class="stat-value">{numFmt.format(s.totalLeads)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Estimates</div>
        <div class="stat-value">{numFmt.format(s.totalEstimates)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Popular Material</div>
        <div class="stat-value">{s.popularMaterial ? titleCase(s.popularMaterial) : 'N/A'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Average Sq Ft</div>
        <div class="stat-value">{numFmt.format(Math.round(s.averageSqft))}</div>
      </div>
    </div>
  );
}

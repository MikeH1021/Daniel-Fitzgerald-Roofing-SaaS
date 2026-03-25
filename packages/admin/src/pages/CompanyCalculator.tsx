import '@widget/styles/widget.css';
import { App as WidgetApp } from '@widget/App';
import { useState, useEffect, useRef } from 'preact/hooks';

interface CompanyConfig {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  primaryColor: string;
}

export function CompanyCalculator({ slug }: { slug: string }) {
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    fetch(`/api/companies/by-slug/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        if (mountedRef.current) setConfig(data as CompanyConfig);
      })
      .catch(() => {
        if (mountedRef.current) setError(true);
      });
    return () => { mountedRef.current = false; };
  }, [slug]);

  if (error) {
    return (
      <div class="not-found-page">
        <h1>404</h1>
        <p>No calculator exists at this URL.</p>
        <a href="/">Back to demo</a>
      </div>
    );
  }

  if (!config) {
    return (
      <div class="calculator-page">
        <div class="calculator-loading">Loading calculator...</div>
      </div>
    );
  }

  return (
    <div class="calculator-page">
      <div class="demo-widget-wrapper">
        <div class="widget-host">
          <WidgetApp companyId={config.id} config={config} />
        </div>
      </div>
    </div>
  );
}

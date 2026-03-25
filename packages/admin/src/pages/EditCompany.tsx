import { useState, useEffect, useRef } from 'preact/hooks';
import { api } from '../api';
import { BrandingSettings } from '../components/BrandingSettings';
import { PricingSettings } from '../components/PricingSettings';
import { EmbedCode } from '../components/EmbedCode';
import { LeadList } from './LeadList';

type Tab = 'branding' | 'pricing' | 'embed' | 'leads';

const TABS: { key: Tab; label: string }[] = [
  { key: 'branding', label: 'Branding' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'embed', label: 'Embed' },
  { key: 'leads', label: 'Leads' },
];

export function EditCompany({ companyId }: { companyId: string }) {
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('branding');
  const mountedRef = useRef(true);

  useEffect(() => {
    api.getCompanySettings(companyId).then((s) => {
      if (!mountedRef.current) return;
      setCompanyName(s.name);
      setSlug(s.slug || '');
      setLoading(false);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });
    return () => { mountedRef.current = false; };
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <div class="page-header">
          <div class="skeleton" style={{ width: '250px', height: '32px' }} />
        </div>
        <div class="card">
          <div class="skeleton" style={{ width: '100%', height: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="page-header">
        <div class="breadcrumb">
          <a href="/admin/companies" class="breadcrumb-link">Companies</a>
          <span class="breadcrumb-sep">/</span>
          <span>{companyName}</span>
        </div>
        <h2 class="page-title">{companyName}</h2>
        {slug && (
          <p class="page-subtitle">
            Calculator URL: <a href={`/${slug}`} target="_blank" rel="noopener" class="slug-link">/{slug}</a>
          </p>
        )}
      </div>

      <div class="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            class={`tab-btn ${activeTab === tab.key ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div class="tab-content" key={activeTab}>
        {activeTab === 'branding' && <BrandingSettings companyId={companyId} />}
        {activeTab === 'pricing' && <PricingSettings companyId={companyId} />}
        {activeTab === 'embed' && <EmbedCode companyId={companyId} />}
        {activeTab === 'leads' && <LeadList companyId={companyId} />}
      </div>
    </div>
  );
}

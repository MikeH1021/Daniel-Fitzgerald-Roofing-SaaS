import { useState } from 'preact/hooks';
import { LoginForm } from './components/LoginForm';
import { BrandingSettings } from './components/BrandingSettings';
import { PricingSettings } from './components/PricingSettings';
import { EmbedCode } from './components/EmbedCode';
import { api } from './api';

type Tab = 'branding' | 'pricing' | 'embed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'branding', label: 'Branding' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'embed', label: 'Embed Code' },
];

export function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('branding');

  const handleLogin = (_companyId: string, name: string) => {
    setCompanyName(name);
    setLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    setLoggedIn(false);
    setCompanyName('');
  };

  if (!loggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const tabStyle = (active: boolean) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    background: 'none',
    color: active ? '#2563eb' : '#666',
    fontWeight: active ? 600 : 400,
    fontSize: 14,
    cursor: 'pointer',
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22 }}>{companyName} Settings</h1>
        <button
          onClick={handleLogout}
          style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, cursor: 'pointer', color: '#374151' }}
        >
          Log Out
        </button>
      </div>

      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24, display: 'flex', gap: 4 }}>
        {TABS.map((tab) => (
          <button key={tab.key} style={tabStyle(activeTab === tab.key)} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {activeTab === 'branding' && <BrandingSettings />}
        {activeTab === 'pricing' && <PricingSettings />}
        {activeTab === 'embed' && <EmbedCode />}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'preact/hooks';
import { api } from '../api';

export function BrandingSettings() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSettings().then((s) => {
      setLogoUrl(s.logoUrl);
      setPrimaryColor(s.primaryColor || '#2563eb');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleLogoUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setStatus('Uploading...');
    try {
      const result = await api.uploadLogo(file);
      setLogoUrl(result.logoUrl + '?t=' + Date.now());
      setStatus('Logo uploaded successfully');
    } catch {
      setStatus('Failed to upload logo');
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const handleColorChange = async (e: Event) => {
    const color = (e.target as HTMLInputElement).value;
    setPrimaryColor(color);
    try {
      await api.updateSettings({ primaryColor: color });
      setStatus('Color saved');
    } catch {
      setStatus('Failed to save color');
    }
    setTimeout(() => setStatus(''), 2000);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Branding</h2>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Company Logo</label>
        {logoUrl && (
          <img
            src={logoUrl}
            alt="Company logo"
            style={{ maxWidth: 200, maxHeight: 100, marginBottom: 12, display: 'block', border: '1px solid #eee', borderRadius: 4, padding: 4 }}
          />
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} />
        <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Max 1MB. PNG, JPEG, WebP, or SVG.</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: 8 }}>Brand Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="color" value={primaryColor} onChange={handleColorChange} style={{ width: 48, height: 36, border: 'none', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, color: '#666' }}>{primaryColor}</span>
        </div>
      </div>

      {status && <p style={{ color: '#059669', fontSize: 14, marginTop: 8 }}>{status}</p>}
    </div>
  );
}

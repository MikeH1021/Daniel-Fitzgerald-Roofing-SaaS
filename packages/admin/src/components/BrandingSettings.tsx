import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { api } from '../api';

type StatusType = 'success' | 'error' | 'info';

function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  fnRef.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((...args: never[]) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]) as T;
}

export function BrandingSettings({ companyId }: { companyId?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('success');
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    api.getCompanySettings(companyId).then((s) => {
      if (!mountedRef.current) return;
      setLogoUrl(s.logoUrl);
      setPrimaryColor(s.primaryColor || '#2563eb');
      setLoading(false);
    }).catch(() => {
      if (mountedRef.current) setLoading(false);
    });
    return () => {
      mountedRef.current = false;
      clearTimeout(statusTimer.current);
    };
  }, [companyId]);

  const showStatus = (msg: string, type: StatusType, ms = 3000) => {
    if (!mountedRef.current) return;
    clearTimeout(statusTimer.current);
    setStatus(msg);
    setStatusType(type);
    statusTimer.current = setTimeout(() => {
      if (mountedRef.current) setStatus('');
    }, ms);
  };

  const uploadFile = async (file: File) => {
    if (!companyId) return;
    showStatus('Uploading\u2026', 'info', 30000);
    try {
      const result = await api.uploadCompanyLogo(companyId, file);
      if (!mountedRef.current) return;
      setLogoUrl(result.logoUrl + '?t=' + Date.now());
      showStatus('Logo uploaded successfully', 'success');
    } catch {
      showStatus('Failed to upload logo', 'error');
    }
  };

  const handleLogoUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) {
      showStatus('Invalid file type', 'error');
      return;
    }
    await uploadFile(file);
  };

  const saveColor = useDebouncedCallback(async (color: string) => {
    if (!companyId) return;
    try {
      await api.updateCompanySettings(companyId, { primaryColor: color });
      showStatus('Color saved', 'success', 2000);
    } catch {
      showStatus('Failed to save color', 'error');
    }
  }, 300);

  const handleColorChange = (e: Event) => {
    const color = (e.target as HTMLInputElement).value;
    setPrimaryColor(color);
    saveColor(color);
  };

  if (loading) {
    return (
      <div>
        <div class="card">
          <div class="skeleton" style={{ width: '100%', height: '120px' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="card stagger-1">
        <div class="card-header">
          <div class="card-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="2" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="M17 13l-4-4L3 17" />
            </svg>
          </div>
          <div>
            <h3 class="card-title">Company Logo</h3>
            <p class="card-description">Displayed at the top of your calculator widget</p>
          </div>
        </div>

        <div
          class={`logo-upload-zone ${dragOver ? 'logo-upload-zone--dragover' : ''}`}
          onDragOver={(e: DragEvent) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {logoUrl && <img src={logoUrl} alt="Company logo" class="logo-preview" />}
          <div class="logo-upload-text">
            <strong>Click to upload</strong> or drag and drop<br />
            PNG, JPEG, WebP, or SVG (max 1MB)
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} aria-label="Upload company logo" />
        </div>
      </div>

      <div class="card stagger-2">
        <div class="card-header">
          <div class="card-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="10" cy="5" r="3" /><circle cx="5" cy="14" r="3" /><circle cx="15" cy="14" r="3" />
            </svg>
          </div>
          <div>
            <h3 class="card-title">Brand Color</h3>
            <p class="card-description">Applied to buttons, accents, and highlights</p>
          </div>
        </div>

        <div class="color-picker-group">
          <div class="color-swatch" style={{ backgroundColor: primaryColor }}>
            <input type="color" value={primaryColor} onInput={handleColorChange} aria-label="Choose brand color" />
          </div>
          <span class="color-hex">{primaryColor.toUpperCase()}</span>
        </div>
      </div>

      {status && (
        <div class={`status-msg status-msg--${statusType}`} role="status">
          {statusType === 'error' ? '\u2717' : statusType === 'info' ? '\u2022' : '\u2713'} {status}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from 'preact/hooks';

const DEFAULT_MAX_WIDTH = 460;

export function EmbedCode({ companyId }: { companyId?: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [maxWidth, setMaxWidth] = useState<string>(String(DEFAULT_MAX_WIDTH));
  const [width, setWidth] = useState<string>('100%');
  const mountedRef = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (companyId) {
      setOrigin(window.location.origin);
    }
    setLoading(false);
    return () => {
      mountedRef.current = false;
      clearTimeout(copyTimer.current);
    };
  }, [companyId]);

  // Only emit data-* attributes when the user changed them from defaults — keeps the
  // copy-paste snippet minimal for the common case.
  const code = useMemo(() => {
    if (!companyId || !origin) return '';
    const attrs: string[] = [
      `src="${origin}/widget/roofing-widget.js"`,
      `data-company-id="${companyId}"`,
    ];
    const trimmedMaxWidth = maxWidth.trim();
    if (trimmedMaxWidth && trimmedMaxWidth !== String(DEFAULT_MAX_WIDTH)) {
      attrs.push(`data-max-width="${trimmedMaxWidth}"`);
    }
    const trimmedWidth = width.trim();
    if (trimmedWidth && trimmedWidth !== '100%') {
      attrs.push(`data-width="${trimmedWidth}"`);
    }
    return `<script ${attrs.join(' ')}></script>`;
  }, [companyId, origin, maxWidth, width]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div class="card">
        <div class="skeleton" style={{ width: '100%', height: '80px' }} />
      </div>
    );
  }

  return (
    <div>
      <div class="card stagger-1">
        <div class="card-header">
          <div class="card-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 7l-4 3 4 3M13 7l4 3-4 3M11 4l-2 12" />
            </svg>
          </div>
          <div>
            <h3 class="card-title">Script Tag</h3>
            <p class="card-description">Paste this into your page's HTML</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div class="field" style={{ marginBottom: 0 }}>
            <label class="field-label" for="embed-max-width">Max width</label>
            <input
              id="embed-max-width"
              class="input"
              type="text"
              inputMode="numeric"
              value={maxWidth}
              placeholder={String(DEFAULT_MAX_WIDTH)}
              onInput={(e) => setMaxWidth((e.target as HTMLInputElement).value)}
            />
            <p class="card-description" style={{ marginTop: '6px' }}>
              Pixels by default. Use <code>460</code>, <code>500px</code>, or <code>30rem</code>. Below 320 may crop content.
            </p>
          </div>
          <div class="field" style={{ marginBottom: 0 }}>
            <label class="field-label" for="embed-width">Width</label>
            <input
              id="embed-width"
              class="input"
              type="text"
              value={width}
              placeholder="100%"
              onInput={(e) => setWidth((e.target as HTMLInputElement).value)}
            />
            <p class="card-description" style={{ marginTop: '6px' }}>
              How wide the widget fills its container. <code>100%</code> is responsive.
            </p>
          </div>
        </div>

        <div class="code-block">
          <code>{code}</code>
          <button
            class={`btn-copy ${copied ? 'btn-copy--copied' : ''}`}
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy embed code to clipboard'}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

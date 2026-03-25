import { useState, useEffect, useRef } from 'preact/hooks';

export function EmbedCode({ companyId }: { companyId?: string }) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (companyId) {
      // Generate embed code client-side for company-scoped view
      const origin = window.location.origin;
      setCode(`<script src="${origin}/widget/roofing-widget.js" data-company-id="${companyId}"></script>`);
      setLoading(false);
    } else {
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
      clearTimeout(copyTimer.current);
    };
  }, [companyId]);

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

        <div class="code-block">
          <code>{code}</code>
          <button
            class={`btn-copy ${copied ? 'btn-copy--copied' : ''}`}
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy embed code to clipboard'}
          >
            {copied ? '\u2713 Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

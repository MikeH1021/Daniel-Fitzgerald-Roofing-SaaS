import { useState, useEffect } from 'preact/hooks';
import { api } from '../api';

export function EmbedCode() {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEmbedCode().then((data) => {
      setCode(data.embedCode);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>Embed Code</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Copy this script tag and paste it into your website to display the roofing calculator widget.
      </p>
      <div style={{ position: 'relative' }}>
        <code style={{
          display: 'block',
          padding: 16,
          background: '#1e293b',
          color: '#e2e8f0',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontFamily: "'Fira Code', 'Consolas', monospace",
        }}>
          {code}
        </code>
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '6px 12px',
            background: copied ? '#059669' : '#475569',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

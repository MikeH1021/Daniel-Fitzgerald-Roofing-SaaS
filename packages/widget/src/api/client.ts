// Derive API base URL from the script tag's src attribute.
// In production, the widget JS is served from e.g. https://roofing-api.example.com/widget/roofing-widget.js
// so we strip the widget path to get the API origin.
// In dev (Vite), document.currentScript is a module script with no useful src, so we fall back to '' (same origin).
const scriptSrc = typeof document !== 'undefined'
  ? (document.currentScript as HTMLScriptElement | null)?.getAttribute('src') ?? ''
  : '';

function deriveApiBase(src: string): string {
  if (!src) return '';
  try {
    const url = new URL(src);
    return url.origin;
  } catch {
    // Relative URL -- same origin
    return '';
  }
}

export const apiBase = deriveApiBase(scriptSrc);

export async function fetchCompanyConfig(companyId: string): Promise<{
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}> {
  const res = await fetch(`${apiBase}/api/config/${companyId}`);
  if (!res.ok) {
    let message = 'Failed to load company config';
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      // Use default message if body is not JSON
    }
    throw new Error(message);
  }
  const data = await res.json();
  // Logos are stored as relative paths (/api/logos/:id). When the widget runs on a
  // third-party page, the browser would resolve them against the embedding origin
  // and 404. Anchor to the API origin we derived from the script src.
  if (data.logoUrl && data.logoUrl.startsWith('/') && apiBase) {
    data.logoUrl = `${apiBase}${data.logoUrl}`;
  }
  return data;
}

export async function fetchMapsKey(): Promise<string> {
  const res = await fetch(`${apiBase}/api/maps/key`);
  if (!res.ok) throw new Error('Failed to load Maps API key');
  const data = await res.json();
  return data.key;
}

export async function submitEstimate(data: {
  sqft: number;
  pitch: string;
  material: string;
  companyId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
  website?: string;
  address?: string;
}): Promise<{
  estimateLow: number;
  estimateHigh: number;
  disclaimer: string;
  configSource: string;
}> {
  const res = await fetch(`${apiBase}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body = await res.json();
      if (body.error) {
        message = body.error;
      }
      if (body.details && Array.isArray(body.details)) {
        message = body.details.map((d: { field: string; message: string }) => d.message).join('. ');
      }
    } catch {
      // If response body is not JSON, use status-based message
      if (res.status === 429) {
        message = 'Too many requests. Please try again later.';
      } else if (res.status >= 500) {
        message = 'Server error. Please try again later.';
      }
    }
    throw new Error(message);
  }
  return res.json();
}

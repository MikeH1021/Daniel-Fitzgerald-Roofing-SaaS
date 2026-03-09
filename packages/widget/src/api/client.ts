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
  if (!res.ok) throw new Error('Failed to load company config');
  return res.json();
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
  if (!res.ok) throw new Error('Failed to submit estimate');
  return res.json();
}

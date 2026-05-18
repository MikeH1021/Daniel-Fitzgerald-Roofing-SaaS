import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchCompanyConfig reads document.currentScript.src at module-evaluation time to derive
// the API base. In jsdom currentScript is null, so apiBase resolves to '' and relative
// logoUrls are left as-is. We patch the exported apiBase value via the module's getter
// where possible; otherwise we test the behavior that requires a non-empty apiBase by
// stubbing fetch and asserting the rewrite happens.

describe('fetchCompanyConfig logo URL handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites relative logo URL by prefixing apiBase when set', async () => {
    // Simulate the widget being loaded via a <script> tag from a different origin (as it
    // would be when embedded on a customer site). The api/client module reads
    // document.currentScript at evaluation time to derive apiBase.
    const fakeScript = document.createElement('script');
    fakeScript.setAttribute('src', 'https://api.example.com/widget/roofing-widget.js');
    Object.defineProperty(document, 'currentScript', {
      value: fakeScript,
      configurable: true,
    });

    const mod = await import('../src/api/client');
    expect(mod.apiBase).toBe('https://api.example.com');

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'co', name: 'Co', logoUrl: '/api/logos/co', primaryColor: '#000' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await mod.fetchCompanyConfig('co');
    expect(result.logoUrl).toBe('https://api.example.com/api/logos/co');

    Object.defineProperty(document, 'currentScript', { value: null, configurable: true });
  });

  it('leaves relative logo URL untouched when apiBase is empty (same-origin)', async () => {
    Object.defineProperty(document, 'currentScript', { value: null, configurable: true });
    const mod = await import('../src/api/client');
    expect(mod.apiBase).toBe('');

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'co', name: 'Co', logoUrl: '/api/logos/co', primaryColor: '#000' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await mod.fetchCompanyConfig('co');
    expect(result.logoUrl).toBe('/api/logos/co');
  });

  it('leaves absolute logo URL untouched', async () => {
    const mod = await import('../src/api/client');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'co', name: 'Co', logoUrl: 'https://cdn.example.com/co.png', primaryColor: '#000' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await mod.fetchCompanyConfig('co');
    expect(result.logoUrl).toBe('https://cdn.example.com/co.png');
  });

  it('leaves null logo URL as null', async () => {
    const mod = await import('../src/api/client');
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'co', name: 'Co', logoUrl: null, primaryColor: '#000' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await mod.fetchCompanyConfig('co');
    expect(result.logoUrl).toBeNull();
  });
});

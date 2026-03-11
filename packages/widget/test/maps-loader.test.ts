import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock google.maps before importing loader
const mockImportLibrary = vi.fn();

beforeEach(() => {
  // Clean up window.google between tests
  delete (window as any).google;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadMapsApi', () => {
  beforeEach(async () => {
    // Reset module between tests to clear loaderPromise singleton
    vi.resetModules();
  });

  it('injects a script element into document.head with the API key in textContent', async () => {
    const appendChildSpy = vi.spyOn(document.head, 'appendChild');

    const { loadMapsApi } = await import('../src/maps/loader');
    await loadMapsApi('my-api-key');

    expect(appendChildSpy).toHaveBeenCalledOnce();
    const script = appendChildSpy.mock.calls[0][0] as HTMLScriptElement;
    expect(script.textContent).toContain('my-api-key');
  });

  it('returns the same promise on second call (singleton)', async () => {
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => document.createElement('script'));

    const { loadMapsApi } = await import('../src/maps/loader');
    const promise1 = loadMapsApi('my-api-key');
    const promise2 = loadMapsApi('my-api-key');

    expect(promise1).toBe(promise2);
    await promise1;
  });

  it('resolves immediately without injecting a script if google.maps.importLibrary already exists', async () => {
    (window as any).google = { maps: { importLibrary: mockImportLibrary } };

    const appendChildSpy = vi.spyOn(document.head, 'appendChild');
    const { loadMapsApi } = await import('../src/maps/loader');

    await loadMapsApi('some-key');

    expect(appendChildSpy).not.toHaveBeenCalled();
  });
});

describe('importMapsLibrary', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('delegates to google.maps.importLibrary', async () => {
    const fakeLib = { AutocompleteSuggestion: class {} };
    (window as any).google = { maps: { importLibrary: vi.fn().mockResolvedValue(fakeLib) } };

    const { importMapsLibrary } = await import('../src/maps/loader');
    const result = await importMapsLibrary('places');

    expect((window as any).google.maps.importLibrary).toHaveBeenCalledWith('places');
    expect(result).toBe(fakeLib);
  });
});

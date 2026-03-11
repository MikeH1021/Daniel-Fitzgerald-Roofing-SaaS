import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h } from 'preact';
import { render } from 'preact';
import { currentStep, formData, updateField } from '../src/state/form';

// Mock the API client
vi.mock('../src/api/client', () => ({
  apiBase: '',
  fetchCompanyConfig: vi.fn().mockResolvedValue({
    id: 'test-co',
    name: 'Test Roofing',
    logoUrl: 'https://example.com/logo.png',
    primaryColor: '#ff6600',
  }),
  fetchMapsKey: vi.fn().mockResolvedValue('test-maps-key'),
  submitEstimate: vi.fn(),
}));

// Mock state/map module to control mapMode, mapError, and drawing signals
vi.mock('../src/state/map', () => ({
  mapMode: { value: false },
  mapError: { value: false },
  selectedPlace: { value: null },
  mapLoading: { value: false },
  apiKey: { value: null },
  suggestions: { value: [] },
  drawingSqft: { value: 0 },
  isDrawingActive: { value: false },
  hasFinishedPolygon: { value: false },
}));

// Mock maps/draw to prevent real Terra Draw calls
vi.mock('../src/maps/draw', () => ({
  initDraw: vi.fn(),
  destroyDraw: vi.fn(),
  startListeningForArea: vi.fn(),
  handleDoneDrawing: vi.fn(),
  handleClearPolygon: vi.fn(),
  _resetDrawForTesting: vi.fn(),
}));

// Mock maps/loader to prevent real CDN loading
vi.mock('../src/maps/loader', () => ({
  loadMapsApi: vi.fn().mockResolvedValue(undefined),
  importMapsLibrary: vi.fn().mockResolvedValue({}),
  loadTerraDrawScripts: vi.fn().mockResolvedValue(undefined),
  _resetTerraDrawLoaderForTesting: vi.fn(),
}));

describe('App Component', () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // Reset step and form state before each test
    currentStep.value = 0;
    formData.value = {
      sqft: '',
      pitch: '',
      material: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      consent: false,
    };

    // Reset map state mocks
    const { mapMode, mapError, selectedPlace, mapLoading, drawingSqft, isDrawingActive, hasFinishedPolygon } = await import('../src/state/map');
    mapMode.value = false;
    mapError.value = false;
    selectedPlace.value = null;
    mapLoading.value = false;
    drawingSqft.value = 0;
    isDrawingActive.value = false;
    hasFinishedPolygon.value = false;
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('branding: renders logo and applies primaryColor as --rc-primary', async () => {
    const { App } = await import('../src/App');
    render(h(App, { companyId: 'test-co' }), container);

    // Wait for async config fetch
    await vi.waitFor(() => {
      const img = container.querySelector('img.rc-logo') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://example.com/logo.png');
    });

    const widget = container.querySelector('.rc-widget') as HTMLElement;
    expect(widget).not.toBeNull();
    expect(widget.style.getPropertyValue('--rc-primary')).toBe('#ff6600');
  });

  it('step: filling form and clicking Next advances from step 0 to step 1', async () => {
    const { App } = await import('../src/App');
    render(h(App, { companyId: 'test-co' }), container);

    // Wait for config to load
    await vi.waitFor(() => {
      expect(container.querySelector('.rc-widget')).not.toBeNull();
    });

    // Should be on step 0 (RoofDetails)
    expect(container.querySelector('.rc-step-title')!.textContent).toContain('Roof Estimate');

    // Fill in form fields
    updateField('sqft', '1500');
    updateField('pitch', 'medium');
    updateField('material', 'architectural');

    // Click Next button
    const nextBtn = container.querySelector('.rc-btn-primary') as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();
    nextBtn.click();

    // Should advance to step 1 (ContactInfo)
    await vi.waitFor(() => {
      const title = container.querySelector('.rc-step-title');
      expect(title!.textContent).toContain('Contact');
    });
  });

  // UX-01 test 1: When mapMode=false (default), 'Measure on map' link is visible in step 0
  it('UX-01: mapMode=false shows "Measure on map" link in step 0', async () => {
    const { mapMode } = await import('../src/state/map');
    mapMode.value = false;

    const { App } = await import('../src/App');
    render(h(App, { companyId: 'test-co' }), container);

    await vi.waitFor(() => {
      expect(container.querySelector('.rc-widget')).not.toBeNull();
    });

    // Should see "Measure on map" link
    const links = Array.from(container.querySelectorAll('.rc-map-toggle'));
    const measureLink = links.find(el => el.textContent?.includes('Measure on map'));
    expect(measureLink).not.toBeUndefined();
  });

  // UX-01 test 2: When mapMode=true, map step title shows; 'Enter sqft manually' link is visible
  it('UX-01: mapMode=true shows map step title and "Enter sqft manually" link', async () => {
    const { mapMode } = await import('../src/state/map');
    mapMode.value = true;

    const { App } = await import('../src/App');
    render(h(App, { companyId: 'test-co' }), container);

    await vi.waitFor(() => {
      expect(container.querySelector('.rc-widget')).not.toBeNull();
    });

    // Should see map mode title
    const title = container.querySelector('.rc-step-title');
    expect(title?.textContent).toContain('Measure Your Roof');

    // Should see "Enter sqft manually" link
    const links = Array.from(container.querySelectorAll('.rc-map-toggle'));
    const manualLink = links.find(el => el.textContent?.includes('Enter sqft manually'));
    expect(manualLink).not.toBeUndefined();
  });

  // UX-02 test 1: When mapError=true, 'Measure on map' link is NOT in the DOM
  it('UX-02: mapError=true hides "Measure on map" link entirely', async () => {
    const { mapMode, mapError } = await import('../src/state/map');
    mapMode.value = false;
    mapError.value = true;

    const { App } = await import('../src/App');
    render(h(App, { companyId: 'test-co' }), container);

    await vi.waitFor(() => {
      expect(container.querySelector('.rc-widget')).not.toBeNull();
    });

    // "Measure on map" link should NOT be in the DOM when mapError=true
    const links = Array.from(container.querySelectorAll('.rc-map-toggle'));
    const measureLink = links.find(el => el.textContent?.includes('Measure on map'));
    expect(measureLink).toBeUndefined();
  });

  // UX-02 test 2: When fetchMapsKey rejects, mapError.value becomes true
  it('UX-02: fetchMapsKey rejection sets mapError.value=true', async () => {
    const { fetchMapsKey } = await import('../src/api/client');
    const { mapMode, mapError } = await import('../src/state/map');

    // Make fetchMapsKey reject
    (fetchMapsKey as any).mockRejectedValueOnce(new Error('CSP blocked'));
    mapMode.value = true;

    const { App } = await import('../src/App');
    render(h(App, { companyId: 'test-co' }), container);

    await vi.waitFor(() => {
      expect(container.querySelector('.rc-widget')).not.toBeNull();
    });

    // Wait for mapError to be set
    await vi.waitFor(() => {
      expect(mapError.value).toBe(true);
    });
  });
});

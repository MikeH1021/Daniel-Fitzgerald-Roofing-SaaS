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
  submitEstimate: vi.fn(),
}));

describe('App Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
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
});

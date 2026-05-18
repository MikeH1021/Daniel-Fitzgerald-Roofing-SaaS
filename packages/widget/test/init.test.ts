import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test initWidget which accepts a script element parameter
// This avoids relying on document.currentScript which is null in test context

describe('Widget Initialization', () => {
  beforeEach(() => {
    // Clean up any previous host elements
    document.querySelectorAll('#roofing-widget-host').forEach(el => el.remove());
    vi.restoreAllMocks();
  });

  it('company-id: creates shadow DOM host when data-company-id is present', async () => {
    const { initWidget } = await import('../src/index');

    const script = document.createElement('script');
    script.setAttribute('data-company-id', 'test-co');
    document.body.appendChild(script);

    initWidget(script);

    const host = document.getElementById('roofing-widget-host');
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();

    script.remove();
  });

  it('shadow: shadow root contains style element and render root div', async () => {
    const { initWidget } = await import('../src/index');

    const script = document.createElement('script');
    script.setAttribute('data-company-id', 'test-co');
    document.body.appendChild(script);

    initWidget(script);

    const host = document.getElementById('roofing-widget-host');
    const shadow = host!.shadowRoot!;

    const styleEl = shadow.querySelector('style');
    expect(styleEl).not.toBeNull();
    expect(styleEl!.textContent!.length).toBeGreaterThan(0);

    const root = shadow.getElementById('roofing-widget-root');
    expect(root).not.toBeNull();

    script.remove();
  });

  it('missing company-id: no host created, console.error called', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initWidget } = await import('../src/index');

    const script = document.createElement('script');
    // No data-company-id attribute
    document.body.appendChild(script);

    initWidget(script);

    const host = document.getElementById('roofing-widget-host');
    expect(host).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('data-company-id')
    );

    script.remove();
  });

  it('dimensions: data-max-width and data-width apply to host and CSS vars on render root', async () => {
    const { initWidget } = await import('../src/index');

    const script = document.createElement('script');
    script.setAttribute('data-company-id', 'test-co');
    script.setAttribute('data-max-width', '600');
    script.setAttribute('data-width', '90%');
    document.body.appendChild(script);

    initWidget(script);

    const host = document.getElementById('roofing-widget-host') as HTMLElement;
    expect(host.style.maxWidth).toBe('600px');
    expect(host.style.width).toBe('90%');

    const root = host.shadowRoot!.getElementById('roofing-widget-root') as HTMLElement;
    expect(root.style.getPropertyValue('--rc-max-width')).toBe('600px');
    expect(root.style.getPropertyValue('--rc-width')).toBe('90%');

    script.remove();
  });

  it('dimensions: explicit units pass through unchanged', async () => {
    const { initWidget } = await import('../src/index');

    const script = document.createElement('script');
    script.setAttribute('data-company-id', 'test-co');
    script.setAttribute('data-max-width', '30rem');
    document.body.appendChild(script);

    initWidget(script);

    const host = document.getElementById('roofing-widget-host') as HTMLElement;
    expect(host.style.maxWidth).toBe('30rem');

    script.remove();
  });

  it('dimensions: omitted attrs leave host inline styles empty (defaults apply via CSS)', async () => {
    const { initWidget } = await import('../src/index');

    const script = document.createElement('script');
    script.setAttribute('data-company-id', 'test-co');
    document.body.appendChild(script);

    initWidget(script);

    const host = document.getElementById('roofing-widget-host') as HTMLElement;
    expect(host.style.maxWidth).toBe('');
    expect(host.style.width).toBe('');

    script.remove();
  });
});

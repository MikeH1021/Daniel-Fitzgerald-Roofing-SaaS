import { render, h } from 'preact';
import { App } from './App';
import widgetStyles from './styles/widget.css?inline';

// Accept "460", "460px", "100%", "30rem", etc. Bare numbers get a px suffix.
function normalizeDimension(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

export function initWidget(script: HTMLScriptElement): void {
  const companyId = script.getAttribute('data-company-id');
  if (!companyId) {
    console.error('Roofing widget: missing data-company-id attribute');
    return;
  }

  const maxWidth = normalizeDimension(script.getAttribute('data-max-width'));
  const width = normalizeDimension(script.getAttribute('data-width'));

  // Create host element next to script tag
  const host = document.createElement('div');
  host.id = 'roofing-widget-host';
  // Host display is block; apply width to the host so it constrains the widget within its parent.
  if (maxWidth) host.style.maxWidth = maxWidth;
  if (width) host.style.width = width;
  script.parentElement!.insertBefore(host, script);

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles into shadow DOM
  const style = document.createElement('style');
  style.textContent = widgetStyles;
  shadow.appendChild(style);

  // Create render target inside shadow DOM
  const root = document.createElement('div');
  root.id = 'roofing-widget-root';
  // Expose dimensions to widget CSS so the inner .rc-widget matches the host.
  if (maxWidth) root.style.setProperty('--rc-max-width', maxWidth);
  if (width) root.style.setProperty('--rc-width', width);
  shadow.appendChild(root);

  // Render Preact app
  render(h(App, { companyId }), root);
}

// Auto-initialize when loaded as a script tag
(function () {
  const script =
    (document.currentScript as HTMLScriptElement | null) ||
    document.getElementById('roofing-widget-script') as HTMLScriptElement | null;
  if (script) {
    initWidget(script);
  }
})();

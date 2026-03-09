import { render, h } from 'preact';
import { App } from './App';
import widgetStyles from './styles/widget.css?inline';

export function initWidget(script: HTMLScriptElement): void {
  const companyId = script.getAttribute('data-company-id');
  if (!companyId) {
    console.error('Roofing widget: missing data-company-id attribute');
    return;
  }

  // Create host element next to script tag
  const host = document.createElement('div');
  host.id = 'roofing-widget-host';
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
  shadow.appendChild(root);

  // Render Preact app
  render(h(App, { companyId }), root);
}

// Auto-initialize when loaded as a script tag
(function () {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    initWidget(script);
  }
})();

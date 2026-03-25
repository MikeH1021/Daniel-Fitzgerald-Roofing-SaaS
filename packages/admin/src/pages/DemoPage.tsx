import '@widget/styles/widget.css';
import { App as WidgetApp } from '@widget/App';

const DEMO_CONFIG = {
  name: 'Demo Roofing Co',
  logoUrl: null,
  primaryColor: '#d97706',
};

export function DemoPage() {
  return (
    <div class="demo-page">
      <div class="demo-header">
        <h1 class="demo-title">Roofing Calculator</h1>
        <p class="demo-subtitle">Get an instant estimate for your roofing project</p>
      </div>
      <div class="demo-widget-wrapper">
        <div class="widget-host">
          <WidgetApp companyId="demo" config={DEMO_CONFIG} />
        </div>
      </div>
    </div>
  );
}

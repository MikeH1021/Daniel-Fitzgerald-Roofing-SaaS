import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { currentStep } from './state/form';
import { mapMode, selectedPlace, mapError, isDrawingActive, hasFinishedPolygon, drawingSqft } from './state/map';
import { destroyDraw } from './maps/draw';
import { fetchCompanyConfig } from './api/client';
import { RoofDetails } from './components/RoofDetails';
import { ContactInfo } from './components/ContactInfo';
import { EstimateDisplay } from './components/EstimateDisplay';
import { MapStep } from './components/MapStep';

export const companyConfig = signal<{
  name: string;
  logoUrl: string | null;
  primaryColor: string;
} | null>(null);

const configError = signal<string | null>(null);

interface AppProps {
  companyId: string;
  config?: { name: string; logoUrl: string | null; primaryColor: string };
}

const STEP_TITLES = [
  { title: 'Get Your Roof Estimate', subtitle: 'Tell us about your roof' },
  { title: 'Your Contact Info', subtitle: "We'll send your estimate here" },
  { title: 'Your Estimate is Ready', subtitle: 'Based on your roof details' },
];

const STEP_TITLES_MAP = [
  { title: 'Measure Your Roof', subtitle: 'Find your address and trace your roof' },
];

function StepProgress({ current }: { current: number }) {
  return (
    <div class="rc-progress">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          class={`rc-progress-pip ${i === current ? 'rc-progress-pip--active' : ''} ${i < current ? 'rc-progress-pip--done' : ''}`}
        />
      ))}
    </div>
  );
}

export function App({ companyId, config: initialConfig }: AppProps) {
  useEffect(() => {
    if (initialConfig) {
      companyConfig.value = initialConfig;
      configError.value = null;
      return;
    }
    companyConfig.value = null;
    configError.value = null;
    fetchCompanyConfig(companyId)
      .then((config) => {
        companyConfig.value = config;
      })
      .catch((err) => {
        configError.value = err.message || 'Failed to load configuration';
      });
  }, [companyId, initialConfig]);

  if (configError.value) {
    return <div class="rc-error">{configError.value}</div>;
  }

  if (!companyConfig.value) {
    return <div class="rc-loading">Loading calculator...</div>;
  }

  const config = companyConfig.value;
  const step = currentStep.value;
  const isMap = step === 0 && mapMode.value;
  const stepInfo = isMap ? STEP_TITLES_MAP[0] : STEP_TITLES[step];
  const stepNum = step + 1;

  return (
    <div
      class="rc-widget"
      style={{ '--rc-primary': config.primaryColor } as any}
    >
      <div class="rc-header" data-step={stepNum}>
        {config.logoUrl && (
          <img class="rc-logo" src={config.logoUrl} alt={config.name} />
        )}
        <StepProgress current={step} />
        <div class="rc-step-title">{stepInfo.title}</div>
        <div class="rc-step-subtitle">{stepInfo.subtitle}</div>
      </div>

      <div class="rc-body" key={`step-${step}-${isMap}`}>
        {step === 0 && (
          <div>
            {mapMode.value ? (
              <div>
                <MapStep />
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <a
                    class="rc-map-toggle"
                    onClick={() => {
                      mapMode.value = false;
                      selectedPlace.value = null;
                      isDrawingActive.value = false;
                      hasFinishedPolygon.value = false;
                      drawingSqft.value = 0;
                      destroyDraw();
                    }}
                  >
                    Enter sqft manually instead
                  </a>
                </div>
              </div>
            ) : (
              <div>
                <RoofDetails />
                {!mapError.value && (
                  <div style={{ marginTop: '16px', textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Don't know your roof size?</div>
                    <a
                      class="rc-map-toggle"
                      onClick={() => { mapMode.value = true; }}
                      style={{ fontSize: '14px' }}
                    >
                      Measure on satellite map
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {step === 1 && <ContactInfo companyName={config.name} companyId={companyId} />}
        {step === 2 && <EstimateDisplay />}
      </div>
    </div>
  );
}

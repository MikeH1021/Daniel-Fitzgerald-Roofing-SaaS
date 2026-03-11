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

const companyConfig = signal<{
  name: string;
  logoUrl: string | null;
  primaryColor: string;
} | null>(null);

const configError = signal<string | null>(null);

export function App({ companyId }: { companyId: string }) {
  useEffect(() => {
    companyConfig.value = null;
    configError.value = null;
    fetchCompanyConfig(companyId)
      .then((config) => {
        companyConfig.value = config;
      })
      .catch((err) => {
        configError.value = err.message || 'Failed to load configuration';
      });
  }, [companyId]);

  if (configError.value) {
    return <div class="rc-error">{configError.value}</div>;
  }

  if (!companyConfig.value) {
    return <div class="rc-loading">Loading...</div>;
  }

  const config = companyConfig.value;

  return (
    <div
      class="rc-widget"
      style={{ '--rc-primary': config.primaryColor } as any}
    >
      {config.logoUrl && (
        <img class="rc-logo" src={config.logoUrl} alt={config.name} />
      )}
      {currentStep.value === 0 && (
        <div>
          {mapMode.value ? (
            <div>
              <div class="rc-step-title">Measure Your Roof</div>
              <MapStep />
              <div style={{ marginTop: '8px', textAlign: 'center' }}>
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
                  Enter sqft manually
                </a>
              </div>
            </div>
          ) : (
            <div>
              <RoofDetails />
              <div style={{ marginTop: '8px', textAlign: 'center' }}>
                {!mapError.value && (
                  <a
                    class="rc-map-toggle"
                    onClick={() => { mapMode.value = true; }}
                  >
                    Measure on map
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {currentStep.value === 1 && <ContactInfo companyName={config.name} companyId={companyId} />}
      {currentStep.value === 2 && <EstimateDisplay />}
    </div>
  );
}

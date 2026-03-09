import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { currentStep } from './state/form';
import { fetchCompanyConfig } from './api/client';
import { RoofDetails } from './components/RoofDetails';
import { ContactInfo } from './components/ContactInfo';
import { EstimateDisplay } from './components/EstimateDisplay';

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
      {currentStep.value === 0 && <RoofDetails />}
      {currentStep.value === 1 && <ContactInfo companyName={config.name} />}
      {currentStep.value === 2 && <EstimateDisplay />}
    </div>
  );
}

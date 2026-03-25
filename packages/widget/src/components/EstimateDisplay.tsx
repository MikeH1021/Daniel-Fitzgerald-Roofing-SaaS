import { h } from 'preact';
import { estimateResult, currentStep, isLoading, formData, goToStep } from '../state/form';

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function EstimateDisplay() {
  if (isLoading.value) {
    return <div class="rc-loading">Calculating your estimate...</div>;
  }

  const result = estimateResult.value;

  function handleStartOver() {
    currentStep.value = 0;
    estimateResult.value = null;
    isLoading.value = false;
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
  }

  function handleEditRoof() {
    estimateResult.value = null;
    goToStep(0);
  }

  if (!result) {
    return (
      <div>
        <div class="rc-loading">No estimate available yet.</div>
        <button class="rc-btn-secondary" onClick={handleStartOver}>Start Over</button>
      </div>
    );
  }

  return (
    <div>
      <div class="rc-estimate-result">
        <div class="rc-estimate-badge">Estimated Cost Range</div>
        <div class="rc-estimate-range">
          <span>{formatCurrency(result.estimateLow)}</span> &ndash; <span>{formatCurrency(result.estimateHigh)}</span>
        </div>
      </div>

      <div class="rc-disclaimer">{result.disclaimer}</div>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button class="rc-btn-secondary" onClick={handleEditRoof}>
          Edit Roof Details
        </button>
        <div style={{ marginTop: '12px' }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); handleStartOver(); }}
            style={{ fontSize: '13px', color: 'inherit', opacity: 0.7 }}
          >
            Get Another Estimate
          </a>
        </div>
      </div>
    </div>
  );
}

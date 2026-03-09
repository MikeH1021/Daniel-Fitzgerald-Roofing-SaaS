import { h } from 'preact';
import { estimateResult, currentStep } from '../state/form';

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function EstimateDisplay() {
  const result = estimateResult.value;

  function handleStartOver() {
    currentStep.value = 0;
    estimateResult.value = null;
  }

  if (!result) {
    return (
      <div>
        <div class="rc-step-title">Your Estimate</div>
        <div class="rc-loading">No estimate available yet.</div>
        <button class="rc-btn-secondary" onClick={handleStartOver}>
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div>
      <div class="rc-step-title">Your Estimate</div>
      <div class="rc-estimate-range">
        {formatCurrency(result.estimateLow)} - {formatCurrency(result.estimateHigh)}
      </div>
      <div class="rc-disclaimer">{result.disclaimer}</div>
      <button
        class="rc-btn-secondary"
        onClick={handleStartOver}
        style={{ marginTop: '24px' }}
      >
        Start Over
      </button>
    </div>
  );
}

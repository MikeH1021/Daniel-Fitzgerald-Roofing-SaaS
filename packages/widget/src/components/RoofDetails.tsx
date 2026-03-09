import { h } from 'preact';
import { signal } from '@preact/signals';
import { formData, updateField, nextStep } from '../state/form';

const validationError = signal('');

export function RoofDetails() {
  const data = formData.value;

  function handleNext() {
    const current = formData.value;
    if (!current.sqft || !current.pitch || !current.material) {
      validationError.value = 'Please fill in all fields.';
      return;
    }
    const sqft = Number(current.sqft);
    if (sqft < 100 || sqft > 10000) {
      validationError.value = 'Square footage must be between 100 and 10,000.';
      return;
    }
    validationError.value = '';
    nextStep();
  }

  return (
    <div>
      <div class="rc-step-title">Get Your Roof Estimate</div>

      <label class="rc-label" for="rc-sqft">Square Footage</label>
      <input
        id="rc-sqft"
        class="rc-input"
        type="number"
        min="100"
        max="10000"
        placeholder="e.g. 1500"
        value={data.sqft}
        onInput={(e) => updateField('sqft', (e.target as HTMLInputElement).value)}
      />

      <label class="rc-label" for="rc-pitch">Roof Pitch</label>
      <select
        id="rc-pitch"
        class="rc-select"
        value={data.pitch}
        onChange={(e) => updateField('pitch', (e.target as HTMLSelectElement).value)}
      >
        <option value="">Select pitch...</option>
        <option value="flat">Flat</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="steep">Steep</option>
      </select>

      <label class="rc-label" for="rc-material">Material</label>
      <select
        id="rc-material"
        class="rc-select"
        value={data.material}
        onChange={(e) => updateField('material', (e.target as HTMLSelectElement).value)}
      >
        <option value="">Select material...</option>
        <option value="3-tab">3-Tab Shingles</option>
        <option value="architectural">Architectural Shingles</option>
        <option value="standing-seam-metal">Standing Seam Metal</option>
      </select>

      {validationError.value && (
        <div class="rc-error">{validationError.value}</div>
      )}

      <button class="rc-btn-primary" onClick={handleNext}>
        Next
      </button>
    </div>
  );
}

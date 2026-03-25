import { h } from 'preact';
import { signal } from '@preact/signals';
import { formData, updateField, prevStep, nextStep, estimateResult, isLoading } from '../state/form';
import { selectedPlace } from '../state/map';
import { submitEstimate } from '../api/client';

const errors = signal<Record<string, string>>({});
const submitError = signal<string | null>(null);

export function ContactInfo({ companyName, companyId }: { companyName: string; companyId: string }) {
  const data = formData.value;
  const fieldErrors = errors.value;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!data.firstName.trim()) errs.firstName = 'First name is required';
    if (!data.lastName.trim()) errs.lastName = 'Last name is required';
    if (!data.email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (!data.phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (data.phone.replace(/\D/g, '').length < 7) {
      errs.phone = 'Enter a valid phone number';
    }
    if (!data.consent) errs.consent = 'You must provide consent to continue';
    errors.value = errs;
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    submitError.value = null;
    isLoading.value = true;
    try {
      const result = await submitEstimate({
        sqft: Number(data.sqft),
        pitch: data.pitch,
        material: data.material,
        companyId,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        consent: data.consent,
        address: selectedPlace.value?.formattedAddress || undefined,
      });
      estimateResult.value = result;
      nextStep();
    } catch (err: any) {
      submitError.value = err.message || 'Failed to submit estimate';
    } finally {
      isLoading.value = false;
    }
  }

  return (
    <div>
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value="" />
      </div>

      <div class="rc-name-row">
        <div class="rc-field">
          <label class="rc-label" for="rc-fname">First Name</label>
          <input id="rc-fname" type="text" class="rc-input" placeholder="John" value={data.firstName} onInput={(e) => updateField('firstName', (e.target as HTMLInputElement).value)} />
          {fieldErrors.firstName && <div class="rc-error">{fieldErrors.firstName}</div>}
        </div>
        <div class="rc-field">
          <label class="rc-label" for="rc-lname">Last Name</label>
          <input id="rc-lname" type="text" class="rc-input" placeholder="Smith" value={data.lastName} onInput={(e) => updateField('lastName', (e.target as HTMLInputElement).value)} />
          {fieldErrors.lastName && <div class="rc-error">{fieldErrors.lastName}</div>}
        </div>
      </div>

      <div class="rc-field">
        <label class="rc-label" for="rc-email">Email Address</label>
        <input id="rc-email" type="email" class="rc-input" placeholder="john@example.com" value={data.email} onInput={(e) => updateField('email', (e.target as HTMLInputElement).value)} />
        {fieldErrors.email && <div class="rc-error">{fieldErrors.email}</div>}
      </div>

      <div class="rc-field">
        <label class="rc-label" for="rc-phone">Phone Number</label>
        <input id="rc-phone" type="tel" class="rc-input" placeholder="(555) 123-4567" value={data.phone} onInput={(e) => updateField('phone', (e.target as HTMLInputElement).value)} />
        {fieldErrors.phone && <div class="rc-error">{fieldErrors.phone}</div>}
      </div>

      <label class="rc-consent-label">
        <input type="checkbox" checked={data.consent} onChange={(e) => updateField('consent', (e.target as HTMLInputElement).checked)} />
        <span>
          I consent to receive communications from <strong>{companyName}</strong> regarding my
          roofing estimate. I understand that consent is not a condition of purchase.
        </span>
      </label>
      {fieldErrors.consent && <div class="rc-error">{fieldErrors.consent}</div>}

      {submitError.value && <div class="rc-error" style={{ marginTop: '8px', marginBottom: '8px' }}>{submitError.value}</div>}

      <div class="rc-btn-row">
        <button class="rc-btn-secondary" onClick={prevStep}>Back</button>
        <button class="rc-btn-primary" onClick={handleSubmit} disabled={isLoading.value}>
          {isLoading.value ? 'Getting Estimate\u2026' : 'Get My Estimate'}
        </button>
      </div>
    </div>
  );
}

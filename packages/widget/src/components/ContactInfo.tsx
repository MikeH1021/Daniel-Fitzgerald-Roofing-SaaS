import { h } from 'preact';
import { prevStep, nextStep } from '../state/form';

export function ContactInfo({ companyName }: { companyName: string }) {
  return (
    <div>
      <div class="rc-step-title">Your Contact Information</div>
      <p>Contact form fields will be added.</p>
      <div class="rc-btn-row">
        <button class="rc-btn-secondary" onClick={prevStep}>
          Back
        </button>
        <button class="rc-btn-primary" onClick={nextStep}>
          Next
        </button>
      </div>
    </div>
  );
}

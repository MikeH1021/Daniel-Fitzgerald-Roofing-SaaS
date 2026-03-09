import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { currentStep, formData, updateField, estimateResult, isLoading } from '../src/state/form';

// Mock the API client
const mockSubmitEstimate = vi.fn();
vi.mock('../src/api/client', () => ({
  apiBase: '',
  fetchCompanyConfig: vi.fn(),
  submitEstimate: (...args: any[]) => mockSubmitEstimate(...args),
}));

describe('ContactInfo Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    currentStep.value = 1;
    formData.value = {
      sqft: '2000',
      pitch: 'medium',
      material: 'architectural',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      consent: false,
    };
    estimateResult.value = null;
    isLoading.value = false;
    mockSubmitEstimate.mockReset();
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('fields: renders inputs for firstName, lastName, email (type=email), phone (type=tel)', async () => {
    const { ContactInfo } = await import('../src/components/ContactInfo');
    render(h(ContactInfo, { companyName: 'Test Roofing', companyId: 'test-co' }), container);

    const inputs = container.querySelectorAll('input');
    const types = Array.from(inputs).map((i) => i.type);
    const placeholders = Array.from(inputs).map((i) => i.placeholder);

    expect(placeholders).toContain('First Name');
    expect(placeholders).toContain('Last Name');
    expect(placeholders).toContain('Email Address');
    expect(placeholders).toContain('Phone Number');
    expect(types).toContain('email');
    expect(types).toContain('tel');
  });

  it('consent: checkbox is unchecked by default and label includes company name', async () => {
    const { ContactInfo } = await import('../src/components/ContactInfo');
    render(h(ContactInfo, { companyName: 'Acme Roofing', companyId: 'test-co' }), container);

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);

    // The consent text should include the company name
    const text = container.textContent || '';
    expect(text).toContain('Acme Roofing');
  });

  it('submit: clicking Get My Estimate with all fields and consent calls submitEstimate and advances', async () => {
    mockSubmitEstimate.mockResolvedValue({
      estimateLow: 8000,
      estimateHigh: 12000,
      disclaimer: 'This is an estimate only.',
      configSource: 'default',
    });

    const { ContactInfo } = await import('../src/components/ContactInfo');
    render(h(ContactInfo, { companyName: 'Test Roofing', companyId: 'test-co' }), container);

    // Fill in fields via signal
    updateField('firstName', 'John');
    updateField('lastName', 'Doe');
    updateField('email', 'john@example.com');
    updateField('phone', '5551234567');
    updateField('consent', true);

    // Re-render to pick up signal changes
    render(h(ContactInfo, { companyName: 'Test Roofing', companyId: 'test-co' }), container);

    // Click submit
    const submitBtn = container.querySelector('.rc-btn-primary') as HTMLButtonElement;
    expect(submitBtn).not.toBeNull();
    submitBtn.click();

    // Wait for async submitEstimate to resolve
    await vi.waitFor(() => {
      expect(mockSubmitEstimate).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockSubmitEstimate.mock.calls[0][0];
    expect(callArgs.firstName).toBe('John');
    expect(callArgs.lastName).toBe('Doe');
    expect(callArgs.email).toBe('john@example.com');
    expect(callArgs.phone).toBe('5551234567');
    expect(callArgs.consent).toBe(true);
    expect(callArgs.sqft).toBe(2000);

    // Should advance to step 2
    await vi.waitFor(() => {
      expect(currentStep.value).toBe(2);
    });
  });

  it('validation: submit with empty fields shows error messages', async () => {
    const { ContactInfo } = await import('../src/components/ContactInfo');
    render(h(ContactInfo, { companyName: 'Test Roofing', companyId: 'test-co' }), container);

    // Click submit without filling fields
    const submitBtn = container.querySelector('.rc-btn-primary') as HTMLButtonElement;
    submitBtn.click();

    // Re-render to show errors
    await vi.waitFor(() => {
      const errors = container.querySelectorAll('.rc-error');
      expect(errors.length).toBeGreaterThan(0);
    });

    // submitEstimate should NOT have been called
    expect(mockSubmitEstimate).not.toHaveBeenCalled();
  });
});

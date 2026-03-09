import { signal } from '@preact/signals';

export const currentStep = signal(0); // 0=roof, 1=contact, 2=estimate

export const formData = signal({
  sqft: '',
  pitch: '',
  material: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  consent: false,
});

export const estimateResult = signal<{
  estimateLow: number;
  estimateHigh: number;
  disclaimer: string;
} | null>(null);

export const isLoading = signal(false);

export function updateField(field: string, value: string | boolean) {
  formData.value = { ...formData.value, [field]: value };
}

export function nextStep() {
  currentStep.value = Math.min(currentStep.value + 1, 2);
}

export function prevStep() {
  currentStep.value = Math.max(currentStep.value - 1, 0);
}

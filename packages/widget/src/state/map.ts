import { signal } from '@preact/signals';
import type { PlacePredictionResult, SelectedPlace } from '../maps/types';

export const mapMode = signal(false);
export const apiKey = signal<string | null>(null);
export const selectedPlace = signal<SelectedPlace | null>(null);
export const suggestions = signal<PlacePredictionResult[]>([]);
export const mapLoading = signal(false);

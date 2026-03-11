import { signal } from '@preact/signals';
import type { PlacePredictionResult, SelectedPlace } from '../maps/types';

export const mapMode = signal(false);
export const apiKey = signal<string | null>(null);
export const selectedPlace = signal<SelectedPlace | null>(null);
export const suggestions = signal<PlacePredictionResult[]>([]);
export const mapLoading = signal(false);

// Phase 6: Drawing signals
export const drawingSqft = signal(0);          // live sqft counter during drawing
export const mapError = signal(false);          // true when Maps API blocked by CSP or network error
export const isDrawingActive = signal(false);   // true while Terra Draw polygon mode is active
export const hasFinishedPolygon = signal(false); // true after polygon closed/Done Drawing

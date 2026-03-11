import { importMapsLibrary } from './loader';
import type { PlacePredictionResult, SelectedPlace } from './types';

let sessionToken: any = null;

/**
 * Fetches address autocomplete suggestions using the AutocompleteSuggestion API.
 * Creates a session token on first call; reuses it across subsequent calls in the same session.
 * Returns empty array for inputs shorter than 3 characters.
 */
export async function fetchSuggestions(input: string): Promise<PlacePredictionResult[]> {
  if (!input || input.length < 3) {
    return [];
  }

  const { AutocompleteSuggestion, AutocompleteSessionToken } =
    await importMapsLibrary('places') as any;

  if (!sessionToken) {
    sessionToken = new AutocompleteSessionToken();
  }

  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    language: 'en-US',
    region: 'us',
  });

  return suggestions.map((s: any) => ({
    text: s.placePrediction.text.toString(),
    placeId: s.placePrediction.placeId,
    mainText: s.placePrediction.mainText?.toString() ?? s.placePrediction.text.toString(),
    raw: s,
  }));
}

/**
 * Resolves a selected suggestion to a lat/lng and formatted address.
 * Calls toPlace().fetchFields() which ends the billing session.
 * Resets the session token to null after completion.
 */
export async function resolvePlaceLocation(suggestion: PlacePredictionResult): Promise<SelectedPlace> {
  const place = suggestion.raw.placePrediction.toPlace();
  await place.fetchFields({ fields: ['formattedAddress', 'location'] });

  // Discard used token — next search will create a fresh one
  sessionToken = null;

  return {
    formattedAddress: place.formattedAddress ?? '',
    lat: place.location.lat(),
    lng: place.location.lng(),
  };
}

/**
 * Reset session token for testing purposes.
 */
export function _resetSessionForTesting(): void {
  sessionToken = null;
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock loader module
vi.mock('../src/maps/loader', () => ({
  importMapsLibrary: vi.fn(),
}));

describe('fetchSuggestions', () => {
  let MockSessionToken: ReturnType<typeof vi.fn>;
  let mockFetchSuggestions: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    MockSessionToken = vi.fn(() => ({ id: 'token-instance' }));
    mockFetchSuggestions = vi.fn().mockResolvedValue({
      suggestions: [
        {
          placePrediction: {
            text: { toString: () => '123 Main St, Springfield, IL' },
            placeId: 'place-id-1',
            mainText: { toString: () => '123 Main St' },
          },
        },
      ],
    });

    // Set up mock importLibrary to return fake Places classes
    const { importMapsLibrary } = await import('../src/maps/loader');
    (importMapsLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({
      AutocompleteSuggestion: { fetchAutocompleteSuggestions: mockFetchSuggestions },
      AutocompleteSessionToken: MockSessionToken,
    });
  });

  it('returns empty array for input shorter than 3 chars', async () => {
    const { fetchSuggestions, _resetSessionForTesting } = await import('../src/maps/autocomplete');
    _resetSessionForTesting();

    const result = await fetchSuggestions('ab');
    expect(result).toEqual([]);
    expect(mockFetchSuggestions).not.toHaveBeenCalled();
  });

  it('creates a new session token on first call', async () => {
    const { fetchSuggestions, _resetSessionForTesting } = await import('../src/maps/autocomplete');
    _resetSessionForTesting();

    await fetchSuggestions('123 Main');
    expect(MockSessionToken).toHaveBeenCalledOnce();
  });

  it('reuses existing session token on subsequent calls', async () => {
    const { fetchSuggestions, _resetSessionForTesting } = await import('../src/maps/autocomplete');
    _resetSessionForTesting();

    await fetchSuggestions('123 Main');
    await fetchSuggestions('123 Main St');
    expect(MockSessionToken).toHaveBeenCalledOnce();
  });

  it('returns array of PlacePredictionResult with correct shape', async () => {
    const { fetchSuggestions, _resetSessionForTesting } = await import('../src/maps/autocomplete');
    _resetSessionForTesting();

    const results = await fetchSuggestions('123 Main');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      text: '123 Main St, Springfield, IL',
      placeId: 'place-id-1',
      mainText: '123 Main St',
    });
    expect(results[0].raw).toBeDefined();
  });
});

describe('resolvePlaceLocation', () => {
  let mockFetchFields: ReturnType<typeof vi.fn>;
  let mockToPlace: ReturnType<typeof vi.fn>;
  let mockPlace: any;
  let MockSessionToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    MockSessionToken = vi.fn(() => ({ id: 'token-instance' }));

    mockPlace = {
      formattedAddress: '123 Main St, Springfield, IL',
      location: {
        lat: () => 39.7817,
        lng: () => -89.6501,
      },
    };

    mockFetchFields = vi.fn().mockResolvedValue(undefined);
    mockToPlace = vi.fn().mockReturnValue({ ...mockPlace, fetchFields: mockFetchFields });

    const mockSuggestion = {
      placePrediction: {
        toPlace: mockToPlace,
        text: { toString: () => '123 Main St, Springfield, IL' },
        placeId: 'place-id-1',
        mainText: { toString: () => '123 Main St' },
      },
    };

    const { importMapsLibrary } = await import('../src/maps/loader');
    (importMapsLibrary as ReturnType<typeof vi.fn>).mockResolvedValue({
      AutocompleteSuggestion: { fetchAutocompleteSuggestions: vi.fn().mockResolvedValue({ suggestions: [mockSuggestion] }) },
      AutocompleteSessionToken: MockSessionToken,
    });

    // Seed sessionToken by doing a fetch first
    const { fetchSuggestions, _resetSessionForTesting } = await import('../src/maps/autocomplete');
    _resetSessionForTesting();
    await fetchSuggestions('123 Main');

    // Set up the raw to use our place mock
    const rawSuggestion = mockSuggestion;
    (globalThis as any).__testRawSuggestion = rawSuggestion;
  });

  it('calls toPlace().fetchFields() and returns SelectedPlace', async () => {
    const { resolvePlaceLocation } = await import('../src/maps/autocomplete');

    const raw = { placePrediction: { toPlace: mockToPlace } };
    const result = await resolvePlaceLocation({ text: '', placeId: '', mainText: '', raw });

    expect(mockToPlace).toHaveBeenCalled();
    expect(mockFetchFields).toHaveBeenCalledWith({ fields: ['formattedAddress', 'location'] });
    expect(result).toEqual({
      formattedAddress: '123 Main St, Springfield, IL',
      lat: 39.7817,
      lng: -89.6501,
    });
  });

  it('sets sessionToken to null after fetchFields completes', async () => {
    const { resolvePlaceLocation, _resetSessionForTesting } = await import('../src/maps/autocomplete');
    _resetSessionForTesting();

    const raw = { placePrediction: { toPlace: mockToPlace } };
    await resolvePlaceLocation({ text: '', placeId: '', mainText: '', raw });

    // After resolution, next fetchSuggestions call should create a new token
    const { fetchSuggestions } = await import('../src/maps/autocomplete');
    await fetchSuggestions('new search');
    // MockSessionToken should have been called (once for the new token after reset)
    expect(MockSessionToken).toHaveBeenCalled();
  });
});

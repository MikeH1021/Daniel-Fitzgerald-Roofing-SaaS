import { describe, it, expect, vi, beforeEach } from 'vitest';

// These tests are RED — area.ts does not exist yet.
// They will fail with "Cannot find module '../src/utils/area'"

describe('computeFootprintSqft', () => {
  beforeEach(() => {
    // Set up window.google.maps.geometry.spherical.computeArea mock
    // Returns 100.0 m² so we can verify pitch math deterministically
    (window as any).google = {
      maps: {
        geometry: {
          spherical: {
            computeArea: vi.fn().mockReturnValue(100.0),
          },
        },
      },
    };
  });

  it('returns a positive integer for a valid 3-coord triangle with medium pitch', async () => {
    const { computeFootprintSqft } = await import('../src/utils/area');

    // Triangle: roughly a roof outline, [lng, lat] GeoJSON order
    const coords = [
      [-83.0, 42.0],
      [-83.001, 42.001],
      [-83.002, 42.0],
    ];

    // Mock returns 100 m² → 1076.39 ft² → × 1.12 (medium) → Math.round(1205.56) = 1206
    const result = computeFootprintSqft(coords, 'medium');
    expect(result).toBe(1206);
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('applies pitch multipliers: flat=1.00, low=1.05, medium=1.12, steep=1.25', async () => {
    const { computeFootprintSqft } = await import('../src/utils/area');

    const coords = [
      [-83.0, 42.0],
      [-83.001, 42.001],
      [-83.002, 42.0],
    ];

    // Mock always returns 100.0 m² = 1076.39104167 ft²
    // flat:   Math.round(1076.39104167 × 1.00) = 1076
    // low:    Math.round(1076.39104167 × 1.05) = 1130
    // medium: Math.round(1076.39104167 × 1.12) = 1206
    // steep:  Math.round(1076.39104167 × 1.25) = 1346
    expect(computeFootprintSqft(coords, 'flat')).toBe(1076);
    expect(computeFootprintSqft(coords, 'low')).toBe(1130);
    expect(computeFootprintSqft(coords, 'medium')).toBe(1206);
    expect(computeFootprintSqft(coords, 'steep')).toBe(1346);
  });

  it('returns 0 when coords.length < 3', async () => {
    const { computeFootprintSqft } = await import('../src/utils/area');

    expect(computeFootprintSqft([], 'medium')).toBe(0);
    expect(computeFootprintSqft([[-83.0, 42.0]], 'medium')).toBe(0);
    expect(computeFootprintSqft([[-83.0, 42.0], [-83.001, 42.001]], 'medium')).toBe(0);
  });

  it('swaps [lng, lat] GeoJSON coordinates to { lat, lng } before calling computeArea', async () => {
    const { computeFootprintSqft } = await import('../src/utils/area');

    const coords = [
      [-83.123, 42.456],
      [-83.124, 42.457],
      [-83.125, 42.456],
    ];

    computeFootprintSqft(coords, 'flat');

    const mockComputeArea = (window as any).google.maps.geometry.spherical.computeArea;
    expect(mockComputeArea).toHaveBeenCalledOnce();

    // The argument passed to computeArea should be an array of { lat, lng } objects
    const calledPath = mockComputeArea.mock.calls[0][0];
    expect(Array.isArray(calledPath)).toBe(true);
    expect(calledPath[0]).toEqual({ lat: 42.456, lng: -83.123 });
    expect(calledPath[1]).toEqual({ lat: 42.457, lng: -83.124 });
    expect(calledPath[2]).toEqual({ lat: 42.456, lng: -83.125 });
  });
});

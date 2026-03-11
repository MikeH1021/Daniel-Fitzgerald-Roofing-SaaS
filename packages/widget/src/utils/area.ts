// Authoritative pitch multipliers from packages/api/src/engine/defaults.ts
// flat=1.00, low=1.05, medium=1.12, steep=1.25
const PITCH_MULTIPLIERS: Record<string, number> = {
  flat: 1.00,
  low: 1.05,
  medium: 1.12,
  steep: 1.25,
};

const SQ_METERS_TO_SQ_FEET = 10.7639104167;

/**
 * Compute pitch-adjusted roof area in square feet from a GeoJSON polygon ring.
 * @param coords - GeoJSON outer ring: [[lng, lat], ...] (NOT [lat, lng])
 * @param pitch - one of: 'flat' | 'low' | 'medium' | 'steep'
 * @returns pitch-adjusted square footage, rounded to nearest integer
 */
export function computeFootprintSqft(coords: number[][], pitch: string): number {
  if (coords.length < 3) return 0;

  // GeoJSON uses [lng, lat]; Google Maps expects { lat, lng }
  const path = coords.map(([lng, lat]) => ({ lat, lng }));

  const spherical = (window as any).google.maps.geometry.spherical;
  const areaM2 = Math.abs(spherical.computeArea(path));
  const areaFt2 = areaM2 * SQ_METERS_TO_SQ_FEET;
  const pitchMult = PITCH_MULTIPLIERS[pitch] ?? 1.00;

  return Math.round(areaFt2 * pitchMult);
}

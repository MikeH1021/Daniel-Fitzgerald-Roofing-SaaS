import { computeFootprintSqft } from '../utils/area';
import { updateField } from '../state/form';
import { drawingSqft } from '../state/map';

let drawInstance: any = null;

/**
 * Initialize Terra Draw with the Google Maps adapter.
 * Calls draw.start() immediately but resolves only after the 'ready' event fires
 * (required because TerraDrawGoogleMapsAdapter creates an OverlayView asynchronously).
 */
export function initDraw(map: any): Promise<any> {
  return new Promise((resolve) => {
    const { TerraDraw, TerraDrawPolygonMode } = (window as any).terraDraw;
    const { TerraDrawGoogleMapsAdapter } = (window as any).terraDrawGoogleMapsAdapter;

    const draw = new TerraDraw({
      adapter: new TerraDrawGoogleMapsAdapter({
        lib: (window as any).google.maps,
        map,
        coordinatePrecision: 9,
      }),
      modes: [new TerraDrawPolygonMode()],
    });

    draw.start();

    // CRITICAL: Must wait for 'ready' before calling setMode
    // The adapter creates an OverlayView which is only ready asynchronously
    draw.on('ready', () => {
      drawInstance = draw;
      resolve(draw);
    });
  });
}

/**
 * Stop and clean up the Terra Draw instance.
 */
export function destroyDraw(): void {
  if (drawInstance) {
    drawInstance.stop();
    drawInstance = null;
  }
}

/**
 * Wire the 'change' and 'finish' events on the draw instance to compute live sqft
 * and auto-fill the form on polygon completion.
 *
 * @param draw - The Terra Draw instance (from initDraw)
 * @param pitch - Current pitch value for area calculation
 * @param onAreaUpdate - Callback called with sqft on every polygon change
 */
export function startListeningForArea(
  draw: any,
  pitch: string,
  onAreaUpdate: (sqft: number) => void
): void {
  draw.on('change', (ids: string[], type: string) => {
    if (type === 'delete') return;

    const snapshot = draw.getSnapshot();
    const polygon = snapshot.find(
      (f: any) => f.geometry.type === 'Polygon' && f.properties.mode === 'polygon'
    );
    if (!polygon) return;

    const coords = polygon.geometry.coordinates[0]; // outer ring: [[lng, lat], ...]
    if (coords.length < 3) return;

    const sqft = computeFootprintSqft(coords, pitch);
    drawingSqft.value = sqft;
    onAreaUpdate(sqft);
  });

  draw.on('finish', (id: string, context: { action: string; mode: string }) => {
    if (context.action !== 'draw') return;

    const snapshot = draw.getSnapshot();
    const polygon = snapshot.find((f: any) => f.id === id);
    if (!polygon) return;

    const coords = polygon.geometry.coordinates[0];
    const sqft = computeFootprintSqft(coords, pitch);
    onAreaUpdate(sqft);
    updateField('sqft', String(sqft));
  });
}

/**
 * Close an in-progress polygon by extracting its vertices, removing the ghost point,
 * and re-adding it as a closed feature.
 *
 * @returns The closed ring coordinates, or null if not enough vertices
 */
export function handleDoneDrawing(draw: any): number[][] | null {
  const snapshot = draw.getSnapshot();
  const inProgress = snapshot.find(
    (f: any) =>
      f.geometry.type === 'Polygon' &&
      f.properties.mode === 'polygon' &&
      f.properties.currentlyDrawing === true
  );

  if (!inProgress) return null;

  // Terra Draw polygon ring: [...vertices, ghostCursorPoint]
  // Remove the ghost (last point) to get actual placed vertices
  const ring = inProgress.geometry.coordinates[0];
  const vertices = ring.slice(0, -1);

  if (vertices.length < 3) return null;

  // Remove the in-progress feature and add a closed polygon
  draw.removeFeatures([inProgress.id]);

  const closedRing = [...vertices, vertices[0]];
  draw.addFeatures([
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [closedRing] },
      properties: { mode: 'polygon' },
    },
  ]);

  return closedRing;
}

/**
 * Remove all polygon features and restart polygon drawing mode.
 */
export function handleClearPolygon(draw: any): void {
  const snapshot = draw.getSnapshot();
  const polygonIds = snapshot
    .filter((f: any) => f.geometry.type === 'Polygon' || f.properties.mode === 'polygon')
    .map((f: any) => f.id);

  if (polygonIds.length > 0) {
    draw.removeFeatures(polygonIds);
  }

  draw.setMode('polygon');
}

/**
 * Reset the draw instance singleton for testing purposes.
 */
export function _resetDrawForTesting(): void {
  drawInstance = null;
}

import { computeFootprintSqft } from '../utils/area';
import { updateField } from '../state/form';
import { drawingSqft } from '../state/map';
import { importMapsLibrary } from './loader';

let polygon: any = null;
let polyline: any = null;
let clickListener: any = null;
let markers: any[] = [];
let mapRef: any = null;
let pathCoords: { lat: number; lng: number }[] = [];
let mapsCore: any = null;
let overlays: any[] = [];
let brandColor = '#2563eb';

/**
 * Initialize polygon drawing using native Google Maps API.
 */
export async function initDraw(map: any, color?: string): Promise<any> {
  mapRef = map;
  pathCoords = [];
  markers = [];
  if (color) brandColor = color;

  // Load core maps library
  await importMapsLibrary('maps');

  // Defer polygon/polyline creation to first click (ensures map is fully rendered)
  polygon = null;
  polyline = null;


  return {};
}

function cleanup() {
  if (clickListener) {
    google.maps.event.removeListener(clickListener);
    clickListener = null;
  }
  if (polygon) {
    polygon.setMap(null);
    polygon = null;
  }
  if (polyline) {
    polyline.setMap(null);
    polyline = null;
  }
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
  markers.forEach((m) => m.setMap(null));
  markers = [];
  pathCoords = [];
  mapRef = null;
}

/**
 * Stop and clean up the draw instance.
 */
export function destroyDraw(): void {
  cleanup();
}

/**
 * Wire click events on the map to build a polygon and compute live sqft.
 */
export function startListeningForArea(
  _draw: any,
  pitch: string,
  onAreaUpdate: (sqft: number) => void
): void {
  if (!mapRef) return;

  clickListener = mapRef.addListener('click', async (e: any) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    pathCoords.push({ lat, lng });

    // Create polygon/polyline on first click (lazy init ensures map is ready)
    if (!polyline) {
      const Polyline = (await importMapsLibrary('maps') as any).Polyline;
      polyline = new Polyline({
        strokeColor: brandColor,
        strokeWeight: 3,
        strokeOpacity: 1.0,
        zIndex: 10,
        map: mapRef,
      });
      }
    if (!polygon) {
      const Polygon = (await importMapsLibrary('maps') as any).Polygon;
      polygon = new Polygon({
        strokeColor: brandColor,
        strokeWeight: 3,
        strokeOpacity: 1.0,
        fillColor: brandColor,
        fillOpacity: 0.2,
        zIndex: 9,
        map: mapRef,
      });
    }

    // Add visible dot at click point
    const dot = createDot({ lat, lng }, mapRef);
    overlays.push(dot);

    const path = pathCoords.map(p => ({ lat: p.lat, lng: p.lng }));
    polyline.setPath(path);
    polygon.setPath(path);


    // Compute area if we have 3+ points
    if (pathCoords.length >= 3) {
      const coords = pathCoords.map((p) => [p.lng, p.lat]);
      coords.push(coords[0]);
      const sqft = computeFootprintSqft(coords, pitch);
      drawingSqft.value = sqft;
      onAreaUpdate(sqft);
    }
  });
}

/** Create a dot overlay at runtime (avoids extending google.maps.OverlayView at parse time) */
function createDot(latLng: { lat: number; lng: number }, map: any): any {
  const Overlay = google.maps.OverlayView;
  const dot = new Overlay();
  const pos = new google.maps.LatLng(latLng.lat, latLng.lng);
  let div: HTMLDivElement | null = null;

  dot.onAdd = function () {
    div = document.createElement('div');
    const s = div.style;
    s.position = 'absolute';
    s.width = '12px';
    s.height = '12px';
    s.borderRadius = '50%';
    s.background = brandColor;
    s.border = '2px solid #fff';
    s.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
    s.transform = 'translate(-50%, -50%)';
    dot.getPanes()!.overlayMouseTarget.appendChild(div);
  };

  dot.draw = function () {
    if (!div) return;
    const proj = dot.getProjection();
    const pt = proj.fromLatLngToDivPixel(pos)!;
    div.style.left = pt.x + 'px';
    div.style.top = pt.y + 'px';
  };

  dot.onRemove = function () {
    div?.remove();
    div = null;
  };

  dot.setMap(map);
  return dot;
}

/**
 * Finalize the polygon — stop listening for clicks, return closed ring.
 */
export function handleDoneDrawing(_draw: any): number[][] | null {
  if (clickListener) {
    google.maps.event.removeListener(clickListener);
    clickListener = null;
  }

  if (pathCoords.length < 3) return null;

  // Hide polyline, show filled polygon
  if (polyline) polyline.setPath([]);

  const coords = pathCoords.map((p) => [p.lng, p.lat]);
  coords.push(coords[0]);
  return coords;
}

/**
 * Remove all polygon features and restart drawing.
 */
export function handleClearPolygon(_draw: any): void {
  pathCoords = [];
  overlays.forEach((o) => o.setMap(null));
  overlays = [];
  markers.forEach((m) => m.setMap(null));
  markers = [];
  if (polygon) polygon.setPath([]);
  if (polyline) polyline.setPath([]);
}

/**
 * Reset for testing purposes.
 */
export function _resetDrawForTesting(): void {
  cleanup();
}

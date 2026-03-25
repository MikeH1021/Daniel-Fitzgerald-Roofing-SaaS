import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { fetchMapsKey } from '../api/client';
import { loadMapsApi, importMapsLibrary } from '../maps/loader';
import { initDraw, destroyDraw, startListeningForArea, handleDoneDrawing, handleClearPolygon } from '../maps/draw';
import { apiKey, selectedPlace, mapLoading, mapError, isDrawingActive, hasFinishedPolygon, drawingSqft, mapMode } from '../state/map';
import { updateField, formData } from '../state/form';
import { AddressAutocomplete } from './AddressAutocomplete';
import { MapView } from './MapView';
import { DrawingControls } from './DrawingControls';
import { computeFootprintSqft } from '../utils/area';
import type { SelectedPlace } from '../maps/types';
import { companyConfig } from '../App';

// Pitch key → display label
const PITCH_LABELS: Record<string, string> = {
  flat: 'flat',
  low: 'low',
  medium: 'medium',
  steep: 'steep',
};

export function MapStep() {
  const mapInstanceRef = useRef<any>(null);
  const drawRef = useRef<any>(null);

  useEffect(() => {
    async function activate() {
      mapLoading.value = true;
      try {
        const key = await fetchMapsKey();
        apiKey.value = key;
        await loadMapsApi(key);
      } catch (_err) {
        // Maps API blocked by CSP, network error, or worker unavailable
        mapError.value = true;
        mapLoading.value = false;
        return;
      }
      mapLoading.value = false;
    }
    activate();

    // Cleanup: destroy Terra Draw on unmount to prevent duplicate overlays on re-mount
    return () => {
      destroyDraw();
    };
  }, []);

  function handlePlaceSelected(place: SelectedPlace) {
    selectedPlace.value = place;
  }

  function handleMapReady(map: any) {
    mapInstanceRef.current = map;
  }

  async function activateDrawing() {
    const mapInstance = mapInstanceRef.current;
    if (!mapInstance) return;

    try {
      // 1. Load geometry library (required for computeArea)
      await importMapsLibrary('geometry');

      // 2. Initialize native Google Maps polygon drawing
      const color = companyConfig.value?.primaryColor;
      const draw = await initDraw(mapInstance, color || undefined);
      drawRef.current = draw;

      isDrawingActive.value = true;

      // 3. Wire live area updates via map click listener
      const pitch = formData.value.pitch || 'medium';
      startListeningForArea(draw, pitch, (sqft) => {
        drawingSqft.value = sqft;
      });
    } catch (_err) {
      console.error('[RoofingWidget] Drawing init error:', _err);
      mapError.value = true;
    }
  }

  function handleDoneDrawingClick() {
    if (!drawRef.current) return;
    const closedRing = handleDoneDrawing(drawRef.current);
    isDrawingActive.value = false;
    hasFinishedPolygon.value = true;
    if (closedRing && closedRing.length >= 3) {
      const pitch = formData.value.pitch || 'medium';
      drawingSqft.value = computeFootprintSqft(closedRing, pitch);
    }
  }

  function handleUseArea() {
    updateField('sqft', String(drawingSqft.value));
    destroyDraw();
    drawRef.current = null;
    mapMode.value = false;
    isDrawingActive.value = false;
    hasFinishedPolygon.value = false;
    drawingSqft.value = 0;
    selectedPlace.value = null;
  }

  function handleClear() {
    if (!drawRef.current) return;
    handleClearPolygon(drawRef.current);
    drawingSqft.value = 0;
    hasFinishedPolygon.value = false;
    isDrawingActive.value = true;
  }

  if (mapLoading.value) {
    return <div class="rc-map-loading">Loading map...</div>;
  }

  const pitchLabel = PITCH_LABELS[formData.value.pitch] || formData.value.pitch || 'medium';

  return (
    <div>
      <AddressAutocomplete onPlaceSelected={handlePlaceSelected} />
      {selectedPlace.value && (
        <div>
          <div class="rc-selected-address">{selectedPlace.value.formattedAddress}</div>
          <MapView
            lat={selectedPlace.value.lat}
            lng={selectedPlace.value.lng}
            onMapReady={handleMapReady}
          />
          <DrawingControls
            pitchLabel={pitchLabel}
            onStartDrawing={activateDrawing}
            onDoneDrawing={handleDoneDrawingClick}
            onUseArea={handleUseArea}
            onClear={handleClear}
          />
        </div>
      )}
    </div>
  );
}

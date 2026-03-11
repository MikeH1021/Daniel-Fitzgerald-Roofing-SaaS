import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { fetchMapsKey } from '../api/client';
import { loadMapsApi } from '../maps/loader';
import { apiKey, selectedPlace, mapLoading } from '../state/map';
import { AddressAutocomplete } from './AddressAutocomplete';
import { MapView } from './MapView';
import type { SelectedPlace } from '../maps/types';

export function MapStep() {
  useEffect(() => {
    async function activate() {
      mapLoading.value = true;
      try {
        const key = await fetchMapsKey();
        apiKey.value = key;
        await loadMapsApi(key);
      } finally {
        mapLoading.value = false;
      }
    }
    activate();
  }, []);

  function handlePlaceSelected(place: SelectedPlace) {
    selectedPlace.value = place;
  }

  if (mapLoading.value) {
    return <div class="rc-map-loading">Loading map...</div>;
  }

  return (
    <div>
      <AddressAutocomplete onPlaceSelected={handlePlaceSelected} />
      {selectedPlace.value && (
        <div>
          <div class="rc-selected-address">{selectedPlace.value.formattedAddress}</div>
          <MapView lat={selectedPlace.value.lat} lng={selectedPlace.value.lng} />
        </div>
      )}
    </div>
  );
}

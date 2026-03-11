import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { importMapsLibrary } from '../maps/loader';

interface Props {
  lat: number;
  lng: number;
}

export function MapView({ lat, lng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    async function initMap() {
      if (!mapRef.current) return;

      const { Map } = await importMapsLibrary('maps') as any;

      if (mapInstanceRef.current) {
        // Map already initialized — just re-center
        mapInstanceRef.current.setCenter({ lat, lng });
        return;
      }

      mapInstanceRef.current = new Map(mapRef.current, {
        center: { lat, lng },
        zoom: 20,                   // roof-level: buildings clearly rendered
        mapTypeId: 'hybrid',        // satellite imagery with street labels
        disableDefaultUI: true,
        gestureHandling: 'greedy', // single-finger pan on mobile
      });
    }

    initMap();
  }, [lat, lng]);

  return (
    <div
      ref={mapRef}
      class="rc-map-container"
      // Explicit height is critical — Maps API renders at 0px without it (RESEARCH.md Pitfall 3)
      style={{ width: '100%', height: '300px' }}
    />
  );
}

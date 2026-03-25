import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { importMapsLibrary } from '../maps/loader';

interface Props {
  lat: number;
  lng: number;
  onMapReady?: (map: any) => void;
}

export function MapView({ lat, lng, onMapReady }: Props) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    async function initMap() {
      if (!placeholderRef.current) return;

      // Create map div in document.body (outside Shadow DOM) so overlays render
      if (!mapDivRef.current) {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.zIndex = '10000';
        div.style.borderRadius = '8px';
        div.style.overflow = 'hidden';
        document.body.appendChild(div);
        mapDivRef.current = div;
      }

      // Position map div over placeholder
      syncPosition();

      const { Map } = await importMapsLibrary('maps') as any;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat, lng });
        return;
      }

      mapInstanceRef.current = new Map(mapDivRef.current, {
        center: { lat, lng },
        zoom: 20,
        mapTypeId: 'hybrid',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
      });

      if (onMapReady) {
        onMapReady(mapInstanceRef.current);
      }
    }

    function syncPosition() {
      if (!placeholderRef.current || !mapDivRef.current) return;
      const rect = placeholderRef.current.getBoundingClientRect();
      const s = mapDivRef.current.style;
      s.top = (rect.top + window.scrollY) + 'px';
      s.left = (rect.left + window.scrollX) + 'px';
      s.width = rect.width + 'px';
      s.height = rect.height + 'px';
      rafRef.current = requestAnimationFrame(syncPosition);
    }

    initMap();

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (mapDivRef.current) {
        mapDivRef.current.remove();
        mapDivRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, [lat, lng]);

  return (
    <div
      ref={placeholderRef}
      class="rc-map-container"
      style={{ width: '100%', height: '300px' }}
    />
  );
}

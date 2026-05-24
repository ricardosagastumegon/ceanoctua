import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { AttViaje } from './viajes/api';

// Fix Vite + Leaflet default marker icon paths (gotcha known)
const DefaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type Props = {
  viajes: AttViaje[];
  onMarkerClick?: (viaje: AttViaje) => void;
};

export function ArriazaMap({ viajes, onMarkerClick }: Props) {
  const withCoords = viajes.filter((v) => v.lat != null && v.lng != null);

  // Default view: Guatemala City if no markers
  const defaultCenter: [number, number] = [14.6349, -90.5069];
  const center: [number, number] = withCoords.length > 0
    ? [Number(withCoords[0].lat), Number(withCoords[0].lng)]
    : defaultCenter;
  const zoom = withCoords.length > 0 ? 3 : 6;

  // Force resize on mount so the map renders correctly inside flex layouts
  useEffect(() => {
    setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
  }, []);

  return (
    <div className="h-72 w-full overflow-hidden rounded-card border border-sand shadow-sm">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((v) => (
          <Marker
            key={v.id}
            position={[Number(v.lat), Number(v.lng)]}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(v) } : undefined}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{v.titulo}</div>
                {v.destino && <div className="text-xs text-gray-600">{v.destino}</div>}
                {onMarkerClick && (
                  <button
                    type="button"
                    onClick={() => onMarkerClick(v)}
                    className="mt-2 text-xs text-teal-700 underline"
                  >
                    Abrir viaje →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {withCoords.length === 0 && (
        <p className="-mt-8 ml-3 text-xs text-dark-3">
          (No hay viajes con coordenadas todavía. Agrega lat/lng al editar un viaje para verlo aquí.)
        </p>
      )}
    </div>
  );
}

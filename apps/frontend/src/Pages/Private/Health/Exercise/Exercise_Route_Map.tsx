import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../../../Contexts/ThemeContext';
import { EXERCISE_COLORS } from './exerciseFormat';

interface Exercise_Route_Map_Props {
  route: [number, number][][];
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

const Exercise_Route_Map = ({ route }: Exercise_Route_Map_Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { mode } = useTheme();
  const light = mode === 'light' || (mode !== 'dark' && document.body.classList.contains('Light_Mode'));

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

    const line = L.polyline(route, { color: EXERCISE_COLORS.route, weight: 4, opacity: 0.9 }).addTo(map);
    const first = route[0][0];
    const lastSegment = route[route.length - 1];
    const last = lastSegment[lastSegment.length - 1];
    L.circleMarker(first, { radius: 6, color: '#ffffff', weight: 2, fillColor: EXERCISE_COLORS.start, fillOpacity: 1 }).addTo(map);
    L.circleMarker(last, { radius: 6, color: '#ffffff', weight: 2, fillColor: EXERCISE_COLORS.end, fillOpacity: 1 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24] });

    return () => {
      map.remove();
    };
  }, [route]);

  return <div ref={containerRef} className={`Exercise_Route_Map ${light ? '' : 'dark'}`} />;
};

export default Exercise_Route_Map;

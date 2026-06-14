// src/components/Map/ReportsMap.jsx
import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { db } from '../../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import '../../utils/leafletFix';

const mapContainerStyle = { width: '100%', height: '500px' };

// Taroudant city boundary (approximate)
const taroudantBoundary = [
  [30.468, -8.900],
  [30.482, -8.895],
  [30.494, -8.882],
  [30.493, -8.866],
  [30.486, -8.852],
  [30.474, -8.845],
  [30.461, -8.848],
  [30.452, -8.862],
  [30.450, -8.878],
  [30.459, -8.895],
  [30.468, -8.900],
];

// Compute centroid (average of all boundary points)
const centroid = taroudantBoundary.reduce(
  (acc, [lat, lng]) => [acc[0] + lat, acc[1] + lng],
  [0, 0]
).map(v => v / taroudantBoundary.length);

// Helper: get bearing in degrees from centroid to a point (0° = North)
function getBearing(centroid, point) {
  const dy = point[0] - centroid[0];
  const dx = point[1] - centroid[1];
  let bearing = Math.atan2(dx, dy) * 180 / Math.PI;
  if (bearing < 0) bearing += 360;
  return bearing;
}

// Helper: line intersection (p1-p2 and p3-p4) returns point or null
function lineIntersection(p1, p2, p3, p4) {
  const [x1, y1] = [p1[1], p1[0]];
  const [x2, y2] = [p2[1], p2[0]];
  const [x3, y3] = [p3[1], p3[0]];
  const [x4, y4] = [p4[1], p4[0]];
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    const ix = x1 + t * (x2 - x1);
    const iy = y1 + t * (y2 - y1);
    return [iy, ix];
  }
  return null;
}

// Get intersection of a ray from centroid at given bearing (degrees) with boundary polygon
function getRayIntersection(centroid, bearingDeg, boundary) {
  const rad = bearingDeg * Math.PI / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const farPoint = [centroid[0] + dy * 10, centroid[1] + dx * 10];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    const intersection = lineIntersection(centroid, farPoint, a, b);
    if (intersection) return intersection;
  }
  return null;
}

// Generate X-shaped quadrants (cardinal regions bounded by diagonal rays)
function generateXQuadrants(boundary, center) {
  // Diagonal rays at 45°, 135°, 225°, 315°
  const rayBearings = [45, 135, 225, 315];
  const intersections = rayBearings.map(b => getRayIntersection(center, b, boundary));
  
  const sectors = [];
  const sectorNames = ['East', 'South', 'West', 'North'];
  const sectorColors = ['#facc1533', '#22c55e33', '#3b82f633','#a855f733']; // purple, yellow, green, blue

  for (let i = 0; i < rayBearings.length; i++) {
    const startAngle = rayBearings[i];
    const endAngle = rayBearings[(i + 1) % rayBearings.length];
    const startIntersect = intersections[i];
    const endIntersect = intersections[(i + 1) % intersections.length];
    
    // Collect boundary points whose bearing is between startAngle and endAngle
    const pointsInSector = [];
    for (const point of boundary) {
      let bearing = getBearing(center, point);
      if (startAngle < endAngle) {
        if (bearing >= startAngle && bearing <= endAngle) {
          pointsInSector.push(point);
        }
      } else {
        // Wrap case (e.g., 315° to 45°)
        if (bearing >= startAngle || bearing <= endAngle) {
          pointsInSector.push(point);
        }
      }
    }
    
    // Sort points in correct angular order
    if (startAngle < endAngle) {
      // Normal sector: sort ascending by bearing
      pointsInSector.sort((a, b) => getBearing(center, a) - getBearing(center, b));
    } else {
      // Wrap sector: points with bearing ≥ startAngle go first (ascending), then points ≤ endAngle (ascending)
      const high = [];
      const low = [];
      for (const p of pointsInSector) {
        const b = getBearing(center, p);
        if (b >= startAngle) high.push(p);
        else low.push(p);
      }
      high.sort((a, b) => getBearing(center, a) - getBearing(center, b));
      low.sort((a, b) => getBearing(center, a) - getBearing(center, b));
      pointsInSector.length = 0;
      pointsInSector.push(...high, ...low);
    }
    
    // Build polygon: center → startIntersect → boundary points (in order) → endIntersect → center
    const polygon = [center, startIntersect, ...pointsInSector, endIntersect, center];
    
    sectors.push({
      name: sectorNames[i],
      positions: polygon,
      color: sectorColors[i],
    });
  }
  return sectors;
}

// World overlay with a hole for Taroudant (red outside)
const worldOuter = [
  [-85, -180],
  [85, -180],
  [85, 180],
  [-85, 180],
  [-85, -180],
];
const taroudantHole = [...taroudantBoundary].reverse();
const worldWithHole = [worldOuter, taroudantHole];

// Helper: custom marker icon (unchanged)
function getCustomIcon(type, status) {
  const isResolved = status === 'Résolu';
  const typeConfig = {
    'Illegal dumping': { bg: '#dc2626', icon: 'fa-trash-alt' },
    'Full container': { bg: '#f97316', icon: 'fa-dumpster' },
    'Bulky items': { bg: '#8b5cf6', icon: 'fa-couch' },
    'Graffiti / tag': { bg: '#ec489a', icon: 'fa-paint-brush' },
    'Dépôt sauvage': { bg: '#dc2626', icon: 'fa-trash-alt' },
    'Conteneur plein': { bg: '#f97316', icon: 'fa-dumpster' },
    'Encombrants': { bg: '#8b5cf6', icon: 'fa-couch' },
    'إلقاء نفايات عشوائي': { bg: '#dc2626', icon: 'fa-trash-alt' },
    'حاوية ممتلئة': { bg: '#f97316', icon: 'fa-dumpster' },
    'أشياء ضخمة': { bg: '#8b5cf6', icon: 'fa-couch' },
    'كتابات على الجدران': { bg: '#ec489a', icon: 'fa-paint-brush' },
    default: { bg: '#6b7280', icon: 'fa-exclamation-triangle' }
  };
  const config = typeConfig[type] || typeConfig.default;
  const backgroundColor = isResolved ? '#10b981' : config.bg;
  const iconClass = isResolved ? 'fa-check-circle' : config.icon;
  return L.divIcon({
    html: `
      <div style="
        background-color: ${backgroundColor};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border: 2px solid white;
        font-size: 18px;
        color: white;
        font-weight: bold;
      ">
        <i class="fas ${iconClass}" style="font-size: 18px;"></i>
      </div>
    `,
    iconSize: [36, 36],
    popupAnchor: [0, -18],
    className: 'custom-marker-icon'
  });
}

export default function ReportsMap({ filter = 'all', userRole = null, currentUserId = null }) {
  const { t } = useTranslation();
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const quadrants = useMemo(() => generateXQuadrants(taroudantBoundary, centroid), []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'reports'),
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllReports(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching reports:', error);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filteredReports = allReports.filter(report => {
    if (filter === 'active') {
      if (report.status === 'Résolu') return false;
    } else if (filter === 'resolved') {
      if (report.status !== 'Résolu') return false;
    } else if (filter === 'my') {
      if (userRole === 'citizen' && report.createdBy !== currentUserId) return false;
      if (userRole === 'agent' && report.assignedTo !== currentUserId) return false;
    }
    return true;
  });

  const markers = filteredReports
    .filter(r => r.location && r.location.latitude && r.location.longitude)
    .map(report => ({
      id: report.id,
      lat: report.location.latitude,
      lng: report.location.longitude,
      type: report.type,
      status: report.status,
      address: report.address,
      description: report.description,
    }));

  if (loading) {
    return (
      <div className="map-loading" style={{ background: '#f0f4f8', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
        <i className="fas fa-spinner fa-spin"></i> {t('loading')}
      </div>
    );
  }

  return (
    <MapContainer 
      center={[30.4727, -8.8746]} 
      zoom={13.5} 
      style={mapContainerStyle} 
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Red overlay for everything outside Taroudant */}
      <Polygon 
        positions={worldWithHole} 
        pathOptions={{
          color: 'red',
          weight: 0,
          fillColor: '#ff00000e',
          fillOpacity: 1,
          interactive: false
        }}
      />

      {/* X-shaped colored quadrants inside Taroudant (no gaps, correct ordering) */}
      {quadrants.map(quad => (
        <Polygon
          key={quad.name}
          positions={quad.positions}
          pathOptions={{
            color: quad.color,
            weight: 0.15,
            fillColor: quad.color,
            fillOpacity: 1,
            interactive: false
          }}
        />
      ))}

      {/* Taroudant boundary outline */}
      <Polygon 
        positions={taroudantBoundary} 
        pathOptions={{
          color: '#e0080873',
          weight: 3,
          fillColor: 'transparent',
          fillOpacity: 0,
          dashArray: '8, 6'
        }}
      />

      {markers.map(marker => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={getCustomIcon(marker.type, marker.status)}
        >
          <Popup>
            <div>
              <strong>{marker.type}</strong><br />
              {marker.address}<br />
              {t('status')}: {marker.status === 'Résolu' ? t('resolved') : t('active')}
              {marker.description && <><br /><small>{marker.description.substring(0, 80)}</small></>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
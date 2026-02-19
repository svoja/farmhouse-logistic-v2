import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchMapBranches, fetchMapByCar } from '../api';

// Fix default icon in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const BANGKOK = [13.7563, 100.5018];
const BLUE = '#2563eb';
const GREEN = '#16a34a';
const AMBER = '#d97706';

function FitBounds({ branches, cars }) {
  const map = useMap();
  useEffect(() => {
    const points = [];
    (branches || []).forEach((b) => {
      if (b.latitude != null && b.longitude != null) points.push([b.latitude, b.longitude]);
    });
    (cars || []).forEach((car) => {
      (car.orders || []).forEach((o) => {
        if (o.branch_latitude != null && o.branch_longitude != null) points.push([o.branch_latitude, o.branch_longitude]);
      });
    });
    if (points.length === 0) return;
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  }, [map, branches, cars]);
  return null;
}

export default function MapPage() {
  const [branches, setBranches] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchMapBranches(), fetchMapByCar()])
      .then(([b, c]) => {
        setBranches(b || []);
        setCars(c || []);
      })
      .catch((e) => setError(e?.message || 'Failed to load map data'))
      .finally(() => setLoading(false));
  }, []);

  const getBranchColor = (catId) => {
    if (catId === 1) return BLUE;
    if (catId === 2) return AMBER;
    return GREEN;
  };

  if (loading) return <div style={{ padding: 24 }}>Loading map…</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>{error}</div>;

  return (
    <div style={{ height: 'calc(100vh - 52px)', width: '100%' }}>
      <MapContainer center={BANGKOK} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds branches={branches} cars={cars} />
        {branches.map((b) => (
          <Marker key={`b-${b.branch_id}`} position={[b.latitude, b.longitude]}>
            <Popup>
              <strong>{b.name}</strong>
              <br />
              cat_id: {b.cat_id} (1=Factory, 2=DC, 3=Retailer)
            </Popup>
          </Marker>
        ))}
        {cars.map((car) => {
          const positions = (car.orders || [])
            .map((o) => (o.branch_latitude != null && o.branch_longitude != null ? [o.branch_latitude, o.branch_longitude] : null))
            .filter(Boolean);
          const color = car.cars_type_name && String(car.cars_type_name).toLowerCase().includes('10') ? BLUE : AMBER;
          return (
            <Polyline
              key={`car-${car.car_id}`}
              positions={positions}
              pathOptions={{ color, weight: 4, opacity: 0.8 }}
            />
          );
        })}
        {cars.map((car) =>
          (car.orders || []).slice(0, 1).map((o) => {
            if (o.branch_latitude == null || o.branch_longitude == null) return null;
            return (
              <Marker key={`car-m-${car.car_id}-${o.branch_id}`} position={[o.branch_latitude, o.branch_longitude]}>
                <Popup>
                  <strong>{car.license_plate}</strong> ({car.cars_type_name})
                  <br />
                  Driver: {o.driver_name}
                  <br />
                  Status: {car.status}
                  <br />
                  Stops: {(car.orders || []).length}
                </Popup>
              </Marker>
            );
          })
        )}
      </MapContainer>
    </div>
  );
}

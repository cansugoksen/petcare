const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function getCurrentLocationSafe() {
  let LocationModule;
  try {
    LocationModule = await import('expo-location');
  } catch {
    return {
      ok: false,
      reason: 'module_missing',
      message: 'expo-location paketi henüz kurulu değil.',
    };
  }

  const Location = LocationModule?.default || LocationModule;
  if (!Location?.requestForegroundPermissionsAsync || !Location?.getCurrentPositionAsync) {
    return {
      ok: false,
      reason: 'api_missing',
      message: 'Konum API erişimi kullanılamıyor.',
    };
  }

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { ok: false, reason: 'permission_denied', message: 'Konum izni verilmedi.' };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced,
      mayShowUserSettingsDialog: true,
    });

    const coords = position?.coords || {};
    if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
      return { ok: false, reason: 'invalid_coords', message: 'Geçerli konum alınamadı.' };
    }

    return {
      ok: true,
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'runtime_error',
      message: err?.message || 'Konum alınırken hata oluştu.',
    };
  }
}

export async function searchNearbyVetsOverpass({ latitude, longitude, radiusKm = 10, limit = 20 }) {
  const query = buildVetOverpassQuery({ latitude, longitude, radiusKm });
  const elements = await runOverpassQuery(query);
  return elements
    .map((el) => mapOverpassPlace(el, { latitude, longitude, category: 'vet' }))
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(1, limit));
}

export async function searchNearbyParksOverpass({ latitude, longitude, radiusKm = 10, limit = 20 }) {
  const query = buildParkOverpassQuery({ latitude, longitude, radiusKm });
  const elements = await runOverpassQuery(query);
  return elements
    .map((el) => mapOverpassPlace(el, { latitude, longitude, category: 'park' }))
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(1, limit));
}

export function formatCoordsShort(coords) {
  if (!coords) return 'Konum seçilmedi';
  const { latitude, longitude } = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 'Konum seçilmedi';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

async function runOverpassQuery(queryText) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: queryText,
  });

  if (!res.ok) {
    throw new Error(`Overpass isteği başarısız (${res.status})`);
  }

  const data = await res.json();
  return Array.isArray(data?.elements) ? data.elements : [];
}

function buildVetOverpassQuery({ latitude, longitude, radiusKm }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Geçerli konum koordinatları gerekli.');
  }
  const radiusMeters = Math.max(1000, Math.round(Number(radiusKm || 10) * 1000));
  return `
[out:json][timeout:20];
(
  node["amenity"="veterinary"](around:${radiusMeters},${latitude},${longitude});
  way["amenity"="veterinary"](around:${radiusMeters},${latitude},${longitude});
  relation["amenity"="veterinary"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;
`;
}

function buildParkOverpassQuery({ latitude, longitude, radiusKm }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Geçerli konum koordinatları gerekli.');
  }
  const radiusMeters = Math.max(1000, Math.round(Number(radiusKm || 10) * 1000));
  return `
[out:json][timeout:20];
(
  node["leisure"="dog_park"](around:${radiusMeters},${latitude},${longitude});
  way["leisure"="dog_park"](around:${radiusMeters},${latitude},${longitude});
  relation["leisure"="dog_park"](around:${radiusMeters},${latitude},${longitude});
  node["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
  way["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
  relation["leisure"="park"](around:${radiusMeters},${latitude},${longitude});
);
out center tags;
`;
}

function mapOverpassPlace(el, { latitude, longitude, category }) {
  const lat = Number(el?.lat ?? el?.center?.lat);
  const lon = Number(el?.lon ?? el?.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const tags = el?.tags || {};
  const opening = tags.opening_hours || null;
  const distanceKm = haversineKm(latitude, longitude, lat, lon);

  const isDogPark = tags.leisure === 'dog_park';
  const inferredName =
    category === 'park'
      ? isDogPark
        ? 'Köpek Parkı'
        : 'Park'
      : 'Veteriner';

  return {
    id: `${el.type || 'x'}_${el.id}`,
    category,
    subtype: isDogPark ? 'dog_park' : null,
    name: tags.name || inferredName,
    distanceKm,
    address: formatOsmAddress(tags),
    phone: category === 'vet' ? tags.phone || tags['contact:phone'] || null : null,
    openStatus: opening ? 'unknown' : category === 'park' ? 'open' : 'unknown',
    nightOpen: category === 'vet' ? inferNightOpen(opening) : false,
    openingHours: opening,
    source: 'osm',
    lat,
    lon,
  };
}

function formatOsmAddress(tags) {
  const parts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:suburb'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
  ].filter(Boolean);

  if (parts.length) return parts.join(', ');
  return tags.address || tags['addr:full'] || 'Adres bilgisi bulunamadı';
}

function inferNightOpen(openingHours) {
  if (!openingHours || typeof openingHours !== 'string') return false;
  const text = openingHours.toLowerCase();
  if (text.includes('24/7')) return true;
  if (text.includes('00:') || text.includes('23:') || text.includes('24:00')) return true;
  return false;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}


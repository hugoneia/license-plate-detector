/**
 * Tipo para zonas de exclusión
 * Define áreas geográficas donde se filtran visualmente las detecciones
 */
export interface ExclusionZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  enabled: boolean;
  createdAt: number;
}

/**
 * Configuración global de exclusión de zonas
 */
export interface ExclusionZonesConfig {
  masterEnabled: boolean;
  zones: ExclusionZone[];
}

/**
 * Calcula la distancia en metros entre dos puntos usando la fórmula de Haversine
 * @param lat1 Latitud del primer punto
 * @param lon1 Longitud del primer punto
 * @param lat2 Latitud del segundo punto
 * @param lon2 Longitud del segundo punto
 * @returns Distancia en metros
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Comprueba si una coordenada está dentro de una zona de exclusión
 * @param latitude Latitud de la detección
 * @param longitude Longitud de la detección
 * @param zone Zona de exclusión
 * @returns true si está dentro de la zona, false si está fuera
 */
export function isWithinExclusionZone(
  latitude: number,
  longitude: number,
  zone: ExclusionZone
): boolean {
  if (!zone.enabled) return false;
  
  const distance = calculateHaversineDistance(
    latitude,
    longitude,
    zone.latitude,
    zone.longitude
  );
  
  return distance <= zone.radiusMeters;
}

/**
 * Comprueba si una coordenada está dentro de CUALQUIER zona de exclusión activa
 * @param latitude Latitud de la detección
 * @param longitude Longitud de la detección
 * @param zones Array de zonas de exclusión
 * @returns true si está dentro de al menos una zona, false si está fuera de todas
 */
export function isInAnyExclusionZone(
  latitude: number,
  longitude: number,
  zones: ExclusionZone[]
): boolean {
  return zones.some((zone) => isWithinExclusionZone(latitude, longitude, zone));
}

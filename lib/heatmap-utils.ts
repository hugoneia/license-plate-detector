/**
 * Utilidades para procesamiento de datos de heatmap
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1, donde 1 es máxima densidad
}

export interface ClusteredLocation {
  center: GeoLocation;
  count: number;
  detections: GeoLocation[];
}

/**
 * Calcula la distancia en metros entre dos coordenadas usando la fórmula de Haversine
 */
export function calculateDistance(
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
 * Agrupa coordenadas por proximidad (100m de radio)
 * Retorna clusters de detecciones cercanas
 */
export function clusterLocationsByDistance(
  locations: GeoLocation[],
  radiusMeters: number = 100
): ClusteredLocation[] {
  if (locations.length === 0) return [];

  const clusters: ClusteredLocation[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < locations.length; i++) {
    if (visited.has(i)) continue;

    const cluster: GeoLocation[] = [locations[i]];
    visited.add(i);

    // Buscar todas las coordenadas dentro del radio
    for (let j = i + 1; j < locations.length; j++) {
      if (visited.has(j)) continue;

      const distance = calculateDistance(
        locations[i].latitude,
        locations[i].longitude,
        locations[j].latitude,
        locations[j].longitude
      );

      if (distance <= radiusMeters) {
        cluster.push(locations[j]);
        visited.add(j);
      }
    }

    // Calcular centro del cluster
    const avgLat = cluster.reduce((sum, loc) => sum + loc.latitude, 0) / cluster.length;
    const avgLon = cluster.reduce((sum, loc) => sum + loc.longitude, 0) / cluster.length;

    clusters.push({
      center: { latitude: avgLat, longitude: avgLon },
      count: cluster.length,
      detections: cluster,
    });
  }

  return clusters;
}

/**
 * Convierte clusters a puntos de heatmap con intensidad basada en densidad
 */
export function clustersToHeatmapPoints(clusters: ClusteredLocation[]): HeatmapPoint[] {
  if (clusters.length === 0) return [];

  // Encontrar el máximo de detecciones para normalizar
  const maxCount = Math.max(...clusters.map((c) => c.count));

  return clusters.map((cluster) => ({
    lat: cluster.center.latitude,
    lng: cluster.center.longitude,
    intensity: cluster.count / maxCount, // Normalizar a 0-1
  }));
}

/**
 * Obtiene el color del heatmap basado en la intensidad
 * Verde (baja) → Amarillo (media) → Naranja (media-alta) → Rojo (alta)
 */
export function getHeatmapColor(intensity: number): string {
  // intensity: 0 = verde, 0.33 = amarillo, 0.66 = naranja, 1 = rojo
  if (intensity < 0.33) {
    // Verde a Amarillo
    const t = intensity / 0.33;
    const r = Math.round(255 * t);
    const g = 255;
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity < 0.66) {
    // Amarillo a Naranja
    const t = (intensity - 0.33) / 0.33;
    const r = 255;
    const g = Math.round(255 * (1 - t * 0.5));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Naranja a Rojo
    const t = (intensity - 0.66) / 0.34;
    const r = 255;
    const g = Math.round(140 * (1 - t));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Obtiene estadísticas del heatmap
 */
export function getHeatmapStats(clusters: ClusteredLocation[]) {
  if (clusters.length === 0) {
    return {
      totalDetections: 0,
      totalClusters: 0,
      avgDetectionsPerCluster: 0,
      maxDetectionsInCluster: 0,
    };
  }

  const totalDetections = clusters.reduce((sum, c) => sum + c.count, 0);
  const maxDetections = Math.max(...clusters.map((c) => c.count));

  return {
    totalDetections,
    totalClusters: clusters.length,
    avgDetectionsPerCluster: Math.round(totalDetections / clusters.length),
    maxDetectionsInCluster: maxDetections,
  };
}

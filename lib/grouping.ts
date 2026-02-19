import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";

/**
 * Agrupa matrículas únicas y cuenta sus repeticiones
 */
export function groupLicensePlates(entries: LicensePlateEntry[]): GroupedLicensePlate[] {
  const groupMap = new Map<string, LicensePlateEntry[]>();

  // Agrupar por matrícula
  entries.forEach((entry) => {
    const plate = entry.licensePlate.toUpperCase();
    if (!groupMap.has(plate)) {
      groupMap.set(plate, []);
    }
    groupMap.get(plate)!.push(entry);
  });

  // Convertir a array de grupos ordenados por última detección
  return Array.from(groupMap.entries())
    .map(([licensePlate, plateEntries]) => {
      const sortedEntries = plateEntries.sort((a, b) => b.timestamp - a.timestamp);
      return {
        licensePlate,
        count: plateEntries.length,
        firstSeen: Math.min(...plateEntries.map((e) => e.timestamp)),
        lastSeen: Math.max(...plateEntries.map((e) => e.timestamp)),
        entries: sortedEntries,
      };
    })
    .sort((a, b) => b.lastSeen - a.lastSeen); // Ordenar por última detección (más reciente primero)
}

/**
 * Obtiene estadísticas de matrículas únicas
 */
export function getUniquePlateStats(entries: LicensePlateEntry[]) {
  const grouped = groupLicensePlates(entries);
  const totalUnique = grouped.length;
  const totalDetections = entries.length;
  const averageDetectionsPerPlate = totalUnique > 0 ? totalDetections / totalUnique : 0;
  const mostDetectedPlate = grouped.length > 0 ? grouped[0] : null;

  return {
    totalUnique,
    totalDetections,
    averageDetectionsPerPlate: Math.round(averageDetectionsPerPlate * 100) / 100,
    mostDetectedPlate,
  };
}

/**
 * Formatea una entrada agrupada para mostrar en el historial
 */
export function formatGroupedPlateForDisplay(group: GroupedLicensePlate): string {
  const lastDate = new Date(group.lastSeen);
  const dateStr = lastDate.toLocaleDateString("es-ES");
  const timeStr = lastDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  if (group.count === 1) {
    return `${group.licensePlate} • ${dateStr} ${timeStr}`;
  }

  return `${group.licensePlate} (${group.count}x) • Última: ${dateStr} ${timeStr}`;
}

/**
 * Genera línea para archivo de texto con formato agrupado
 */
export function formatGroupedPlateForFile(group: GroupedLicensePlate): string {
  const firstDate = new Date(group.firstSeen).toLocaleString("es-ES");
  const lastDate = new Date(group.lastSeen).toLocaleString("es-ES");

  if (group.count === 1) {
    const location =
      group.entries[0].location === "NO GPS"
        ? "NO GPS"
        : group.entries[0].location
        ? `${group.entries[0].location.latitude.toFixed(4)}, ${group.entries[0].location.longitude.toFixed(4)}`
        : "NO GPS";
    return `${group.licensePlate} | ${firstDate} | ${location}\n`;
  }

  let lines = `${group.licensePlate} (${group.count} detecciones)\n`;
  group.entries.forEach((entry, index) => {
    const date = new Date(entry.timestamp).toLocaleString("es-ES");
    const location =
      entry.location === "NO GPS"
        ? "NO GPS"
        : entry.location
        ? `${entry.location.latitude.toFixed(4)}, ${entry.location.longitude.toFixed(4)}`
        : "NO GPS";
    lines += `  ${index + 1}. ${date} | ${location}\n`;
  });

  return lines + "\n";
}

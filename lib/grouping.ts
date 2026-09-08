import type { LicensePlateEntry, GroupedLicensePlate } from "@/types/license-plate";

/**
 * Agrupa matrículas únicas y cuenta sus repeticiones.
 * Cuando `entriesAreSortedByTimestampDesc` es true, conserva el orden de
 * entrada dentro de cada grupo y evita ordenar cada grupo por separado.
 */
export function groupLicensePlates(
  entries: LicensePlateEntry[],
  entriesAreSortedByTimestampDesc = false,
): GroupedLicensePlate[] {
  const groupMap = new Map<string, LicensePlateEntry[]>();

  for (const entry of entries) {
    const plate = entry.licensePlate.toUpperCase();
    const group = groupMap.get(plate);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(plate, [entry]);
    }
  }

  return Array.from(groupMap.entries())
    .map(([licensePlate, plateEntries]) => {
      const sortedEntries = entriesAreSortedByTimestampDesc
        ? plateEntries
        : [...plateEntries].sort((a, b) => b.timestamp - a.timestamp);

      let firstSeen = Infinity;
      let lastSeen = -Infinity;
      let mostRecentEntry: LicensePlateEntry | undefined;

      for (const entry of sortedEntries) {
        if (entry.timestamp < firstSeen) firstSeen = entry.timestamp;
        if (entry.timestamp > lastSeen) {
          lastSeen = entry.timestamp;
          mostRecentEntry = entry;
        }
      }

      return {
        licensePlate,
        count: sortedEntries.length,
        firstSeen: firstSeen === Infinity ? 0 : firstSeen,
        lastSeen: lastSeen === -Infinity ? 0 : lastSeen,
        entries: sortedEntries,
        parkingLocation: mostRecentEntry?.parkingLocation || null,
      };
    })
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Obtiene el TOP 5 de matrículas ordenadas por cantidad de detecciones. */
export function getTopPlatesByDetections(entries: LicensePlateEntry[], limit: number = 5): GroupedLicensePlate[] {
  return groupLicensePlates(entries).sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Obtiene estadísticas de matrículas únicas. */
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

/** Formatea una entrada agrupada para mostrar en el historial. */
export function formatGroupedPlateForDisplay(group: GroupedLicensePlate): string {
  const lastDate = new Date(group.lastSeen);
  const dateStr = lastDate.toLocaleDateString("es-ES");
  const timeStr = lastDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  if (group.count === 1) {
    return `${group.licensePlate} • ${dateStr} ${timeStr}`;
  }

  return `${group.licensePlate} (${group.count}x) • Última: ${dateStr} ${timeStr}`;
}

/** Genera una línea para archivo de texto con formato agrupado. */
export function formatGroupedPlateForFile(group: GroupedLicensePlate): string {
  const firstDate = new Date(group.firstSeen).toLocaleString("es-ES");

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

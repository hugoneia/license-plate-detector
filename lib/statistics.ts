import type { LicensePlateEntry } from "@/types/license-plate";

export interface DailyStats {
  date: string; // YYYY-MM-DD
  count: number;
  timestamp: number;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  count: number;
  year: number;
}

export interface OverallStats {
  total: number;
  today: number;
  thisMonth: number;
  thisYear: number;
  dailyStats: DailyStats[];
  monthlyStats: MonthlyStats[];
}

export function calculateStatistics(entries: LicensePlateEntry[]): OverallStats {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisYear = new Date(now.getFullYear(), 0, 1);

  // Inicializar contadores
  let todayCount = 0;
  let thisMonthCount = 0;
  let thisYearCount = 0;

  // Mapas para estadísticas diarias y mensuales
  const dailyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();

  // Procesar cada entrada
  entries.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    const entryYear = entryDate.getFullYear();
    const entryMonth = entryDate.getMonth();
    const entryDay = entryDate.getDate();

    // Contar por año
    if (entryYear === now.getFullYear()) {
      thisYearCount++;
    }

    // Contar por mes
    if (entryYear === now.getFullYear() && entryMonth === now.getMonth()) {
      thisMonthCount++;
    }

    // Contar por día
    if (
      entryYear === now.getFullYear() &&
      entryMonth === now.getMonth() &&
      entryDay === now.getDate()
    ) {
      todayCount++;
    }

    // Agregar a estadísticas diarias
    const dateStr = entryDate.toISOString().split("T")[0]; // YYYY-MM-DD
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);

    // Agregar a estadísticas mensuales
    const monthStr = dateStr.substring(0, 7); // YYYY-MM
    monthlyMap.set(monthStr, (monthlyMap.get(monthStr) || 0) + 1);
  });

  // Convertir mapas a arrays ordenados
  const dailyStats: DailyStats[] = Array.from(dailyMap.entries())
    .map(([date, count]) => ({
      date,
      count,
      timestamp: new Date(date).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const monthlyStats: MonthlyStats[] = Array.from(monthlyMap.entries())
    .map(([month, count]) => ({
      month,
      count,
      year: parseInt(month.split("-")[0]),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total: entries.length,
    today: todayCount,
    thisMonth: thisMonthCount,
    thisYear: thisYearCount,
    dailyStats,
    monthlyStats,
  };
}

/**
 * Obtiene los últimos N días de estadísticas (incluye días sin datos)
 */
export function getLast30DaysStats(entries: LicensePlateEntry[]): DailyStats[] {
  const stats = calculateStatistics(entries);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Crear mapa de estadísticas existentes
  const statsMap = new Map(stats.dailyStats.map((s) => [s.date, s.count]));

  // Generar todos los días de los últimos 30 días
  const result: DailyStats[] = [];
  const current = new Date(thirtyDaysAgo);

  while (current <= now) {
    const dateStr = current.toISOString().split("T")[0];
    const count = statsMap.get(dateStr) || 0;

    result.push({
      date: dateStr,
      count,
      timestamp: current.getTime(),
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Obtiene estadísticas de los últimos 12 meses
 */
export function getLast12MonthsStats(entries: LicensePlateEntry[]): MonthlyStats[] {
  const stats = calculateStatistics(entries);
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

  // Crear mapa de estadísticas existentes
  const statsMap = new Map(stats.monthlyStats.map((s) => [s.month, s.count]));

  // Generar todos los meses de los últimos 12 meses
  const result: MonthlyStats[] = [];
  const current = new Date(twelveMonthsAgo);

  while (current <= now) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const monthStr = `${year}-${month}`;
    const count = statsMap.get(monthStr) || 0;

    result.push({
      month: monthStr,
      count,
      year,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return result;
}

/**
 * Formatea una fecha para mostrar en la UI
 */
export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formatea un mes para mostrar en la UI
 */
export function formatMonthForDisplay(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("es-ES", {
    month: "short",
    year: "numeric",
  });
}

import { View, Text, ScrollView, FlatList } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenContainer } from "@/components/screen-container";
import { BarChart } from "@/components/chart-bar";
import type { LicensePlateEntry } from "@/types/license-plate";
import {
  calculateStatistics,
  getLast30DaysStats,
  getLast12MonthsStats,
  formatDateForDisplay,
  formatMonthForDisplay,
} from "@/lib/statistics";

const STORAGE_KEY = "license_plates";

export default function StatsScreen() {
  const [stats, setStats] = useState<ReturnType<typeof calculateStatistics> | null>(null);
  const [last30Days, setLast30Days] = useState<ReturnType<typeof getLast30DaysStats>>([]);
  const [last12Months, setLast12Months] = useState<ReturnType<typeof getLast12MonthsStats>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  async function loadStatistics() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const entries: LicensePlateEntry[] = JSON.parse(data);
        const calculatedStats = calculateStatistics(entries);
        setStats(calculatedStats);
        setLast30Days(getLast30DaysStats(entries));
        setLast12Months(getLast12MonthsStats(entries));
      } else {
        // Datos vacíos
        setStats({
          total: 0,
          today: 0,
          thisMonth: 0,
          thisYear: 0,
          dailyStats: [],
          monthlyStats: [],
        });
        setLast30Days([]);
        setLast12Months([]);
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !stats) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <Text className="text-muted">Cargando estadísticas...</Text>
      </ScreenContainer>
    );
  }

  // Preparar datos para gráfico de últimos 30 días (mostrar cada 3 días)
  const dailyChartData = last30Days
    .filter((_, index) => index % 3 === 0 || index === last30Days.length - 1)
    .map((d) => ({
      label: formatDateForDisplay(d.date).split(" ")[0], // Solo el día
      value: d.count,
    }));

  // Preparar datos para gráfico de últimos 12 meses
  const monthlyChartData = last12Months.map((m) => ({
    label: formatMonthForDisplay(m.month).split(" ")[0], // Solo el mes
    value: m.count,
  }));

  return (
    <ScreenContainer className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="gap-6 p-6">
          {/* Encabezado */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Estadísticas</Text>
            <Text className="text-base text-muted mt-1">Análisis de matrículas detectadas</Text>
          </View>

          {/* Tarjetas de resumen */}
          <View className="gap-3">
            {/* Total */}
            <View className="bg-primary rounded-2xl p-6">
              <Text className="text-sm text-white/80 mb-1">Total de Matrículas</Text>
              <Text className="text-4xl font-bold text-white">{stats.total}</Text>
            </View>

            {/* Fila de 3 tarjetas */}
            <View className="flex-row gap-3">
              {/* Hoy */}
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Hoy</Text>
                <Text className="text-2xl font-bold text-primary">{stats.today}</Text>
              </View>

              {/* Este Mes */}
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Este Mes</Text>
                <Text className="text-2xl font-bold text-primary">{stats.thisMonth}</Text>
              </View>

              {/* Este Año */}
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Este Año</Text>
                <Text className="text-2xl font-bold text-primary">{stats.thisYear}</Text>
              </View>
            </View>
          </View>

          {/* Gráfico de últimos 30 días */}
          {last30Days.length > 0 && (
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">Últimos 30 Días</Text>
              <BarChart data={dailyChartData} barColor="#0066CC" height={150} />
            </View>
          )}

          {/* Tabla de últimos 7 días */}
          {last30Days.length > 0 && (
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">Últimos 7 Días</Text>
              <View className="bg-surface rounded-2xl border border-border overflow-hidden">
                {last30Days.slice(-7).reverse().map((day, index) => (
                  <View
                    key={index}
                    className={`flex-row justify-between items-center px-4 py-3 ${
                      index < last30Days.slice(-7).length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <Text className="text-sm text-foreground">
                      {formatDateForDisplay(day.date)}
                    </Text>
                    <View className="bg-primary/10 px-3 py-1 rounded-full">
                      <Text className="text-sm font-semibold text-primary">{day.count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Gráfico de últimos 12 meses */}
          {last12Months.length > 0 && (
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">Últimos 12 Meses</Text>
              <BarChart data={monthlyChartData} barColor="#0066CC" height={150} />
            </View>
          )}

          {/* Tabla de últimos 6 meses */}
          {last12Months.length > 0 && (
            <View className="gap-2">
              <Text className="text-lg font-semibold text-foreground">Últimos 6 Meses</Text>
              <View className="bg-surface rounded-2xl border border-border overflow-hidden">
                {last12Months.slice(-6).reverse().map((month, index) => (
                  <View
                    key={index}
                    className={`flex-row justify-between items-center px-4 py-3 ${
                      index < last12Months.slice(-6).length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <Text className="text-sm text-foreground">
                      {formatMonthForDisplay(month.month)}
                    </Text>
                    <View className="bg-primary/10 px-3 py-1 rounded-full">
                      <Text className="text-sm font-semibold text-primary">{month.count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Mensaje cuando no hay datos */}
          {stats.total === 0 && (
            <View className="bg-surface rounded-2xl p-6 border border-border items-center">
              <Text className="text-muted text-center">
                No hay matrículas detectadas todavía. ¡Comienza a capturar matrículas para ver
                estadísticas!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

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
import { groupLicensePlates, getUniquePlateStats } from "@/lib/grouping";
import { generateStatisticsHTML, generatePDFFilename } from "@/lib/pdf-generator";

const STORAGE_KEY = "license_plates";

export default function StatsScreen() {
  const [stats, setStats] = useState<ReturnType<typeof calculateStatistics> | null>(null);
  const [last30Days, setLast30Days] = useState<ReturnType<typeof getLast30DaysStats>>([]);
  const [last12Months, setLast12Months] = useState<ReturnType<typeof getLast12MonthsStats>>([]);
  const [uniqueStats, setUniqueStats] = useState<ReturnType<typeof getUniquePlateStats> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

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
        setUniqueStats(getUniquePlateStats(entries));
      } else {
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
        setUniqueStats({
          totalUnique: 0,
          totalDetections: 0,
          averageDetectionsPerPlate: 0,
          mostDetectedPlate: null,
        });
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function exportPDF() {
    try {
      setIsExporting(true);

      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        Alert.alert("Sin datos", "No hay estadísticas para exportar");
        return;
      }

      const entries: LicensePlateEntry[] = JSON.parse(data);
      const htmlContent = generateStatisticsHTML(entries);
      const filename = generatePDFFilename();

      // Guardar HTML temporalmente
      const htmlPath = FileSystem.documentDirectory + "temp_stats.html";
      await FileSystem.writeAsStringAsync(htmlPath, htmlContent);

      // Abrir en navegador para que el usuario pueda guardar como PDF
      await WebBrowser.openBrowserAsync(`file://${htmlPath}`);

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert("Éxito", "Abre el navegador para guardar como PDF");
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      Alert.alert("Error", "No se pudo exportar el PDF");

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading || !stats || !uniqueStats) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ScreenContainer>
    );
  }

  const dailyChartData = last30Days
    .filter((_, index) => index % 3 === 0 || index === last30Days.length - 1)
    .map((d) => ({
      label: formatDateForDisplay(d.date).split(" ")[0],
      value: d.count,
    }));

  const monthlyChartData = last12Months.map((m) => ({
    label: formatMonthForDisplay(m.month).split(" ")[0],
    value: m.count,
  }));

  return (
    <ScreenContainer className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="gap-6 p-6">
          {/* Encabezado */}
          <View>
            <Text className="text-3xl font-bold text-foreground">Estadísticas</Text>
            <Text className="text-base text-muted mt-1">Análisis de matrículas detectadas</Text>
          </View>

          {/* Tarjetas de resumen */}
          <View className="gap-3">
            <View className="bg-primary rounded-2xl p-6">
              <Text className="text-sm text-white/80 mb-1">Total de Detecciones</Text>
              <Text className="text-4xl font-bold text-white">{stats.total}</Text>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Matrículas Únicas</Text>
                <Text className="text-2xl font-bold text-primary">{uniqueStats.totalUnique}</Text>
              </View>

              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Promedio</Text>
                <Text className="text-2xl font-bold text-primary">
                  {uniqueStats.averageDetectionsPerPlate}
                </Text>
              </View>

              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-xs text-muted mb-1">Hoy</Text>
                <Text className="text-2xl font-bold text-primary">{stats.today}</Text>
              </View>
            </View>

            {uniqueStats.mostDetectedPlate && (
              <View className="bg-warning/10 rounded-2xl p-4 border border-warning">
                <Text className="text-xs text-muted mb-1">Matrícula Más Detectada</Text>
                <Text className="text-2xl font-bold text-warning">
                  {uniqueStats.mostDetectedPlate.licensePlate} ({uniqueStats.mostDetectedPlate.count}x)
                </Text>
              </View>
            )}
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
                {last30Days
                  .slice(-7)
                  .reverse()
                  .map((day, index) => (
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
                {last12Months
                  .slice(-6)
                  .reverse()
                  .map((month, index) => (
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

      {/* Botón de exportar PDF */}
      {stats.total > 0 && (
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity
            onPress={exportPDF}
            disabled={isExporting}
            className="bg-primary py-4 rounded-full"
            style={{ opacity: isExporting ? 0.5 : 1 }}
          >
            {isExporting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-background font-bold text-center text-lg">
                📄 Exportar a PDF
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}

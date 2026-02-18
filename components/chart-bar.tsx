import { View, Text } from "react-native";

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
  }>;
  maxValue?: number;
  height?: number;
  barColor?: string;
}

export function BarChart({
  data,
  maxValue,
  height = 200,
  barColor = "#0066CC",
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <View className="w-full bg-surface rounded-2xl p-4 border border-border">
      {/* Título implícito en el contenedor */}
      <View style={{ height }}>
        {/* Área del gráfico */}
        <View className="flex-1 flex-row items-flex-end justify-around gap-1 mb-4">
          {data.map((item, index) => {
            const percentage = (item.value / max) * 100;
            return (
              <View key={index} className="flex-1 items-center gap-2">
                {/* Barra */}
                <View
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${percentage}%`,
                    backgroundColor: barColor,
                    minHeight: item.value > 0 ? 4 : 0,
                  }}
                />
              </View>
            );
          })}
        </View>

        {/* Etiquetas */}
        <View className="flex-row justify-around gap-1">
          {data.map((item, index) => (
            <View key={index} className="flex-1 items-center">
              <Text className="text-xs text-muted text-center" numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Leyenda de valores */}
      <View className="mt-4 pt-4 border-t border-border">
        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-muted">Mín: 0</Text>
          <Text className="text-xs text-muted">Máx: {max}</Text>
        </View>
      </View>
    </View>
  );
}

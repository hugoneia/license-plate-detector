import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";

export default function PlateMapScreen() {
  const router = useRouter();
  const { latitude, longitude, plate } = useLocalSearchParams<{
    latitude: string;
    longitude: string;
    plate: string;
  }>();

  const lat = latitude ? parseFloat(latitude) : 0;
  const lng = longitude ? parseFloat(longitude) : 0;

  if (!latitude || !longitude) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View className="items-center gap-4">
          <MaterialIcons name="location-off" size={48} color="#EF4444" />
          <Text className="text-xl font-bold text-foreground text-center">
            Ubicación no disponible
          </Text>
          <Text className="text-base text-muted text-center">
            Esta matrícula no tiene datos GPS registrados
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary px-6 py-3 rounded-full mt-4"
          >
            <Text className="text-background font-semibold">Volver</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="flex-1">
      <View className="flex-1">
        {/* Encabezado */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-foreground">
                Ubicación de {plate}
              </Text>
              <Text className="text-sm text-muted mt-1">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialIcons name="close" size={24} color="#687076" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mapa */}
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker
            coordinate={{ latitude: lat, longitude: lng }}
            title={plate}
            description={`Matrícula detectada en esta ubicación`}
            pinColor="#0066CC"
          />
        </MapView>

        {/* Botón de volver */}
        <View className="p-4 bg-background border-t border-border">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary px-6 py-3 rounded-full items-center"
          >
            <Text className="text-background font-semibold">Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

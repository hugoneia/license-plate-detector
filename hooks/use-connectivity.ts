import { useEffect, useState } from "react";
import * as Network from "expo-network";
import * as Location from "expo-location";
import { Platform } from "react-native";

export interface ConnectivityStatus {
  isOnline: boolean;
  gpsEnabled: boolean;
  gpsPermission: "granted" | "denied" | "undetermined";
}

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>({
    isOnline: true,
    gpsEnabled: false,
    gpsPermission: "undetermined",
  });

  useEffect(() => {
    checkConnectivity();

    // Escuchar cambios de conexión
    const unsubscribe = Network.addNetworkStateListener((state: any) => {
      setStatus((prev) => ({
        ...prev,
        isOnline: state.isConnected ?? true,
      }));
    });

    return () => {
      unsubscribe.remove();
    };
  }, []);

  async function checkConnectivity() {
    try {
      // Verificar conexión a internet
      const networkState = await Network.getNetworkStateAsync();
      const isOnline = networkState.isConnected ?? true;

      // Verificar permisos de GPS
      if (Platform.OS !== "web") {
        const { status: permissionStatus } = await Location.getForegroundPermissionsAsync();
        const gpsPermission =
          permissionStatus === "granted"
            ? "granted"
            : permissionStatus === "denied"
            ? "denied"
            : "undetermined";

        // Verificar si GPS está habilitado
        const gpsEnabled = await Location.hasServicesEnabledAsync();

        setStatus({
          isOnline,
          gpsEnabled,
          gpsPermission,
        });
      } else {
        setStatus((prev) => ({
          ...prev,
          isOnline,
        }));
      }
    } catch (error) {
      console.error("Error checking connectivity:", error);
    }
  }

  return { status, checkConnectivity };
}

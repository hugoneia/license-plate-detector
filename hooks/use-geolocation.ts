import { useState, useEffect, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import type { GeoLocation } from "@/types/license-plate";

const GPS_ACQUISITION_TIMEOUT_MS = 5000;

type LocationResult = Exclude<GeoLocation, "NO GPS">;

function toGeoLocation(location: Location.LocationObject): LocationResult {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    ...(typeof location.coords.accuracy === "number"
      ? { accuracy: location.coords.accuracy }
      : {}),
    timestamp: typeof location.timestamp === "number" ? location.timestamp : Date.now(),
  };

}

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | "NO GPS" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestLocationRef = useRef<LocationResult | null>(null);

  // Monitoreo eficiente de GPS sin bucles. La ref conserva la última posición
  // sin depender de closures obsoletas en getCurrentLocation.
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    async function startTracking() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          if (isMounted) setLocation("NO GPS");
          return;
        }

        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          if (isMounted) setLocation("NO GPS");
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 1000,
            distanceInterval: 5,
          },
          (nextLocation) => {
            const nextGeoLocation = toGeoLocation(nextLocation);
            latestLocationRef.current = nextGeoLocation;
            if (isMounted) setLocation(nextGeoLocation);
          }
        );
      } catch (err) {
        console.error("Error en tracking de GPS:", err);
        if (isMounted) setLocation("NO GPS");
      }
    }

    void startTracking();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | "NO GPS"> => {
    if (Platform.OS === "web") {
      return "NO GPS";
    }

    setIsLoading(true);
    setError(null);

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocation("NO GPS");
        return "NO GPS";
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocation("NO GPS");
        return "NO GPS";
      }

      // La adquisición puntual usa High, pero nunca puede bloquear el alta
      // indefinidamente: el fallback se decide al alcanzar este deadline.
      const currentPositionPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), GPS_ACQUISITION_TIMEOUT_MS);
      });

      currentPositionPromise
        .then((currentPosition) => {
          const freshLocation = toGeoLocation(currentPosition);
          latestLocationRef.current = freshLocation;
        })
        .catch(() => {
          // El resultado tardío o fallido no debe alterar el flujo de registro.
        });

      const currentPosition = await Promise.race([
        currentPositionPromise,
        timeoutPromise,
      ]);

      if (currentPosition) {
        const freshLocation = toGeoLocation(currentPosition);
        latestLocationRef.current = freshLocation;
        setLocation(freshLocation);
        return freshLocation;
      }

      // Al expirar el límite, se usa la posición más reciente que haya llegado
      // del tracking (o la última adquisición puntual completada).
      const fallbackLocation = latestLocationRef.current;
      if (fallbackLocation) {
        setLocation(fallbackLocation);
        return fallbackLocation;
      }

      setLocation("NO GPS");
      return "NO GPS";
    } catch (err) {
      console.error("Error al obtener ubicación:", err);
      const fallbackLocation = latestLocationRef.current;
      if (fallbackLocation) {
        setLocation(fallbackLocation);
        return fallbackLocation;
      }

      setLocation("NO GPS");
      setError("No se pudo obtener la ubicación");
      return "NO GPS";
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    location,
    isLoading,
    error,
    getCurrentLocation,
  };
}
